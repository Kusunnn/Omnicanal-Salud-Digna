using System.ComponentModel.DataAnnotations;

namespace SaludDigna.Backend.Models.Cases;

public sealed class ResumeCaseRequest
{
    [Required, RegularExpression("WEB|WHATSAPP|CALL_CENTER|APP|CLINICA")]
    public string Canal { get; init; } = string.Empty;

    [Range(1, int.MaxValue)]
    public int VersionEsperada { get; init; }

    public Guid InteraccionId { get; init; }
}
