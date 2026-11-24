namespace SaludDigna.Backend.Models;

public sealed class Patient
{
    public Guid Id { get; init; }
    public required string NombreCompleto { get; set; }
    public required string Telefono { get; set; }
    public required string Curp { get; set; }
    public DateOnly? FechaNacimiento { get; set; }
    public string? LugarNacimiento { get; set; }
    public string? Sexo { get; set; }
    public string? Correo { get; set; }
    public string NivelIdentidad { get; private set; } = "BASICO";
    public DateTime? CurpValidadaAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }
    public DateTime CreatedAt { get; private set; }
}
