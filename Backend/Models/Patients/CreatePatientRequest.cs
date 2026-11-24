using System.ComponentModel.DataAnnotations;

namespace SaludDigna.Backend.Models.Patients;

public sealed class CreatePatientRequest
{
    [Required]
    [StringLength(200)]
    public string NombreCompleto { get; init; } = string.Empty;

    [Required]
    [RegularExpression(@"\+[1-9][0-9]{1,14}", ErrorMessage = "Usa el formato internacional, por ejemplo +525500000000.")]
    public string Telefono { get; init; } = string.Empty;

    [Required]
    [StringLength(18)]
    public string Curp { get; init; } = string.Empty;

    public DateOnly? FechaNacimiento { get; init; }

    [StringLength(100)]
    public string? LugarNacimiento { get; init; }

    [RegularExpression("H|M|X")]
    public string? Sexo { get; init; }
}
