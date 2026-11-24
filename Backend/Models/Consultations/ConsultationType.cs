namespace SaludDigna.Backend.Models.Consultations;

public sealed record ConsultationType(
    string Id,
    string Nombre,
    string CheckpointInicial,
    IReadOnlyList<ConsultationCheckpoint> Checkpoints,
    int Version = 1);
