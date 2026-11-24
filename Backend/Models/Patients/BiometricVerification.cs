namespace SaludDigna.Backend.Models;

public sealed class BiometricVerification
{
    public Guid Id { get; init; }
    public required Guid PatientId { get; init; }
    public required string Proveedor { get; init; }
    public required string ReferenciaExterna { get; init; }
    public DateTime VerificadaAt { get; init; }
    public DateTime? RevocadaAt { get; set; }
}
