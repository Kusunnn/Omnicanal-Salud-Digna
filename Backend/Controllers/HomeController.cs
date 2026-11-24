using Microsoft.AspNetCore.Mvc;
using SaludDigna.Backend.Models;

namespace SaludDigna.Backend.Controllers;

public sealed class HomeController : Controller
{
    [HttpGet]
    public IActionResult Index()
    {
        return View(new HomeViewModel("Salud Digna"));
    }
}
