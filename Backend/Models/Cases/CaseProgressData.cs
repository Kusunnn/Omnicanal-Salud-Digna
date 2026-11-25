using System.ComponentModel.DataAnnotations;

namespace SaludDigna.Backend.Models.Cases;

public sealed record CaseProgressData(
    [StringLength(80)] string? Parentesco = null,
    [StringLength(180)] string? Estudio = null,
    [StringLength(180)] string? Clinica = null,
    DateOnly? Fecha = null,
    TimeOnly? Horario = null,
    RegistrationDraft? Prerregistro = null)
{
    internal CaseProgressData Merge(CaseProgressData? changes) => changes is null ? this : new(
        changes.Parentesco ?? Parentesco, changes.Estudio ?? Estudio, changes.Clinica ?? Clinica,
        changes.Fecha ?? Fecha, changes.Horario ?? Horario, changes.Prerregistro ?? Prerregistro);
}

public sealed record RegistrationDraft(
    [StringLength(100)] string? Nombres = null,
    [StringLength(100)] string? ApellidoPaterno = null,
    [StringLength(100)] string? ApellidoMaterno = null,
    DateOnly? Nacimiento = null,
    [RegularExpression("^(Mujer|Hombre)$")] string? Sexo = null,
    [StringLength(254)] string? Correo = null,
    [StringLength(32)] string? Whatsapp = null);
