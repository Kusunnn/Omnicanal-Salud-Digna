using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Mvc;
using SaludDigna.Backend.Models.Consultations;

namespace SaludDigna.Backend.Controllers;

[ApiController]
[Route("api/tipos-consulta")]
public sealed class ConsultationTypesController : ControllerBase
{
    internal const string LegacyClinic = "Clínica Demo";
    private static readonly ClinicOption[] Clinics =
    [
        new("chihuahua-nueva-espana", "Chihuahua Nueva España"),
        new("culiacan-centro", "Culiacán Centro"),
        new("clinica-demo", LegacyClinic)
    ];

    [HttpGet("/api/clinicas")]
    public ActionResult<IReadOnlyList<ClinicOption>> GetClinics() => Ok(Clinics);

    [HttpGet("/api/horarios")]
    public ActionResult<IReadOnlyList<string>> GetTimes() => Ok(new[] { "08:00", "09:30", "11:00" });

    public sealed record ClinicOption(string Id, string Nombre);

    [HttpGet]
    public ActionResult<IReadOnlyList<ConsultationType>> Get(
        [FromQuery, RegularExpression("WEB|WHATSAPP|CALL_CENTER|APP|CLINICA")] string? canal = null)
    {
        return Ok(ConsultationCatalog.Types);
    }
}
