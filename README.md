# OmniCanal Salud Digna

Backend de demostración en ASP.NET Core MVC y .NET 10. El mismo caso puede continuar entre canales con un catálogo compartido de 13 servicios simulados.

## Arranque en Windows

Instala el [SDK de .NET 10](https://dotnet.microsoft.com/download/dotnet/10.0) y [PostgreSQL para Windows](https://www.postgresql.org/download/windows/). Para probar Redis localmente, usa [Docker Desktop con contenedores Linux](https://redis.io/docs/latest/operate/oss_and_stack/install/install-stack/docker/).

Abre PowerShell en la raíz del repositorio. Si todavía no tienes configurada la conexión, inicializa User Secrets con este ejemplo:

```powershell
dotnet user-secrets set "ConnectionStrings:SaludDigna" "Host=localhost;Port=5432;Database=Salud Digna;Username=postgres;Password=TU_CONTRASEÑA" --project Backend
```

Reemplaza el valor de ejemplo en `%APPDATA%\Microsoft\UserSecrets\<UserSecretsId>\secrets.json`. El identificador está en `Backend/SaludDigna.Backend.csproj`. Si ya tienes una conexión configurada, úsala. [User Secrets en Windows](https://learn.microsoft.com/es-es/aspnet/core/security/app-secrets?tabs=windows&view=aspnetcore-10.0)

Con PostgreSQL en marcha, restaura la herramienta local, compila y aplica las migraciones:

```powershell
dotnet tool restore
dotnet build Backend
$env:DOTNET_ENVIRONMENT = 'Development'
dotnet tool run dotnet-ef database update --project Backend --no-build
```

EF Core crea la base si el usuario tiene permiso. Para cargar los 200 pacientes ficticios, ejecuta lo siguiente o abre el script en **Query Tool** de pgAdmin sobre la base `Salud Digna`:

```powershell
psql -h localhost -p 5432 -U postgres -d 'Salud Digna' -v ON_ERROR_STOP=1 -c "SET client_encoding TO 'UTF8'" -f '.\Backend\Data\Seeds\pacientes-ficticios.sql'
```

Con Docker Desktop abierto, crea Redis una vez y arranca el backend:

```powershell
docker run -d --name salud-digna-redis -p 127.0.0.1:6379:6379 -v salud-digna-redis:/data redis:8 redis-server --appendonly yes --appendfsync everysec --maxmemory-policy noeviction
dotnet run --project Backend
```

Para reutilizar el contenedor, ejecuta `docker start salud-digna-redis`. Comprueba el [backend](http://localhost:5080/health), [Redis](http://localhost:5080/health/redis) y el [catálogo](http://localhost:5080/api/tipos-consulta).

## Chatbot de WhatsApp

La carpeta `Chatbot` tiene un bot de WhatsApp (Node.js) que muestra los servicios de `ConsultationCatalog.cs` con botones y listas. Las instrucciones para prenderlo están en [Chatbot/README.md](Chatbot/README.md).

## Prueba rápida en Thunder Client

Usa `http://localhost:5080` y conserva la cookie de sesión. Las credenciales son de prueba y funcionan con el perfil `Development`.

| Paso | Petición | Cuerpo JSON |
|---|---|---|
| Iniciar sesión como paciente | `POST /api/demo/identidad/paciente` | `{"curp":"DEMO00000000000001","telefono":"+520000000001"}` |
| Crear un caso en Web | `POST /api/pacientes/{patientId}/casos` | `{"tipoConsultaId":"ultrasonido","canal":"WEB"}` |
| Cotizar | `PUT /api/pacientes/{patientId}/casos/{caseId}/checkpoint` | `{"pasoActual":"cotizado","canal":"WEB","versionEsperada":1}` |
| Seleccionar clínica | Mismo `PUT` | `{"pasoActual":"clinica-seleccionada","canal":"WEB","versionEsperada":2,"datos":{"clinica":"Clínica Demo"}}` |
| Retomar en WhatsApp | `POST /api/pacientes/{patientId}/casos/{caseId}/retomar` | `{"canal":"WHATSAPP","versionEsperada":3,"interaccionId":"f38b1539-cf48-4b12-9171-86658f40e873"}` |
| Ver el recorrido | `GET /api/pacientes/{patientId}/casos/{caseId}/eventos` | |

Usa el `patientId` de la sesión y el `id` del caso creado. Sigue la versión devuelta en cada respuesta y genera otro `interaccionId` para una reanudación nueva.

Para probar asesor o administrador, configura `DemoIdentity:AdvisorKey` y `DemoIdentity:AdminKey` en User Secrets. Inicia sesión con `POST /api/demo/identidad/personal` y un cuerpo con `rol` (`ASESOR` o `ADMIN`) y `clave`. Ambos roles pueden consultar `GET /api/tablero/casos`; el asesor puede actualizar el caso con el canal `CALL_CENTER`.

Los avances intermedios se guardan en Redis y se sincronizan con PostgreSQL tras 5 minutos sin cambios, con un máximo programado de 10 minutos. Las reanudaciones y las confirmaciones simuladas se guardan de inmediato en PostgreSQL. Si Redis falla, la lectura puede mostrar el último estado confirmado.

## Portal web de demostración

Ejecuta el frontend desde la raíz:

```powershell
npm --prefix Frontend ci
npm --prefix Frontend run dev
```

Abre http://localhost:5173. El portal funciona de forma local: crea un caso de Ultrasonido o Rayos X y guarda los checkpoints en el navegador. La vista de operador en http://localhost:5173/?vista=operador lee los mismos casos en el mismo navegador. La demo incluye un caso ficticio iniciado en WhatsApp.

Para probar más adelante la conexión real, inicia el backend en Development con los pacientes ficticios y ejecuta Vite con `$env:VITE_USE_BACKEND = 'true'`. Los casos de demo y los de PostgreSQL se guardan por separado.
