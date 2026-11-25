using System.ComponentModel.DataAnnotations;

namespace SaludDigna.Backend.Models.Cases;

public sealed class CreateCaseRequest
{
    [Required, StringLength(40)]
    public string TipoConsultaId { get; init; } = string.Empty;

    public Guid? SolicitantePatientId { get; init; }

    [RegularExpression(@"\+[1-9][0-9]{1,14}")]
    public string? SolicitanteTelefono { get; init; }

    public CaseProgressData? Datos { get; init; }

    public DateOnly? FechaNacimiento { get; init; }

    [Required, RegularExpression("WEB|WHATSAPP|CALL_CENTER|APP|CLINICA")]
    public string Canal { get; init; } = string.Empty;
}
