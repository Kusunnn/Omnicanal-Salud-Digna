using System.Text.Json;
using SaludDigna.Backend.Models;

namespace SaludDigna.Backend.Models.Cases;

public sealed record CaseCheckpoint(
    Guid Id,
    Guid PatientId,
    string? TipoConsultaId,
    string PasoActual,
    string Estado,
    string UltimoCanal,
    int Version,
    DateTime UpdatedAt,
    CaseProgressData Datos,
    int FlujoVersion = 1)
{
    internal static CaseCheckpoint FromCase(PatientCase patientCase) => new(
        patientCase.Id, patientCase.PatientId, patientCase.TipoConsultaId, patientCase.PasoActual,
        patientCase.Estado, patientCase.UltimoCanal, patientCase.Version, patientCase.UpdatedAt, ReadData(patientCase),
        patientCase.FlujoVersion);

    private static CaseProgressData ReadData(PatientCase item)
    {
        var data = item.DatosParciales.Deserialize<CaseProgressData>(JsonSerializerOptions.Web)
            ?? new CaseProgressData();
        return data with
        {
            Estudio = item.Estudio ?? data.Estudio,
            Clinica = item.Clinica ?? data.Clinica,
            Parentesco = item.ParentescoPaciente ?? data.Parentesco,
            Fecha = item.FechaCita ?? data.Fecha,
            Horario = item.HorarioCita ?? data.Horario
        };
    }
}
