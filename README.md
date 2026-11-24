# OmniCanal Salud Digna

Backend en C# con ASP.NET Core MVC y .NET 10. PostgreSQL guarda pacientes, casos y eventos. Redis está conectado como caché distribuida. Las consultas de negocio todavía no usan la caché.

## 1. Instala los requisitos en Windows

- **SDK de .NET 10.** Instala el SDK y verifica la versión con `dotnet --list-sdks`. [Descargar .NET 10](https://dotnet.microsoft.com/download/dotnet/10.0)
- **PostgreSQL.** Usa el instalador para Windows. Conserva el puerto `5432` si está libre y guarda la contraseña que elijas para el usuario `postgres`. El instalador incluye pgAdmin. Si ya tienes una instancia local de PostgreSQL, puedes usarla. [Instalador de PostgreSQL para Windows](https://www.postgresql.org/download/windows/)
- **Docker Desktop**, si vas a ejecutar Redis localmente. Inícialo con contenedores Linux. El backend puede arrancar mientras Redis está apagado. [Redis en Docker](https://redis.io/docs/latest/operate/oss_and_stack/install/install-stack/docker/)

Abre PowerShell en la carpeta del repositorio que contiene `Backend` y `dotnet-tools.json`. Restaura la herramienta local de EF Core y los paquetes NuGet:

```powershell
dotnet tool restore
dotnet restore Backend
```

La restauración instala las dependencias del proyecto, incluidas Entity Framework Core, Npgsql y el proveedor de caché Redis.

## 2. Configura User Secrets

El proyecto ya tiene un `UserSecretsId`. Ejecuta estos comandos para crear el archivo con una cadena de ejemplo y abrirlo en el Bloc de notas. Si ya configuraste la conexión, conserva la cadena existente y abre el archivo directamente.

```powershell
dotnet user-secrets set "ConnectionStrings:SaludDigna" "Host=localhost;Port=5432;Database=Salud Digna;Username=postgres;Password=TU_CONTRASEÑA" --project Backend

[xml]$project = Get-Content -Raw '.\Backend\SaludDigna.Backend.csproj'
$secretsId = $project.SelectSingleNode('//UserSecretsId').InnerText
notepad (Join-Path $env:APPDATA "Microsoft\UserSecrets\$secretsId\secrets.json")
```

En el archivo, sustituye `TU_CONTRASEÑA` por la contraseña de PostgreSQL. Ajusta también `Username` o `Port` si tu instancia usa otros valores. El archivo queda fuera del repositorio, en `%APPDATA%\Microsoft\UserSecrets\<UserSecretsId>\secrets.json`. [User Secrets en ASP.NET Core](https://learn.microsoft.com/es-es/aspnet/core/security/app-secrets?tabs=windows&view=aspnetcore-10.0)

## 3. Crea la base y aplica la migración

Con PostgreSQL en marcha, ejecuta en PowerShell:

```powershell
$env:DOTNET_ENVIRONMENT = 'Development'
dotnet build Backend
dotnet tool run dotnet-ef database update --project Backend --no-build
```

EF Core crea la base `Salud Digna` si aún no existe y aplica la migración que crea `patients`, `cases` y `events`. Si usas un rol con permisos limitados, pide al administrador de PostgreSQL que cree la base y le conceda permisos para aplicar las migraciones. Puedes verificar las tablas en pgAdmin bajo **Databases → Salud Digna → Schemas → public → Tables**.

## 4. Inicia Redis

Con Docker Desktop abierto, crea el contenedor una sola vez. El puerto queda publicado en la interfaz local de Windows:

```powershell
docker run -d --name salud-digna-redis -p 127.0.0.1:6379:6379 redis:8
docker exec salud-digna-redis redis-cli ping
```

La segunda orden debe devolver `PONG`. Si el contenedor ya existe, enciéndelo con `docker start salud-digna-redis`. Para apagarlo, ejecuta `docker stop salud-digna-redis`. La configuración de desarrollo usa `127.0.0.1:6379`. Si tu instancia usa otra dirección o requiere credenciales, guarda la conexión en User Secrets con la clave `ConnectionStrings:Redis`.

## 5. Arranca y verifica el backend

```powershell
dotnet run --project Backend
```

- [Página inicial](http://localhost:5080/) muestra la vista MVC.
- [Salud del backend](http://localhost:5080/health) confirma que el proceso responde.
- [Salud de Redis](http://localhost:5080/health/redis) devuelve HTTP 200 si Redis responde y HTTP 503 si está apagado o no se puede conectar.

Para detener el backend, pulsa **Ctrl+C** en la terminal. Si el puerto HTTP `5080` está ocupado, puedes arrancar con `dotnet run --project Backend -- --urls http://localhost:5081` y abrir las mismas rutas en `5081`.
