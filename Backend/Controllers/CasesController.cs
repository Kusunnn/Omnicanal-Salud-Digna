using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
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
        Guid patientId, CancellationToken cancellationToken, [FromQuery] bool incluirCompletados = false)
    {
        if (!IsOwnerOrStaff(patientId))
        {
            return Forbid();
        }

        var finalSteps = CaseCheckpoint.CompletedSteps;
        var cases = await database.Cases.AsNoTracking()
            .Where(item => item.PatientId == patientId && item.ArchivedAt == null &&
                (incluirCompletados || (!finalSteps.Contains(item.PasoActual)
                    && (item.Estado == "EN_PROGRESO" || item.Estado == "INTERRUMPIDO"))))
            .ToListAsync(cancellationToken);

        var contexts = await ReadContextsAsync(patientId, cases.Select(item => item.Id).ToArray(), cancellationToken);
        var pending = contexts.Where(context => !context.Immediate)
            .ToDictionary(context => context.Checkpoint.Id, context => context.Checkpoint);

        return Ok(cases.Select(item =>
                pending.TryGetValue(item.Id, out var current) && current.Version > item.Version
                    ? current
                    : CaseCheckpoint.FromCase(item))
            .Where(item => incluirCompletados || !CaseCheckpoint.IsCompleted(item.Estado, item.PasoActual))
            .OrderByDescending(item => item.UpdatedAt)
            .ThenByDescending(item => item.Id)
            .ToArray());
    }

    [HttpDelete("{caseId:guid}")]
    [Authorize(Roles = "PACIENTE,ADMIN")]
    public async Task<IActionResult> Archive(Guid patientId, Guid caseId, CancellationToken cancellationToken)
    {
        if (!User.IsInRole("ADMIN") && (!Guid.TryParse(ActorId, out var actor) || actor != patientId))
        {
            return Forbid();
        }

        var cases = database.Cases.Where(item => item.Id == caseId && item.PatientId == patientId);
        var finalSteps = CaseCheckpoint.CompletedSteps;
        var now = DateTime.UtcNow;
        var changed = await cases
            .Where(item => item.ArchivedAt == null && item.Estado != "COMPLETADO" && !finalSteps.Contains(item.PasoActual))
            .ExecuteUpdateAsync(update => update.SetProperty(item => item.ArchivedAt, now), cancellationToken);
        if (changed > 0 || await cases.AnyAsync(item => item.ArchivedAt != null, cancellationToken))
        {
            return NoContent();
        }

        return await cases.AnyAsync(cancellationToken)
            ? Problem(statusCode: 409, title: "El trámite ya fue confirmado y no se puede eliminar.")
            : NotFound();
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
            return Ok(await CarryWhatsAppContextAsync(context.Checkpoint, cancellationToken));
        }

        var checkpoint = await ReadDatabaseAsync(patientId, caseId, cancellationToken);
        if (checkpoint is null)
        {
            return NotFound();
        }

        await WarmAsync(checkpoint, cancellationToken);
        return Ok(await CarryWhatsAppContextAsync(checkpoint, cancellationToken));
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

        var data = request.Datos ?? new CaseProgressData();
        if (request.Canal == "WHATSAPP" && requesterId == patientId && data.Prerregistro is null)
        {
            data = data with { Prerregistro = await ReadRegistrationDraftAsync(patientId, cancellationToken) };
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
            DatosParciales = JsonSerializer.SerializeToElement(data, JsonSerializerOptions.Web),
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
    [Authorize(Roles = "PACIENTE,ASESOR,ADMIN")]
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

        var consultation = FindConsultation(checkpoint.TipoConsultaId, checkpoint.FlujoVersion);
        var currentNode = consultation?.Checkpoints.FirstOrDefault(item => item.Id == checkpoint.PasoActual);
        if (currentNode is null)
        {
            return Problem(statusCode: 409, title: "El checkpoint actual no existe en el catálogo.");
        }

        var staysAtCurrentStep = currentNode.Id == request.PasoActual;
        var completesCase = CaseCheckpoint.CompletedSteps.Contains(request.PasoActual);
        if (CaseCheckpoint.IsCompleted(checkpoint.Estado, checkpoint.PasoActual)
            && (staysAtCurrentStep || !completesCase || !currentNode.Siguientes.Contains(request.PasoActual)))
        {
            return Problem(statusCode: 409, title: "El caso ya está completado.");
        }

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
            Estado = completesCase ? "COMPLETADO" : "EN_PROGRESO",
            Version = checkpoint.Version + 1,
            UpdatedAt = DateTime.UtcNow,
            Datos = data
        };
        var previousData = checkpoint.Datos;
        var updatedFields = new (bool Changed, string Label)[]
        {
            (previousData.Parentesco != data.Parentesco, "destinatario"),
            (previousData.Estudio != data.Estudio, "estudio"),
            (previousData.Clinica != data.Clinica, "clínica"),
            (previousData.Fecha != data.Fecha, "fecha"),
            (previousData.Horario != data.Horario, "horario"),
            (previousData.Prerregistro != data.Prerregistro, "datos de prerregistro")
        };
        var change = new CheckpointChange(updated.Version, checkpoint.PasoActual, updated.PasoActual,
            updated.UltimoCanal, updated.UpdatedAt, CanalAnterior: checkpoint.UltimoCanal,
            ActorId: ActorId, EventId: Guid.NewGuid(),
            CamposActualizados: updatedFields.Where(field => field.Changed).Select(field => field.Label).ToArray());
        var next = new CheckpointContext(updated, [.. current.Changes, change], 0, completesCase || target.GuardadoInmediato);

        return await SaveAsync(current, next, cancellationToken);
    }

    [HttpPost("{caseId:guid}/verificar-fecha-nacimiento")]
    [EnableRateLimiting("demo-identity")]
    public async Task<IActionResult> VerifyBirthDate(
        Guid patientId, Guid caseId, VerifyBirthDateRequest request, CancellationToken cancellationToken)
    {
        if (!await CanAccessCaseAsync(patientId, caseId, cancellationToken))
        {
            return NotFound();
        }

        var matches = await database.Patients.AsNoTracking().AnyAsync(patient =>
            patient.Id == patientId && patient.FechaNacimiento == request.FechaNacimiento, cancellationToken);
        return matches
            ? NoContent()
            : Problem(statusCode: 403, title: "No se pudo verificar la fecha de nacimiento del paciente.");
    }

    public sealed record VerifyBirthDateRequest([Required] DateOnly? FechaNacimiento);

    [HttpPost("{caseId:guid}/retomar")]
    [Authorize(Roles = "PACIENTE,ASESOR,ADMIN")]
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

        if (current.Immediate || checkpoint.Version != request.VersionEsperada || CaseCheckpoint.IsCompleted(checkpoint.Estado, checkpoint.PasoActual))
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
            UpdatedAt = DateTime.UtcNow,
            Datos = (await CarryWhatsAppContextAsync(checkpoint, cancellationToken)).Datos
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
        [FromQuery, Range(1, 100)] int limite = 30,
        [FromQuery, Range(0, int.MaxValue - 100)] int omitir = 0)
    {
        if (!await CanAccessCaseAsync(patientId, caseId, cancellationToken)
            || !await database.Cases.AnyAsync(item => item.PatientId == patientId && item.Id == caseId, cancellationToken))
        {
            return NotFound();
        }

        var contexts = await ReadContextsAsync(patientId, new[] { caseId }, cancellationToken);
        var history = await database.Events.AsNoTracking().Where(item => item.CaseId == caseId)
            .OrderByDescending(item => item.OcurridoAt).ThenByDescending(item => item.CaseVersion)
            .ThenByDescending(item => item.Id).Take(omitir + limite)
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

        return Ok(history.OrderByDescending(item => item.OcurridoAt).ThenByDescending(item => item.Version)
            .ThenByDescending(item => item.Id).Skip(omitir).Take(limite).Reverse().ToArray());
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
        }
    }

    private async Task<CaseCheckpoint> CarryWhatsAppContextAsync(CaseCheckpoint checkpoint, CancellationToken token)
    {
        var data = checkpoint.Datos;
        var missingClinic = string.IsNullOrWhiteSpace(data.Clinica) && checkpoint.PasoActual == "clinica-seleccionada";
        var missingDraft = data.Prerregistro is null && IsOwnerOrStaff(checkpoint.PatientId);
        var missingRecipient = string.IsNullOrWhiteSpace(data.Parentesco);
        if (!missingClinic && !missingDraft && !missingRecipient) return checkpoint;

        if (checkpoint.UltimoCanal != "WHATSAPP" && !await database.Events.AnyAsync(item =>
            item.CaseId == checkpoint.Id && item.TipoEvento == "CASO_CREADO" && item.Canal == "WHATSAPP", token))
        {
            return checkpoint;
        }
        if (missingClinic)
        {
            data = data with { Clinica = ConsultationTypesController.LegacyClinic };
        }

        if (missingRecipient)
        {
            var ownCase = await database.Cases.AnyAsync(item => item.Id == checkpoint.Id &&
                (item.SolicitantePatientId == null || item.SolicitantePatientId == item.PatientId), token);
            data = data with { Parentesco = ownCase ? "Para mí" : "Para otra persona" };
        }

        if (missingDraft)
        {
            data = data with { Prerregistro = await ReadRegistrationDraftAsync(checkpoint.PatientId, token) };
        }

        return checkpoint with { Datos = data };
    }

    private async Task<RegistrationDraft?> ReadRegistrationDraftAsync(Guid patientId, CancellationToken token)
    {
        var patient = await database.Patients.AsNoTracking().Where(item => item.Id == patientId)
            .Select(item => new { item.NombreCompleto, item.FechaNacimiento, item.Sexo, item.Correo, item.Telefono })
            .SingleOrDefaultAsync(token);
        if (patient is null) return null;
        var parts = patient.NombreCompleto.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        var surnames = Math.Min(2, Math.Max(0, parts.Length - 1));
        var givenCount = parts.Length - surnames;
        return new RegistrationDraft(
            Nombres: string.Join(' ', parts.Take(givenCount)),
            ApellidoPaterno: surnames > 0 ? parts[givenCount] : null,
            ApellidoMaterno: surnames > 1 ? parts[givenCount + 1] : null,
            Nacimiento: patient.FechaNacimiento,
            Sexo: patient.Sexo switch { "M" => "Mujer", "H" => "Hombre", _ => null },
            Correo: patient.Correo,
            Whatsapp: patient.Telefono);
    }

    private string? ActorId => User.FindFirstValue(ClaimTypes.NameIdentifier);

    private bool IsOwnerOrStaff(Guid patientId) =>
        User.IsInRole("ASESOR") || User.IsInRole("ADMIN") || Guid.TryParse(ActorId, out var actor) && actor == patientId;

    private async Task<bool> CanAccessCaseAsync(Guid patientId, Guid caseId, CancellationToken token)
    {
        var ownerOrStaff = IsOwnerOrStaff(patientId);
        Guid? requester = Guid.TryParse(ActorId, out var actor) ? actor : null;
        return await database.Cases.AnyAsync(item => item.Id == caseId && item.PatientId == patientId
            && item.ArchivedAt == null && (ownerOrStaff || (requester != null && item.SolicitantePatientId == requester)), token);
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
