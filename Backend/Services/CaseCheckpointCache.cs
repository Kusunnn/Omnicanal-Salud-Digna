using System.Text.Json;
using StackExchange.Redis;

namespace SaludDigna.Backend.Services;

public sealed class CaseCheckpointCache(IConnectionMultiplexer? connection = null)
{
    private const string DueKey = "salud-digna:ctx:due";
    private static readonly TimeSpan OperationTimeout = TimeSpan.FromMilliseconds(500);
    private readonly IDatabase? redis = connection?.GetDatabase();

    private const string StageScript = """
        local current = redis.call('GET', KEYS[1])
        if current then
            local state = cjson.decode(current)
            if state.Checkpoint.Version ~= tonumber(ARGV[1]) or state.Immediate then
                return 0
            end
        elseif ARGV[6] == '1' then
            return 0
        end
        local time = redis.call('TIME')
        local now = tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000)
        local payload = cjson.decode(ARGV[2])
        local first = now
        if current then
            local old = cjson.decode(current)
            if old.FirstPendingAt > 0 then first = old.FirstPendingAt end
        end
        payload.FirstPendingAt = first
        local due = math.min(now + tonumber(ARGV[3]), first + tonumber(ARGV[4]))
        if ARGV[5] == '1' then due = now + 5000 end
        redis.call('SET', KEYS[1], cjson.encode(payload))
        redis.call('ZADD', KEYS[2], due, KEYS[1])
        return 1
        """;

    private const string ConfirmScript = """
        local value = redis.call('GET', KEYS[1])
        if not value or cjson.decode(value).Checkpoint.Version ~= tonumber(ARGV[1]) then
            return 0
        end
        redis.call('SET', KEYS[1], ARGV[2], 'EX', 1800)
        redis.call('ZREM', KEYS[2], KEYS[1])
        return 1
        """;

    private const string DueScript = """
        local time = redis.call('TIME')
        local now = tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000)
        local entries = redis.call('ZRANGEBYSCORE', KEYS[1], '-inf', now, 'LIMIT', 0, ARGV[1])
        local payloads = {}
        for _, key in ipairs(entries) do
            local entry = redis.call('GET', key)
            if entry then
                table.insert(payloads, entry)
                redis.call('ZADD', KEYS[1], now + 15000, key)
            else
                redis.call('ZREM', KEYS[1], key)
            end
        end
        return payloads
        """;

    public bool IsConfigured => redis is not null;

    internal async Task<CheckpointContext?> GetAsync(Guid patientId, Guid caseId, CancellationToken token)
    {
        var contexts = await GetManyAsync(patientId, new[] { caseId }, token);
        return contexts.FirstOrDefault();
    }

    internal Task<IReadOnlyList<CheckpointContext>> GetManyAsync(
        Guid patientId, IReadOnlyCollection<Guid> caseIds, CancellationToken token) =>
        GetManyAsync(caseIds.Select(id => (patientId, id)).ToArray(), token);

    internal async Task<IReadOnlyList<CheckpointContext>> GetManyAsync(
        IReadOnlyCollection<(Guid PatientId, Guid CaseId)> cases, CancellationToken token)
    {
        if (redis is null || cases.Count == 0)
        {
            return Array.Empty<CheckpointContext>();
        }

        var values = await redis.StringGetAsync(cases.Select(item => Key(item.PatientId, item.CaseId)).ToArray())
            .WaitAsync(OperationTimeout, token);
        return values.Where(value => value.HasValue).Select(value => Deserialize(value.ToString())).ToArray();
    }

    internal async Task WarmAsync(CheckpointContext context, CancellationToken token)
    {
        if (redis is not null)
        {
            await redis.StringSetAsync(Key(context.Checkpoint.PatientId, context.Checkpoint.Id),
                    JsonSerializer.Serialize(context), TimeSpan.FromMinutes(30), When.NotExists)
                .WaitAsync(OperationTimeout, token);
        }
    }

    internal async Task<bool> StageAsync(
        CheckpointContext current, CheckpointContext next, CheckpointSyncOptions options, CancellationToken token)
    {
        var result = await Database.ScriptEvaluateAsync(StageScript,
                new[] { Key(next.Checkpoint.PatientId, next.Checkpoint.Id), (RedisKey)DueKey },
                new RedisValue[] { current.Checkpoint.Version, JsonSerializer.Serialize(next),
                    (long)options.IdleWindow.TotalMilliseconds, (long)options.MaximumWindow.TotalMilliseconds,
                    next.Immediate ? 1 : 0, current.FirstPendingAt > 0 ? 1 : 0 })
            .WaitAsync(OperationTimeout, token);
        return (int)result == 1;
    }

    internal async Task<IReadOnlyList<CheckpointContext>> ClaimDueAsync(int count, CancellationToken token)
    {
        var result = await Database.ScriptEvaluateAsync(DueScript,
                new RedisKey[] { DueKey }, new RedisValue[] { count })
            .WaitAsync(OperationTimeout, token);
        return ((RedisResult[])result!).Select(value => Deserialize(value.ToString())).ToArray();
    }

    internal async Task ConfirmAsync(CheckpointContext context, CancellationToken token)
    {
        var checkpoint = context.Checkpoint;
        await Database.ScriptEvaluateAsync(ConfirmScript,
                new[] { Key(checkpoint.PatientId, checkpoint.Id), (RedisKey)DueKey },
                new RedisValue[] { checkpoint.Version, JsonSerializer.Serialize(CheckpointContext.Saved(checkpoint)) })
            .WaitAsync(OperationTimeout, token);
    }

    internal static bool IsUnavailable(Exception exception) => exception is RedisException or TimeoutException;

    private IDatabase Database => redis ?? throw new InvalidOperationException("Redis no está configurado.");

    private static RedisKey Key(Guid patientId, Guid caseId) =>
        $"salud-digna:ctx:case:{{{patientId:N}}}:{caseId:N}";

    private static CheckpointContext Deserialize(string value) =>
        JsonSerializer.Deserialize<CheckpointContext>(value)
        ?? throw new JsonException("Contexto de checkpoint inválido.");
}
