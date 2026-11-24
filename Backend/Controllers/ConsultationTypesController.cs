using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Mvc;
using SaludDigna.Backend.Models.Consultations;

namespace SaludDigna.Backend.Controllers;

[ApiController]
[Route("api/tipos-consulta")]
public sealed class ConsultationTypesController : ControllerBase
{
    [HttpGet]
    public ActionResult<IReadOnlyList<ConsultationType>> Get(
        [FromQuery, RegularExpression("WEB|WHATSAPP|CALL_CENTER|APP|CLINICA")] string? canal = null)
    {
        return Ok(ConsultationCatalog.Types);
    }
}
