using System.Text.Json;

namespace SaludDigna.Backend.Models.Cases;

public sealed record CaseTimelineEvent(
    Guid Id, Guid CaseId, int? Version, string Canal, string TipoEvento, string Resumen,
    DateTime OcurridoAt, DateTime? RegistradoAt, string? ModoPersistencia, JsonElement Datos);
