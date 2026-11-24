using Microsoft.EntityFrameworkCore;
using SaludDigna.Backend.Data;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllersWithViews();
builder.Services.AddHealthChecks();
builder.Services.AddDbContext<SaludDignaDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("SaludDigna")));

var app = builder.Build();

app.MapHealthChecks("/health");
app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");

app.Run();
