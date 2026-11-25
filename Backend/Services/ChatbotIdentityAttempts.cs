using Microsoft.Extensions.Caching.Memory;
using StackExchange.Redis;

namespace SaludDigna.Backend.Services;
public sealed class ChatbotIdentityAttempts(IMemoryCache memory, IConnectionMultiplexer? redis = null)
{
    public const int MaxIntentos = 3;
    public static readonly TimeSpan Bloqueo = TimeSpan.FromMinutes(15);
    private static readonly TimeSpan OperationTimeout = TimeSpan.FromMilliseconds(500);
    private readonly object sync = new();

    public sealed record Estado(bool Bloqueado, int IntentosRestantes, TimeSpan TiempoRestante);

    public async Task<Estado> GetAsync(string telefono, CancellationToken token)
    {
        if (redis is not null)
        {
            try
            {
                var database = redis.GetDatabase();
                var value = await database.StringGetAsync(Key(telefono)).WaitAsync(OperationTimeout, token);
                var ttl = await database.KeyTimeToLiveAsync(Key(telefono)).WaitAsync(OperationTimeout, token);
                return ToEstado(value.HasValue ? (int)value : 0, ttl ?? TimeSpan.Zero);
            }
            catch (Exception exception) when (CaseCheckpointCache.IsUnavailable(exception))
            {
            }
        }

        lock (sync)
        {
            return memory.TryGetValue(Key(telefono), out Entrada? entrada) && entrada is not null
                ? ToEstado(entrada.Fallos, entrada.Expira - DateTimeOffset.UtcNow)
                : ToEstado(0, TimeSpan.Zero);
        }
    }

    public async Task<Estado> RegisterFailureAsync(string telefono, CancellationToken token)
    {
        if (redis is not null)
        {
            try
            {
                var database = redis.GetDatabase();
                var fallos = await database.StringIncrementAsync(Key(telefono)).WaitAsync(OperationTimeout, token);
                await database.KeyExpireAsync(Key(telefono), Bloqueo).WaitAsync(OperationTimeout, token);
                return ToEstado((int)fallos, Bloqueo);
            }
            catch (Exception exception) when (CaseCheckpointCache.IsUnavailable(exception))
            {
            }
        }

        lock (sync)
        {
            var fallos = memory.TryGetValue(Key(telefono), out Entrada? entrada) && entrada is not null
                ? entrada.Fallos + 1
                : 1;
            var expira = DateTimeOffset.UtcNow.Add(Bloqueo);
            memory.Set(Key(telefono), new Entrada(fallos, expira), expira);
            return ToEstado(fallos, Bloqueo);
        }
    }

    public async Task ResetAsync(string telefono, CancellationToken token)
    {
        lock (sync)
        {
            memory.Remove(Key(telefono));
        }

        if (redis is null)
        {
            return;
        }

        try
        {
            await redis.GetDatabase().KeyDeleteAsync(Key(telefono)).WaitAsync(OperationTimeout, token);
        }
        catch (Exception exception) when (CaseCheckpointCache.IsUnavailable(exception))
        {
        }
    }

    private static Estado ToEstado(int fallos, TimeSpan restante) =>
        new(fallos >= MaxIntentos, Math.Max(MaxIntentos - fallos, 0),
            restante > TimeSpan.Zero ? restante : TimeSpan.Zero);

    private static string Key(string telefono) => $"chatbot:identidad:{telefono}";

    private sealed record Entrada(int Fallos, DateTimeOffset Expira);
}
