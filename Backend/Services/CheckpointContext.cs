using SaludDigna.Backend.Models.Cases;

namespace SaludDigna.Backend.Services;

internal sealed record CheckpointContext(
    CaseCheckpoint Checkpoint,
    CheckpointChange[] Changes,
    long FirstPendingAt,
    bool Immediate)
{
    public static CheckpointContext Saved(CaseCheckpoint checkpoint) =>
        new(checkpoint, Array.Empty<CheckpointChange>(), 0, false);
}

internal sealed record CheckpointChange(
    int Version,
    string PasoAnterior,
    string PasoActual,
    string Canal,
    DateTime UpdatedAt,
    string TipoEvento = "CHECKPOINT_GUARDADO",
    string? CanalAnterior = null,
    Guid? InteraccionId = null,
    string? ActorId = null,
    Guid? EventId = null,
    string[]? CamposActualizados = null)
{
    public string Resumen => TipoEvento == "CASO_RETOMADO"
        ? CanalAnterior == Canal ? "Se retomó el caso en el mismo canal." : "Se retomó el caso en otro canal."
        : "Se guardó el avance del caso.";
}
