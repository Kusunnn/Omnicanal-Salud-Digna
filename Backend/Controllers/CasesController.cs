using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Npgsql;
using SaludDigna.Backend.Data;
using SaludDigna.Backend.Models;
using SaludDigna.Backend.Models.Cases;
using SaludDigna.Backend.Models.Consultations;
using SaludDigna.Backend.Services;

namespace SaludDigna.Backend.Controllers;

[ApiController]
[Authorize(Roles = "PACIENTE,ASESOR,ADMIN")]
[Route("api/pacientes/{patientId:guid}/casos")]
[ResponseCache(NoStore = true)]
public sealed class CasesController(
    SaludDignaDbContext database,
    CaseCheckpointCache cache,
    CheckpointPersistence persistence,
    IOptions<CheckpointSyncOptions> syncOptions) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<CaseCheckpoint>>> List(
        Guid patientId, CancellationToken cancellationToken)
    {
        if (!IsOwnerOrStaff(patientId))
        {
            return Forbid();
        }

        var cases = await database.Cases.AsNoTracking()
            .Where(item => item.PatientId == patientId &&
                (item.Estado == "EN_PROGRESO" || item.Estado == "INTERRUMPIDO"))
            .ToListAsync(cancellationToken);

        var contexts = await ReadContextsAsync(patientId, cases.Select(item => item.Id).ToArray(), cancellationToken);
        var pending = contexts.Where(context => !context.Immediate)
            .ToDictionary(context => context.Checkpoint.Id, context => context.Checkpoint);

        return Ok(cases.Select(item =>
                pending.TryGetValue(item.Id, out var current) && current.Version > item.Version
                    ? current
                    : CaseCheckpoint.FromCase(item))
            .OrderByDescending(item => item.UpdatedAt)
            .ThenByDescending(item => item.Id)
            .ToArray());
    }

    [HttpGet("{caseId:guid}")]
    public async Task<ActionResult<CaseCheckpoint>> Get(
        Guid patientId, Guid caseId, CancellationToken cancellationToken)
    {
        if (!await CanAccessCaseAsync(patientId, caseId, cancellationToken))
        {
            return NotFound();
        }

        var contexts = await ReadContextsAsync(patientId, new[] { caseId }, cancellationToken);
        var context = contexts.FirstOrDefault();
        if (context is { Immediate: false })
        {
            return Ok(context.Checkpoint);
        }

        var checkpoint = await ReadDatabaseAsync(patientId, caseId, cancellationToken);
        if (checkpoint is null)
        {
            return NotFound();
        }

        await WarmAsync(checkpoint, cancellationToken);
        return Ok(checkpoint);
    }

    [HttpPost]
    [Authorize(Roles = "PACIENTE,ASESOR")]
    public async Task<ActionResult<CaseCheckpoint>> Create(
        Guid patientId, CreateCaseRequest request, CancellationToken cancellationToken)
    {
        if (!IsOwnerOrStaff(patientId)
            || !User.IsInRole("ASESOR") && request.SolicitantePatientId is Guid requester && requester != patientId)
        {
            return Forbid();
        }

        var consultation = ConsultationCatalog.Types.Where(item => item.Id == request.TipoConsultaId)
            .MaxBy(item => item.Version);
        if (consultation is null)
        {
            return Problem(statusCode: 400, title: "El tipo de consulta no existe.");
        }

        var requesterId = request.SolicitantePatientId ?? patientId;
        var ownerExists = await database.Patients.AnyAsync(patient => patient.Id == patientId, cancellationToken);
        var requesterPhone = await database.Patients.Where(patient => patient.Id == requesterId)
            .Select(patient => patient.Telefono).SingleOrDefaultAsync(cancellationToken);
        if (!ownerExists || requesterPhone is null)
        {
            return NotFound();
        }

        var patientCase = new PatientCase
        {
            Id = Guid.NewGuid(),
            PatientId = patientId,
            TipoConsultaId = consultation.Id,
            FlujoVersion = consultation.Version,
            SolicitantePatientId = requesterId,
            SolicitanteTelefono = request.SolicitanteTelefono ?? requesterPhone,
            Estudio = request.Datos?.Estudio ?? consultation.Nombre,
            Clinica = request.Datos?.Clinica,
            ParentescoPaciente = request.Datos?.Parentesco,
            FechaCita = request.Datos?.Fecha,
            HorarioCita = request.Datos?.Horario,
            PasoActual = consultation.CheckpointInicial,
            UltimoCanal = request.Canal
        };

        database.Cases.Add(patientCase);
        database.Events.Add(new CaseEvent
        {
            CaseId = patientCase.Id,
            Canal = patientCase.UltimoCanal,
            TipoEvento = "CASO_CREADO",
            CaseVersion = 1,
            ActorId = ActorId,
            ResumenLegible = "Se inició el caso.",
            PayloadJson = JsonSerializer.SerializeToElement(new { pasoActual = patientCase.PasoActual, version = 1 })
        });
        await database.SaveChangesAsync(cancellationToken);

        var checkpoint = CaseCheckpoint.FromCase(patientCase);
        await WarmAsync(checkpoint, cancellationToken);
        return CreatedAtAction(nameof(Get), new { patientId, caseId = checkpoint.Id }, checkpoint);
    }

    [HttpPut("{caseId:guid}/checkpoint")]
    [Authorize(Roles = "PACIENTE,ASESOR")]
    public async Task<ActionResult<CaseCheckpoint>> SaveCheckpoint(
        Guid patientId, Guid caseId, SaveCheckpointRequest request, CancellationToken cancellationToken)
    {
        if (!await CanAccessCaseAsync(patientId, caseId, cancellationToken))
        {
            return NotFound();
        }

        CheckpointContext? current;
        try
        {
            current = await ReadForWriteAsync(patientId, caseId, cancellationToken);
        }
        catch (Exception exception) when (CaseCheckpointCache.IsUnavailable(exception))
        {
            return SyncUnavailable();
        }

        if (current is null)
        {
            return NotFound();
        }

        var checkpoint = current.Checkpoint;
        if (current.Immediate)
        {
            return Problem(statusCode: 409, title: "El caso tiene un checkpoint final pendiente de confirmación.");
        }

        if (checkpoint.Version != request.VersionEsperada)
        {
            return ConflictVersion();
        }

        if (checkpoint.Estado == "COMPLETADO")
        {
            return Problem(statusCode: 409, title: "El caso ya está completado.");
        }

        var consultation = FindConsultation(checkpoint.TipoConsultaId, checkpoint.FlujoVersion);
        var currentNode = consultation?.Checkpoints.FirstOrDefault(item => item.Id == checkpoint.PasoActual);
        if (currentNode is null)
        {
            return Problem(statusCode: 409, title: "El checkpoint actual no existe en el catálogo.");
        }

        var staysAtCurrentStep = currentNode.Id == request.PasoActual;
        if (!staysAtCurrentStep && !currentNode.Siguientes.Contains(request.PasoActual))
        {
            return Problem(statusCode: 400, title: "Elige el checkpoint actual o una de sus opciones.");
        }

        var data = checkpoint.Datos.Merge(request.Datos);
        if (staysAtCurrentStep && checkpoint.UltimoCanal == request.Canal
            && checkpoint.Estado == "EN_PROGRESO" && data == checkpoint.Datos)
        {
            return current.FirstPendingAt > 0 ? Accepted(checkpoint) : Ok(checkpoint);
        }

        var target = consultation!.Checkpoints.First(item => item.Id == request.PasoActual);
        var updated = checkpoint with
        {
            PasoActual = request.PasoActual,
            UltimoCanal = request.Canal,
            Estado = "EN_PROGRESO",
            Version = checkpoint.Version + 1,
            UpdatedAt = DateTime.UtcNow,
            Datos = data
        };
        var change = new CheckpointChange(updated.Version, checkpoint.PasoActual, updated.PasoActual,
            updated.UltimoCanal, updated.UpdatedAt, CanalAnterior: checkpoint.UltimoCanal,
            ActorId: ActorId, EventId: Guid.NewGuid());
        var next = new CheckpointContext(updated, [.. current.Changes, change], 0, target.GuardadoInmediato);

        return await SaveAsync(current, next, cancellationToken);
    }

    [HttpPost("{caseId:guid}/retomar")]
    [Authorize(Roles = "PACIENTE,ASESOR")]
    public async Task<ActionResult<CaseCheckpoint>> Resume(
        Guid patientId, Guid caseId, ResumeCaseRequest request, CancellationToken cancellationToken)
    {
        if (request.InteraccionId == Guid.Empty)
        {
            return Problem(statusCode: 400, title: "Se requiere un identificador de interacción.");
        }

        if (!await CanAccessCaseAsync(patientId, caseId, cancellationToken))
        {
            return NotFound();
        }

        CheckpointContext? current;
        try
        {
            current = await ReadForWriteAsync(patientId, caseId, cancellationToken);
        }
        catch (Exception exception) when (CaseCheckpointCache.IsUnavailable(exception))
        {
            return SyncUnavailable();
        }

        if (current is null)
        {
            return NotFound();
        }

        var checkpoint = current.Checkpoint;
        var recorded = await database.Events.AsNoTracking()
            .Where(item => item.CaseId == caseId && item.InteraccionId == request.InteraccionId)
            .Select(item => new { item.Canal, item.ActorId })
            .SingleOrDefaultAsync(cancellationToken);
        if (recorded is not null)
        {
            if (recorded.Canal != request.Canal || recorded.ActorId != ActorId)
            {
                return Problem(statusCode: 409, title: "El identificador ya se usó para otra interacción.");
            }

            return Ok(current.Immediate
                ? await ReadDatabaseAsync(patientId, caseId, cancellationToken)
                : checkpoint);
        }

        if (current.Immediate || checkpoint.Version != request.VersionEsperada || checkpoint.Estado == "COMPLETADO")
        {
            return ConflictVersion();
        }

        if (checkpoint.UltimoCanal == request.Canal)
        {
            return Ok(checkpoint);
        }

        var updated = checkpoint with
        {
            UltimoCanal = request.Canal,
            Estado = "EN_PROGRESO",
            Version = checkpoint.Version + 1,
            UpdatedAt = DateTime.UtcNow
        };
        var change = new CheckpointChange(updated.Version, checkpoint.PasoActual, checkpoint.PasoActual,
            request.Canal, updated.UpdatedAt, "CASO_RETOMADO", checkpoint.UltimoCanal,
            request.InteraccionId, ActorId, Guid.NewGuid());

        return await SaveAsync(current,
            new CheckpointContext(updated, [.. current.Changes, change], 0, true), cancellationToken);
    }

    [HttpGet("{caseId:guid}/eventos")]
    public async Task<ActionResult<IReadOnlyList<CaseTimelineEvent>>> Timeline(
        Guid patientId, Guid caseId, CancellationToken cancellationToken,
        [FromQuery, Range(1, 100)] int limite = 30)
    {
        if (!await CanAccessCaseAsync(patientId, caseId, cancellationToken)
            || !await database.Cases.AnyAsync(item => item.PatientId == patientId && item.Id == caseId, cancellationToken))
        {
            return NotFound();
        }

        var contexts = await ReadContextsAsync(patientId, new[] { caseId }, cancellationToken);
        var history = await database.Events.AsNoTracking().Where(item => item.CaseId == caseId)
            .OrderByDescending(item => item.OcurridoAt).ThenByDescending(item => item.Id).Take(limite)
            .Select(item => new CaseTimelineEvent(item.Id, item.CaseId, item.CaseVersion, item.Canal,
                item.TipoEvento, item.ResumenLegible, item.OcurridoAt, item.CreatedAt, item.ModoPersistencia, item.PayloadJson))
            .ToListAsync(cancellationToken);

        var persistedVersion = history.Max(item => item.Version) ?? 0;
        var pending = contexts.FirstOrDefault();
        var changes = pending is { Immediate: false } ? pending.Changes : Array.Empty<CheckpointChange>();
        history.AddRange(changes.Where(change => change.Version > persistedVersion)
            .Select(change => new CaseTimelineEvent(change.EventId ?? Guid.Empty, caseId, change.Version,
                change.Canal, change.TipoEvento, change.Resumen, change.UpdatedAt, null, null,
                CheckpointPersistence.SerializeChange(change))));

        return Ok(history.OrderBy(item => item.OcurridoAt).ThenBy(item => item.Version).ThenBy(item => item.Id)
            .TakeLast(limite).ToArray());
    }

    private async Task<ActionResult<CaseCheckpoint>> SaveAsync(
        CheckpointContext current, CheckpointContext next, CancellationToken cancellationToken)
    {
        var updated = next.Checkpoint;
        if (cache.IsConfigured)
        {
            try
            {
                if (!await cache.StageAsync(current, next, syncOptions.Value, cancellationToken))
                {
                    return ConflictVersion();
                }
            }
            catch (Exception exception) when (CaseCheckpointCache.IsUnavailable(exception))
            {
                return SyncUnavailable();
            }

            if (!next.Immediate)
            {
                return Accepted(updated);
            }
        }

        try
        {
            await persistence.PersistAsync(new[] { next }, cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            return ConflictVersion();
        }
        catch (Exception exception) when (exception is DbUpdateException or NpgsqlException or TimeoutException)
        {
            return Problem(statusCode: 503, title: "No se pudo verificar la confirmación en PostgreSQL.");
        }

        if (cache.IsConfigured)
        {
            try
            {
                await cache.ConfirmAsync(next, cancellationToken);
            }
            catch (Exception exception) when (CaseCheckpointCache.IsUnavailable(exception))
            {
                // The commit succeeded. The worker can acknowledge it on a later pass.
            }
        }

        return Ok(updated);
    }

    private async Task<CaseCheckpoint?> ReadDatabaseAsync(Guid patientId, Guid caseId, CancellationToken token)
    {
        var item = await database.Cases.AsNoTracking()
            .SingleOrDefaultAsync(item => item.PatientId == patientId && item.Id == caseId, token);
        return item is null ? null : CaseCheckpoint.FromCase(item);
    }

    private async Task<IReadOnlyList<CheckpointContext>> ReadContextsAsync(
        Guid patientId, IReadOnlyCollection<Guid> caseIds, CancellationToken token)
    {
        try
        {
            return await cache.GetManyAsync(patientId, caseIds, token);
        }
        catch (Exception exception) when (CaseCheckpointCache.IsUnavailable(exception))
        {
            return Array.Empty<CheckpointContext>();
        }
    }

    private async Task WarmAsync(CaseCheckpoint checkpoint, CancellationToken token)
    {
        try
        {
            await cache.WarmAsync(CheckpointContext.Saved(checkpoint), token);
        }
        catch (Exception exception) when (CaseCheckpointCache.IsUnavailable(exception))
        {
            // A PostgreSQL read or creation may succeed while Redis is unavailable.
        }
    }

    private string? ActorId => User.FindFirstValue(ClaimTypes.NameIdentifier);

    private bool IsOwnerOrStaff(Guid patientId) =>
        User.IsInRole("ASESOR") || User.IsInRole("ADMIN") || Guid.TryParse(ActorId, out var actor) && actor == patientId;

    private async Task<bool> CanAccessCaseAsync(Guid patientId, Guid caseId, CancellationToken token)
    {
        if (IsOwnerOrStaff(patientId))
        {
            return true;
        }

        return Guid.TryParse(ActorId, out var actor) && await database.Cases.AnyAsync(item =>
            item.Id == caseId && item.PatientId == patientId && item.SolicitantePatientId == actor, token);
    }

    private async Task<CheckpointContext?> ReadForWriteAsync(Guid patientId, Guid caseId, CancellationToken token)
    {
        var context = await cache.GetAsync(patientId, caseId, token);
        if (context is not null)
        {
            return context;
        }

        var checkpoint = await ReadDatabaseAsync(patientId, caseId, token);
        return checkpoint is null ? null : CheckpointContext.Saved(checkpoint);
    }

    private static ConsultationType? FindConsultation(string? id, int version) =>
        ConsultationCatalog.Types.FirstOrDefault(item => item.Id == id && item.Version == version);

    private ObjectResult ConflictVersion() =>
        Problem(statusCode: 409, title: "El caso cambió. Consulta su última versión y vuelve a intentar.");

    private ObjectResult SyncUnavailable() =>
        Problem(statusCode: 503, title: "No se pudo verificar la actualización del contexto. Consulta el caso antes de reintentar.");
}
