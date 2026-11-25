using System.Text.Json;
using System.Text.Json.Serialization;
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
    [property: JsonConverter(typeof(UpdatedFieldsConverter))]
    string[]? CamposActualizados = null)
{
    public string Resumen => TipoEvento == "CASO_RETOMADO"
        ? CanalAnterior == Canal ? "Se retomó el caso en el mismo canal." : "Se retomó el caso en otro canal."
        : "Se guardó el avance del caso.";
}

internal sealed class UpdatedFieldsConverter : JsonConverter<string[]>
{
    public override string[]? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType != JsonTokenType.StartObject)
        {
            return JsonSerializer.Deserialize<string[]>(ref reader, options);
        }

        if (!reader.Read() || reader.TokenType != JsonTokenType.EndObject)
        {
            throw new JsonException("CamposActualizados debe ser una lista o un objeto vacío.");
        }

        return Array.Empty<string>();
    }

    public override void Write(Utf8JsonWriter writer, string[] value, JsonSerializerOptions options)
    {
        if (value.Length == 0)
        {
            writer.WriteNullValue();
            return;
        }

        JsonSerializer.Serialize(writer, value, options);
    }
}
