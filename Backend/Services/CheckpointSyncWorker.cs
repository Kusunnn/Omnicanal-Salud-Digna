using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Npgsql;

namespace SaludDigna.Backend.Services;

internal sealed class CheckpointSyncWorker(
    CaseCheckpointCache cache,
    IServiceScopeFactory scopes,
    IOptions<CheckpointSyncOptions> options,
    ILogger<CheckpointSyncWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(options.Value.PollInterval);
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                const int batchSize = 100;
                while (!stoppingToken.IsCancellationRequested)
                {
                    var due = await cache.ClaimDueAsync(batchSize, stoppingToken);
                    if (due.Count == 0)
                    {
                        break;
                    }

                    await using var scope = scopes.CreateAsyncScope();
                    var persistence = scope.ServiceProvider.GetRequiredService<CheckpointPersistence>();
                    await persistence.PersistAsync(due, stoppingToken, batch: true);
                    foreach (var context in due)
                    {
                        await cache.ConfirmAsync(context, stoppingToken);
                    }

                    if (due.Count < batchSize)
                    {
                        break;
                    }
                }
            }
            catch (DbUpdateConcurrencyException)
            {
            }
            catch (Exception exception) when (CaseCheckpointCache.IsUnavailable(exception)
                || exception is DbUpdateException or NpgsqlException or InvalidOperationException)
            {
                logger.LogWarning("Sincronización de checkpoints pendiente ({ErrorType}).", exception.GetType().Name);
            }
        }
    }
}
