using System.Text.Json;

namespace SaludDigna.Backend.Models;

public sealed class CaseEvent
{
    public Guid Id { get; init; }
    public required Guid CaseId { get; init; }
    public required string Canal { get; init; }
    public required string TipoEvento { get; init; }
    public required string ResumenLegible { get; init; }
    public JsonElement PayloadJson { get; init; } = JsonSerializer.SerializeToElement(new { });
    public DateTime OcurridoAt { get; init; } = DateTime.UtcNow;
    public int? CaseVersion { get; init; }
    public Guid? InteraccionId { get; init; }
    public string? ActorId { get; init; }
    public string ModoPersistencia { get; init; } = "INMEDIATO";
    public DateTime CreatedAt { get; private set; }
}
