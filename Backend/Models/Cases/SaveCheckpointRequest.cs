using System.ComponentModel.DataAnnotations;

namespace SaludDigna.Backend.Models.Cases;

public sealed class SaveCheckpointRequest
{
    [Required, StringLength(80)]
    public string PasoActual { get; init; } = string.Empty;

    [Required, RegularExpression("WEB|WHATSAPP|CALL_CENTER|APP|CLINICA")]
    public string Canal { get; init; } = string.Empty;

    public CaseProgressData? Datos { get; init; }

    [Range(1, int.MaxValue)]
    public int VersionEsperada { get; init; }
}
