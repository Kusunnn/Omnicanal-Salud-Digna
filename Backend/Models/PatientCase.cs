using System.Text.Json;

namespace SaludDigna.Backend.Models;

public sealed class PatientCase
{
    public Guid Id { get; init; }
    public required Guid PatientId { get; init; }
    public string? TipoConsultaId { get; init; }
    public int FlujoVersion { get; init; } = 1;
    public Guid? SolicitantePatientId { get; init; }
    public string? SolicitanteTelefono { get; init; }
    public string? ParentescoPaciente { get; set; }
    public DateOnly? FechaCita { get; set; }
    public TimeOnly? HorarioCita { get; set; }
    public DateTime? InicioCitaAt { get; set; }
    public DateTime CreatedAt { get; private set; }
    public int Version { get; set; } = 1;
    public string? Estudio { get; set; }
    public string? Clinica { get; set; }
    public required string PasoActual { get; set; }
    public string Estado { get; set; } = "EN_PROGRESO";
    public required string UltimoCanal { get; set; }
    public JsonElement DatosParciales { get; set; } = JsonSerializer.SerializeToElement(new { });
    public DateTime UpdatedAt { get; private set; }
}
