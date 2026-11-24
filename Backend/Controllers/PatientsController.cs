using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SaludDigna.Backend.Data;
using SaludDigna.Backend.Models;
using SaludDigna.Backend.Models.Patients;

namespace SaludDigna.Backend.Controllers;

[ApiController]
[Route("api/pacientes")]
public sealed class PatientsController(SaludDignaDbContext database) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<PatientResponse>>> Get(
        CancellationToken cancellationToken,
        [FromQuery, Range(1, 100)] int limite = 25)
    {
        var patients = await database.Patients
            .AsNoTracking()
            .OrderByDescending(patient => patient.CreatedAt)
            .ThenByDescending(patient => patient.Id)
            .Take(limite)
            .Select(patient => new PatientResponse(patient.Id, patient.NombreCompleto, patient.CreatedAt))
            .ToListAsync(cancellationToken);

        return Ok(patients);
    }

    [HttpPost]
    public async Task<ActionResult<PatientResponse>> Post(
        CreatePatientRequest request,
        CancellationToken cancellationToken)
    {
        var patient = new Patient
        {
            NombreCompleto = request.NombreCompleto.Trim(),
            Telefono = request.Telefono,
            Curp = request.Curp.Trim(),
            FechaNacimiento = request.FechaNacimiento,
            LugarNacimiento = request.LugarNacimiento?.Trim(),
            Sexo = request.Sexo?.Trim()
        };

        database.Patients.Add(patient);
        await database.SaveChangesAsync(cancellationToken);

        var response = new PatientResponse(patient.Id, patient.NombreCompleto, patient.CreatedAt);
        return StatusCode(StatusCodes.Status201Created, response);
    }
}
