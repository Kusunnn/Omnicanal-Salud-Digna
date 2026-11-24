using System.ComponentModel.DataAnnotations;

namespace SaludDigna.Backend.Models.Cases;

public sealed record CaseProgressData(
    [StringLength(80)] string? Parentesco = null,
    [StringLength(180)] string? Estudio = null,
    [StringLength(180)] string? Clinica = null,
    DateOnly? Fecha = null,
    TimeOnly? Horario = null)
{
    internal CaseProgressData Merge(CaseProgressData? changes) => changes is null ? this : new(
        changes.Parentesco ?? Parentesco, changes.Estudio ?? Estudio, changes.Clinica ?? Clinica,
        changes.Fecha ?? Fecha, changes.Horario ?? Horario);
}
