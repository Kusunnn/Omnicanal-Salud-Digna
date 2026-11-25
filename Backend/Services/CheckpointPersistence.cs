using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using SaludDigna.Backend.Data;
using SaludDigna.Backend.Models;

namespace SaludDigna.Backend.Services;

public sealed class CheckpointPersistence(SaludDignaDbContext database)
{
    internal async Task PersistAsync(IReadOnlyList<CheckpointContext> contexts, CancellationToken token, bool batch = false)
    {
        var ids = contexts.Select(item => item.Checkpoint.Id).ToArray();
        var cases = await database.Cases.Where(item => ids.Contains(item.Id))
            .ToDictionaryAsync(item => item.Id, token);

        foreach (var context in contexts.OrderBy(item => item.Checkpoint.Id))
        {
            var checkpoint = context.Checkpoint;
            if (!cases.TryGetValue(checkpoint.Id, out var patientCase) || patientCase.PatientId != checkpoint.PatientId)
            {
                throw new InvalidOperationException("El caso del checkpoint pendiente ya no está disponible.");
            }

            if (patientCase.Version >= checkpoint.Version)
            {
                continue;
            }

            var changes = context.Changes.Where(change => change.Version > patientCase.Version).ToArray();
            if (changes.Length != checkpoint.Version - patientCase.Version)
            {
                throw new InvalidOperationException("Hay versiones faltantes en el checkpoint pendiente.");
            }

            patientCase.PasoActual = checkpoint.PasoActual;
            patientCase.UltimoCanal = checkpoint.UltimoCanal;
            patientCase.Estado = checkpoint.Estado;
            patientCase.Version = checkpoint.Version;
            patientCase.Estudio = checkpoint.Datos.Estudio;
            patientCase.Clinica = checkpoint.Datos.Clinica;
            patientCase.ParentescoPaciente = checkpoint.Datos.Parentesco;
            patientCase.FechaCita = checkpoint.Datos.Fecha;
            patientCase.HorarioCita = checkpoint.Datos.Horario;
            patientCase.DatosParciales = JsonSerializer.SerializeToElement(
                checkpoint.Datos, JsonSerializerOptions.Web);

            foreach (var change in changes)
            {
                database.Events.Add(new CaseEvent
                {
                    Id = change.EventId ?? Guid.NewGuid(),
                    CaseId = checkpoint.Id,
                    Canal = change.Canal,
                    TipoEvento = change.TipoEvento,
                    ResumenLegible = change.Resumen,
                    InteraccionId = change.InteraccionId,
                    ActorId = change.ActorId,
                    CaseVersion = change.Version,
                    OcurridoAt = change.UpdatedAt,
                    ModoPersistencia = batch ? "LOTE" : "INMEDIATO",
                    PayloadJson = SerializeChange(change)
                });
            }
        }

        await database.SaveChangesAsync(token);
    }

    internal static JsonElement SerializeChange(CheckpointChange change) =>
        JsonSerializer.SerializeToElement(new
        {
            pasoAnterior = change.PasoAnterior,
            pasoActual = change.PasoActual,
            canalAnterior = change.CanalAnterior,
            camposActualizados = change.CamposActualizados,
            version = change.Version
        });
}
