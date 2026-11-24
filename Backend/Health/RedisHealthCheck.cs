using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace SaludDigna.Backend.Health;

internal sealed class RedisHealthCheck(IDistributedCache cache) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        // A missing key is expected. A successful read confirms Redis is reachable.
        await cache.GetAsync("health:probe", cancellationToken);
        return HealthCheckResult.Healthy();
    }
}
