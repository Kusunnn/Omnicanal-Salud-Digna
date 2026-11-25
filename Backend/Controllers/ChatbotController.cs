using System.ComponentModel.DataAnnotations;
using System.Globalization;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using SaludDigna.Backend.Data;
using SaludDigna.Backend.Models;
using SaludDigna.Backend.Models.Cases;
using SaludDigna.Backend.Models.Consultations;
using SaludDigna.Backend.Models.Patients;
using SaludDigna.Backend.Services;

namespace SaludDigna.Backend.Controllers;
[ApiController]
[ChatbotKey]
[Route("api/chatbot")]
[ResponseCache(NoStore = true)]
public sealed partial class ChatbotController(
    SaludDignaDbContext database,
    CaseCheckpointCache cache,
    ChatbotIdentityAttempts attempts,
    ILogger<ChatbotController> logger) : ControllerBase
{
    private const string Canal = "WHATSAPP";

    private static readonly Dictionary<string, string> Parentescos = new()
    {
        ["HIJO"] = "Hijo(a)",
        ["PADRE_MADRE"] = "Padre/Madre",
        ["OTRO"] = "Otro familiar"
    };
    [HttpPost("identidad")]
    [AllowAnonymous]
    public async Task<IActionResult> Identify(IdentityRequest request, CancellationToken token)
    {
        var estado = await attempts.GetAsync(request.Telefono, token);
        if (estado.Bloqueado)
        {
            return Locked(estado);
        }

        var fecha = request.FechaNacimiento!.Value;
        var matches = await database.Patients.AsNoTracking()
            .Where(patient => patient.Telefono == request.Telefono && patient.FechaNacimiento == fecha)
            .Select(patient => new { patient.Id, patient.NombreCompleto })
            .Take(2)
            .ToListAsync(token);

        if (matches.Count != 1)
        {
            estado = await attempts.RegisterFailureAsync(request.Telefono, token);
            logger.LogWarning(
                "Identificación fallida en WhatsApp para el teléfono terminado en {Final}. Intentos restantes: {Restantes}",
                request.Telefono[^4..], estado.IntentosRestantes);
            return estado.Bloqueado
                ? Locked(estado)
                : Unauthorized(new { mensaje = "Los datos no coinciden.", intentosRestantes = estado.IntentosRestantes });
        }

        await attempts.ResetAsync(request.Telefono, token);
        var patient = matches[0];
        var identity = new ClaimsIdentity(
            [
                new Claim(ClaimTypes.NameIdentifier, patient.Id.ToString()),
                new Claim(ClaimTypes.Role, "PACIENTE"),
                new Claim(ClaimTypes.MobilePhone, request.Telefono),
                new Claim("canal", Canal)
            ],
            CookieAuthenticationDefaults.AuthenticationScheme);
        await HttpContext.SignInAsync(new ClaimsPrincipal(identity));

        logger.LogInformation("Paciente {PatientId} identificado por WhatsApp", patient.Id);
        return Ok(new { patientId = patient.Id, nombre = PrimerNombre(patient.NombreCompleto) });
    }
    [HttpGet("pendientes")]
    [Authorize(Roles = "PACIENTE")]
    public async Task<ActionResult<IReadOnlyList<PendingCase>>> Pending(CancellationToken token)
    {
        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var me))
        {
            return Unauthorized();
        }

        var finalSteps = CaseCheckpoint.CompletedSteps;
        var cases = await database.Cases.AsNoTracking()
            .Where(item => (item.PatientId == me || item.SolicitantePatientId == me)
                && item.ArchivedAt == null && !finalSteps.Contains(item.PasoActual)
                && (item.Estado == "EN_PROGRESO" || item.Estado == "INTERRUMPIDO"))
            .OrderByDescending(item => item.UpdatedAt)
            .Take(20)
            .ToListAsync(token);

        IReadOnlyList<CheckpointContext> contexts;
        try
        {
            contexts = await cache.GetManyAsync(cases.Select(item => (item.PatientId, item.Id)).ToArray(), token);
        }
        catch (Exception exception) when (CaseCheckpointCache.IsUnavailable(exception))
        {
            contexts = Array.Empty<CheckpointContext>();
        }

        var pending = contexts.Where(context => !context.Immediate)
            .ToDictionary(context => context.Checkpoint.Id, context => context.Checkpoint);

        var result = cases
            .Select(item =>
            {
                var checkpoint = pending.TryGetValue(item.Id, out var current) && current.Version > item.Version
                    ? current
                    : CaseCheckpoint.FromCase(item);
                return new PendingCase(checkpoint.Id, checkpoint.PatientId, checkpoint.TipoConsultaId,
                    checkpoint.PasoActual, checkpoint.Estado, checkpoint.UltimoCanal, checkpoint.Version,
                    checkpoint.UpdatedAt, item.PatientId == me, item.PatientId == me ? null : item.ParentescoPaciente);
            })
            .Where(item => !CaseCheckpoint.IsCompleted(item.Estado, item.PasoActual))
            .OrderByDescending(item => item.UpdatedAt)
            .ToArray();

        return Ok(result);
    }
    [HttpPost("familiares/casos")]
    [Authorize(Roles = "PACIENTE")]
    public async Task<ActionResult<CaseCheckpoint>> CreateForRelative(RelativeCaseRequest request, CancellationToken token)
    {
        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var me))
        {
            return Unauthorized();
        }

        var curp = request.Curp.Trim().ToUpperInvariant();
        if (!CurpRegex().IsMatch(curp))
        {
            return Problem(statusCode: 400, title: "La CURP no es válida.");
        }

        if (!Parentescos.TryGetValue(request.Parentesco, out var parentesco))
        {
            return Problem(statusCode: 400, title: "El parentesco no es válido.");
        }

        var consultation = ConsultationCatalog.Types.Where(item => item.Id == request.TipoConsultaId)
            .MaxBy(item => item.Version);
        if (consultation is null)
        {
            return Problem(statusCode: 400, title: "El tipo de consulta no existe.");
        }

        var requester = await database.Patients.AsNoTracking()
            .Where(patient => patient.Id == me)
            .Select(patient => new { patient.Telefono, patient.Curp })
            .SingleOrDefaultAsync(token);
        if (requester is null)
        {
            return Unauthorized();
        }

        if (requester.Curp == curp)
        {
            return Problem(statusCode: 400, title: "Esa CURP es la del paciente identificado.");
        }

        var relativeId = await database.Patients.Where(patient => patient.Curp == curp)
            .Select(patient => (Guid?)patient.Id).SingleOrDefaultAsync(token);
        if (relativeId is null)
        {
            var relative = new Patient
            {
                NombreCompleto = request.NombreCompleto.Trim(),
                Telefono = requester.Telefono,
                Curp = curp,
                FechaNacimiento = FechaDesdeCurp(curp),
                Sexo = curp.StartsWith("DEMO", StringComparison.Ordinal) ? null : curp[10].ToString()
            };
            database.Patients.Add(relative);
            try
            {
                await database.SaveChangesAsync(token);
                relativeId = relative.Id;
            }
            catch (DbUpdateException exception) when (exception.InnerException is PostgresException
                   { SqlState: PostgresErrorCodes.UniqueViolation, ConstraintName: "ux_patients_curp" })
            {
                database.Entry(relative).State = EntityState.Detached;
                relativeId = await database.Patients.Where(patient => patient.Curp == curp)
                    .Select(patient => (Guid?)patient.Id).SingleAsync(token);
            }
        }

        if (relativeId is not Guid relativePatientId)
        {
            return Problem(statusCode: 500, title: "No se pudo registrar al familiar.");
        }

        var patientCase = new PatientCase
        {
            Id = Guid.NewGuid(),
            PatientId = relativePatientId,
            TipoConsultaId = consultation.Id,
            FlujoVersion = consultation.Version,
            SolicitantePatientId = me,
            SolicitanteTelefono = requester.Telefono,
            ParentescoPaciente = parentesco,
            Estudio = consultation.Nombre,
            PasoActual = consultation.CheckpointInicial,
            UltimoCanal = Canal
        };

        database.Cases.Add(patientCase);
        database.Events.Add(new CaseEvent
        {
            CaseId = patientCase.Id,
            Canal = Canal,
            TipoEvento = "CASO_CREADO",
            CaseVersion = 1,
            ActorId = me.ToString(),
            ResumenLegible = $"Se inició el caso por WhatsApp. Lo pidió un familiar ({parentesco}).",
            PayloadJson = JsonSerializer.SerializeToElement(new
            {
                pasoActual = patientCase.PasoActual,
                version = 1,
                solicitantePatientId = me,
                parentesco
            })
        });
        await database.SaveChangesAsync(token);

        var checkpoint = CaseCheckpoint.FromCase(patientCase);
        try
        {
            await cache.WarmAsync(CheckpointContext.Saved(checkpoint), token);
        }
        catch (Exception exception) when (CaseCheckpointCache.IsUnavailable(exception))
        {
        }

        return StatusCode(StatusCodes.Status201Created, checkpoint);
    }

    private ObjectResult Locked(ChatbotIdentityAttempts.Estado estado) =>
        StatusCode(StatusCodes.Status423Locked, new
        {
            mensaje = "Demasiados intentos. Intenta más tarde.",
            minutosRestantes = Math.Max(1, (int)Math.Ceiling(estado.TiempoRestante.TotalMinutes))
        });

    private static string PrimerNombre(string nombreCompleto) =>
        nombreCompleto.Split(' ', StringSplitOptions.RemoveEmptyEntries).FirstOrDefault() ?? string.Empty;
    private static DateOnly? FechaDesdeCurp(string curp)
    {
        if (curp.StartsWith("DEMO", StringComparison.Ordinal))
        {
            return null;
        }

        var siglo = char.IsDigit(curp[16]) ? 1900 : 2000;
        return DateOnly.TryParseExact($"{siglo + int.Parse(curp[4..6], CultureInfo.InvariantCulture)}{curp[6..10]}",
            "yyyyMMdd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var fecha)
            ? fecha
            : null;
    }

    [GeneratedRegex(@"^([A-Z][AEIOUX][A-Z]{2}\d{6}[HMX][A-Z]{2}[B-DF-HJ-NP-TV-Z]{3}[A-Z\d]\d|DEMO\d{14})$")]
    private static partial Regex CurpRegex();

    public sealed record IdentityRequest(
        [Required, RegularExpression(@"\+[1-9][0-9]{1,14}")] string Telefono,
        [Required] DateOnly? FechaNacimiento);

    public sealed record RelativeCaseRequest(
        [Required, StringLength(40)] string TipoConsultaId,
        [Required, StringLength(20)] string Parentesco,
        [Required, StringLength(200, MinimumLength = 3)] string NombreCompleto,
        [Required, StringLength(18, MinimumLength = 18)] string Curp);

    public sealed record PendingCase(
        Guid Id,
        Guid PatientId,
        string? TipoConsultaId,
        string PasoActual,
        string Estado,
        string UltimoCanal,
        int Version,
        DateTime UpdatedAt,
        bool ParaMi,
        string? Parentesco);
}
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public sealed class ChatbotKeyAttribute : Attribute, IAuthorizationFilter
{
    public const string Header = "X-Chatbot-Key";

    public void OnAuthorization(AuthorizationFilterContext context)
    {
        var expected = context.HttpContext.RequestServices.GetRequiredService<IConfiguration>()["Chatbot:ApiKey"];
        if (string.IsNullOrWhiteSpace(expected))
        {
            context.Result = new NotFoundResult();
            return;
        }

        var supplied = context.HttpContext.Request.Headers[Header].ToString();
        if (!CryptographicOperations.FixedTimeEquals(
                SHA256.HashData(Encoding.UTF8.GetBytes(expected)),
                SHA256.HashData(Encoding.UTF8.GetBytes(supplied))))
        {
            context.Result = new UnauthorizedResult();
        }
    }
}
