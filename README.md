# OmniCanal Salud Digna

Backend en C# con ASP.NET Core MVC y .NET 10. PostgreSQL almacena pacientes, casos y eventos. Redis está integrado como caché distribuida y ya tiene una comprobación de conectividad. Las consultas de negocio aún no usan la caché.

## 1. Instala los requisitos

- SDK de .NET 10. Comprueba que esté instalado con `dotnet --list-sdks`.
- PostgreSQL. El proyecto se ha probado con PostgreSQL 14.
- Redis para probar la caché distribuida. El backend puede arrancar mientras Redis está apagado.

En macOS con Homebrew, instala solo los servicios que te falten:

```bash
brew install postgresql@14 redis
```

Si ya tienes PostgreSQL escuchando en `localhost:5432`, puedes usar esa instancia. Para iniciar la instalación de Homebrew cuando la necesites:

```bash
brew services start postgresql@14
brew services run redis
```

`brew services run redis` lo inicia para esta sesión. Puedes apagarlo con `brew services stop redis`. El perfil de desarrollo espera Redis en `127.0.0.1:6379`.

Desde la raíz del repositorio, restaura la herramienta local de EF Core y los paquetes del proyecto:

```bash
dotnet tool restore
dotnet restore Backend
```

Entity Framework Core, Npgsql y el proveedor de caché Redis se restauran desde NuGet con el proyecto.

## 2. Configura User Secrets

El proyecto ya tiene un `UserSecretsId`. Configura la cadena de PostgreSQL en el almacén de desarrollo de tu usuario, fuera del repositorio.

Si tu PostgreSQL local acepta el mismo usuario de macOS sin contraseña:

```bash
dotnet user-secrets set "ConnectionStrings:SaludDigna" \
  "Host=localhost;Port=5432;Database=Salud Digna;Username=$USER" \
  --project Backend
```

Si tu instalación requiere otro usuario o contraseña, ajusta la cadena en `secrets.json`. En macOS puedes encontrarlo en `~/.microsoft/usersecrets/<UserSecretsId>/secrets.json`. El identificador está en `Backend/SaludDigna.Backend.csproj`. Si tu servidor Redis usa otra dirección o requiere credenciales, configura allí también `ConnectionStrings:Redis`.

## 3. Crea la base y aplica la migración

Con PostgreSQL en marcha, ejecuta estos comandos desde la raíz del repositorio:

```bash
dotnet build Backend
DOTNET_ENVIRONMENT=Development dotnet tool run dotnet-ef database update --project Backend --no-build
```

EF Core crea la base si hace falta y aplica la migración inicial con las tablas `patients`, `cases` y `events`. Para que EF Core pueda crear la base, el rol de PostgreSQL necesita permiso `CREATEDB`. Si el rol carece de ese permiso, el administrador debe crear la base y dar al rol permisos para aplicar las migraciones en ella.

Puedes verificar las tablas con el usuario y nombre de base que configuraste:

```bash
psql -h localhost -p 5432 -U "$USER" -d "Salud Digna" -c '\dt'
```

Si instalaste PostgreSQL 14 con Homebrew y tu terminal no encuentra `psql`, usa `"$(brew --prefix postgresql@14)/bin/psql"` en su lugar.

## 4. Arranca y verifica el backend

```bash
dotnet run --project Backend
```

- [Inicio](http://localhost:5080/) muestra la página MVC.
- [Salud del backend](http://localhost:5080/health) confirma que el proceso responde.
- [Salud de Redis](http://localhost:5080/health/redis) devuelve HTTP 200 si la caché responde y HTTP 503 si está configurada pero no está disponible. También puedes probar Redis con `redis-cli ping`.

Si el puerto HTTP `5080` está ocupado, arranca con `dotnet run --project Backend -- --urls http://localhost:5081` y usa ese puerto en las comprobaciones. PostgreSQL y Redis conservan sus propios puertos.
