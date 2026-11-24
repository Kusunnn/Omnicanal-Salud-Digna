namespace SaludDigna.Backend.Models.Patients;

public sealed record PatientResponse(Guid Id, string NombreCompleto, DateTime CreatedAt);
