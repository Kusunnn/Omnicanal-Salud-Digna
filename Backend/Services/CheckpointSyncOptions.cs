namespace SaludDigna.Backend.Services;

public sealed class CheckpointSyncOptions
{
    public TimeSpan IdleWindow { get; init; } = TimeSpan.FromMinutes(5);
    public TimeSpan MaximumWindow { get; init; } = TimeSpan.FromMinutes(10);
    public TimeSpan PollInterval { get; init; } = TimeSpan.FromSeconds(5);
}
