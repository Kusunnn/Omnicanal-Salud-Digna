using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.EntityFrameworkCore;
using SaludDigna.Backend.Data;
using SaludDigna.Backend.Health;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllersWithViews();
var healthChecks = builder.Services.AddHealthChecks();
builder.Services.AddDbContext<SaludDignaDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("SaludDigna")));

const string redisHealthCheck = "redis";
var redisConnection = builder.Configuration.GetConnectionString("Redis");

if (!string.IsNullOrWhiteSpace(redisConnection))
{
    builder.Services.AddStackExchangeRedisCache(options =>
    {
        options.Configuration = redisConnection;
        options.InstanceName = "salud-digna:";
    });

    healthChecks.AddCheck<RedisHealthCheck>(redisHealthCheck, timeout: TimeSpan.FromSeconds(5));
}

var app = builder.Build();

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
