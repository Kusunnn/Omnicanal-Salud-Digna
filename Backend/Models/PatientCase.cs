using System.Text.Json;

namespace SaludDigna.Backend.Models;

public sealed class PatientCase
{
    public Guid Id { get; init; }
    public required Guid PatientId { get; init; }
    public string? Estudio { get; set; }
    public string? Clinica { get; set; }
    public required string PasoActual { get; set; }
    public string Estado { get; set; } = "EN_PROGRESO";
    public required string UltimoCanal { get; set; }
    public JsonElement DatosParciales { get; set; } = JsonSerializer.SerializeToElement(new { });
    public DateTime UpdatedAt { get; private set; }
}
