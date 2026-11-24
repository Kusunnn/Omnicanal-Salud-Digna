using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using SaludDigna.Backend.Data;

namespace SaludDigna.Backend.Controllers;

[ApiController]
[EnableRateLimiting("demo-identity")]
[Route("api/demo/identidad")]
public sealed class DemoIdentityController(
    SaludDignaDbContext database, IWebHostEnvironment environment, IConfiguration configuration) : ControllerBase
{
    [HttpPost("paciente")]
    public async Task<IActionResult> Patient(PatientIdentityRequest request, CancellationToken token)
    {
        if (!environment.IsDevelopment()) return NotFound();

        var curp = request.Curp.Trim().ToUpperInvariant();
        if (!curp.StartsWith("DEMO", StringComparison.Ordinal)) return Unauthorized();

        var patientId = await database.Patients.AsNoTracking()
            .Where(patient => patient.Curp == curp && patient.Telefono == request.Telefono)
            .Select(patient => (Guid?)patient.Id)
            .SingleOrDefaultAsync(token);
        if (patientId is null) return Unauthorized();

        await SignInAsync(patientId.Value.ToString(), "PACIENTE");
        return Ok(new { patientId, rol = "PACIENTE" });
    }

    [HttpPost("personal")]
    public async Task<IActionResult> Staff(StaffIdentityRequest request)
    {
        if (!environment.IsDevelopment()) return NotFound();

        var secret = request.Rol switch
        {
            "ASESOR" => configuration["DemoIdentity:AdvisorKey"],
            "ADMIN" => configuration["DemoIdentity:AdminKey"],
            _ => null
        };

        if (string.IsNullOrWhiteSpace(secret) || !SameSecret(secret, request.Clave)) return Unauthorized();

        await SignInAsync($"demo-{request.Rol.ToLowerInvariant()}", request.Rol);
        return Ok(new { rol = request.Rol });
    }

    private Task SignInAsync(string actor, string role)
    {
        var identity = new ClaimsIdentity(
            [new Claim(ClaimTypes.NameIdentifier, actor), new Claim(ClaimTypes.Role, role)],
            CookieAuthenticationDefaults.AuthenticationScheme);
        return HttpContext.SignInAsync(new ClaimsPrincipal(identity));
    }

    private static bool SameSecret(string expected, string supplied) =>
        CryptographicOperations.FixedTimeEquals(
            SHA256.HashData(Encoding.UTF8.GetBytes(expected)),
            SHA256.HashData(Encoding.UTF8.GetBytes(supplied)));

    public sealed record PatientIdentityRequest(
        [Required, StringLength(18)] string Curp,
        [Required, RegularExpression(@"\+[1-9][0-9]{1,14}")] string Telefono);

    public sealed record StaffIdentityRequest(
        [Required, StringLength(10)] string Rol,
        [Required, StringLength(256)] string Clave);
}
