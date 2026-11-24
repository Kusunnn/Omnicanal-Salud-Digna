namespace SaludDigna.Backend.Models;

public sealed class Patient
{
    public Guid Id { get; init; }
    public required string NombreCompleto { get; set; }
    public required string Telefono { get; set; }
    public string? Curp { get; set; }
    public string? Correo { get; set; }
    public DateTime CreatedAt { get; private set; }
}
