using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.EntityFrameworkCore;
using SaludDigna.Backend.Data;
using SaludDigna.Backend.Health;
using SaludDigna.Backend.Services;
using StackExchange.Redis;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllersWithViews();
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme).AddCookie(options =>
{
    options.Cookie.Name = "salud-digna-session";
    options.Cookie.HttpOnly = true;
    options.Cookie.SameSite = SameSiteMode.Strict;
    options.Cookie.SecurePolicy = builder.Environment.IsDevelopment()
        ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always;
    options.ExpireTimeSpan = TimeSpan.FromMinutes(30);
    options.Events.OnRedirectToLogin = context =>
    {
        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
        return Task.CompletedTask;
    };
    options.Events.OnRedirectToAccessDenied = context =>
    {
        context.Response.StatusCode = StatusCodes.Status403Forbidden;
        return Task.CompletedTask;
    };
});
builder.Services.AddAuthorization();
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("demo-identity", context => RateLimitPartition.GetFixedWindowLimiter(
        context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 20, Window = TimeSpan.FromMinutes(1) }));
});
builder.Services.AddSingleton<CaseCheckpointCache>();
builder.Services.AddMemoryCache();
builder.Services.AddSingleton<ChatbotIdentityAttempts>();
builder.Services.AddScoped<CheckpointPersistence>();
builder.Services.AddOptions<CheckpointSyncOptions>()
    .BindConfiguration("CheckpointSync")
    .Validate(options => options.IdleWindow > TimeSpan.Zero
        && options.MaximumWindow >= options.IdleWindow
        && options.PollInterval > TimeSpan.Zero, "Ventanas de checkpoints inválidas.")
    .ValidateOnStart();
var healthChecks = builder.Services.AddHealthChecks();
builder.Services.AddDbContext<SaludDignaDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("SaludDigna")));

const string redisHealthCheck = "redis";
var redisConnection = builder.Configuration.GetConnectionString("Redis");

if (!string.IsNullOrWhiteSpace(redisConnection))
{
    builder.Services.AddSingleton<IConnectionMultiplexer>(_ =>
    {
        var options = ConfigurationOptions.Parse(redisConnection);
        options.AbortOnConnectFail = false;
        options.BacklogPolicy = BacklogPolicy.FailFast;
        options.ConnectTimeout = 1000;
        options.AsyncTimeout = 500;
        return ConnectionMultiplexer.Connect(options);
    });
    builder.Services.AddHostedService<CheckpointSyncWorker>();

    healthChecks.AddCheck<RedisHealthCheck>(redisHealthCheck, timeout: TimeSpan.FromSeconds(5));
}

var app = builder.Build();

app.UseRouting();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

app.MapHealthChecks("/health", new HealthCheckOptions { Predicate = _ => false });

if (!string.IsNullOrWhiteSpace(redisConnection))
{
    app.MapHealthChecks("/health/redis", new HealthCheckOptions
    {
        Predicate = check => check.Name == redisHealthCheck
    });
}

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");

app.Run();
