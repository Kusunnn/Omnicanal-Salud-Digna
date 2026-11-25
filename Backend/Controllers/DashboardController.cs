using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SaludDigna.Backend.Data;
using SaludDigna.Backend.Models.Cases;
using SaludDigna.Backend.Services;

namespace SaludDigna.Backend.Controllers;

[ApiController]
[Authorize(Roles = "ASESOR,ADMIN")]
[Route("api/tablero/casos")]
[ResponseCache(NoStore = true)]
public sealed class DashboardController(SaludDignaDbContext database, CaseCheckpointCache cache) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<CaseCheckpoint>>> Get(
        CancellationToken token, [FromQuery, Range(1, 100)] int limite = 30)
    {
        var cases = await database.Cases.AsNoTracking().Where(item => item.ArchivedAt == null)
            .OrderByDescending(item => item.UpdatedAt).ThenByDescending(item => item.Id)
            .Take(limite).ToListAsync(token);
        var confirmed = cases.Select(CaseCheckpoint.FromCase).ToArray();
        IReadOnlyList<CheckpointContext> contexts;
        try
        {
            contexts = await cache.GetManyAsync(cases.Select(item => (item.PatientId, item.Id)).ToArray(), token);
        }
        catch (Exception exception) when (CaseCheckpointCache.IsUnavailable(exception))
        {
            return Ok(confirmed);
        }

        var active = contexts.Where(item => !item.Immediate)
            .ToDictionary(item => item.Checkpoint.Id, item => item.Checkpoint);
        return Ok(confirmed.Select(item =>
                active.TryGetValue(item.Id, out var pending) && pending.Version > item.Version ? pending : item)
            .OrderByDescending(item => item.UpdatedAt).ThenByDescending(item => item.Id).ToArray());
    }
}
