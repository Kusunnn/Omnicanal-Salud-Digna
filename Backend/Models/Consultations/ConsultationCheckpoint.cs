namespace SaludDigna.Backend.Models.Consultations;

public sealed record ConsultationCheckpoint(
    string Id,
    string Nombre,
    IReadOnlyList<string> Siguientes,
    bool GuardadoInmediato = false);
