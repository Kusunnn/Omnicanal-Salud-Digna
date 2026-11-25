# Chatbot de WhatsApp

Bot de WhatsApp (Cloud API de Meta, Node.js + Express) para OmniCanal Salud Digna. Identifica al paciente con su número de WhatsApp y su fecha de nacimiento, le muestra los trámites que dejó pendientes en cualquier canal (web, call center, WhatsApp) y le deja continuarlos desde el paso donde se quedó. También puede iniciar trámites para él o para un familiar. Usa los 13 servicios del catálogo del backend (`Backend/Models/Consultations/ConsultationCatalog.cs`). Todo es una simulación: no agenda citas reales.

## Dónde se configura cada cosa

| Archivo | Qué contiene |
|---|---|
| `mensajes.js` | Textos del bot y de los botones |
| `catalogo.js` | Carga los servicios y sus pasos desde la API del backend |
| `flujo.js` | Decide qué contestar según lo que escribe o toca el paciente |
| `backend.js` | Llamadas al backend: identificar, trámites pendientes, crear, retomar y avanzar casos |
| `sesiones.js` | Sesión de cada número (se cierra sola tras 10 minutos sin mensajes) |
| `index.js` | Webhook, firma de Meta y envío de mensajes a WhatsApp |
| `.env` | Archivo local con tus claves. Copia `.env.example` y llénalo |

## Cómo funciona

### Identificación

Al escribir, el bot pregunta **de quién son los trámites**:

- **Míos, este número**: el bot usa el número de WhatsApp de quien escribe. Ese número lo pone Meta en cada mensaje (`from`) y no se puede falsificar, porque WhatsApp ya lo verificó con un código SMS. Luego pide la **fecha de nacimiento** (`15/03/1990`). El backend busca un paciente con ese teléfono y esa fecha.
  - Si no coinciden, el bot nunca dice cuál de los dos datos falló, así nadie puede averiguar qué números son pacientes.
  - Después de **3 intentos fallidos** el número queda **bloqueado 15 minutos**. El backend lleva la cuenta (en Redis, o en memoria si Redis no está), así que el bloqueo sigue aunque se reinicie el bot.
- **Invitado** permite consultar el catálogo o hablar con un asesor.

### Paciente identificado

- Ve sus **trámites pendientes** de cualquier canal, más los que pidió para familiares. No ve otros trámites de esos familiares.
- Al tocar uno, el bot lo **retoma en WhatsApp** (`POST .../retomar`). En el historial queda el canal anterior y el trámite continúa desde su paso actual. Cada botón guarda el avance en el backend (`PUT .../checkpoint`).
- **Trámite nuevo → Para mí**: crea el caso del paciente.
- **Trámite nuevo → Para un familiar**: pide parentesco, nombre completo y CURP. Si la CURP ya existe, el caso se liga a ese paciente; si no, se crea un registro básico con el teléfono de quien lo pide. El caso guarda quién lo pidió (`SolicitantePatientId`) y el parentesco.
- **Cerrar sesión** borra la sesión. Además se cierra sola tras **10 minutos** sin mensajes.

### Invitado

Sin identificarse, el catálogo funciona como antes: lista de servicios en dos páginas y pasos con botones. No se guarda nada.

### Seguridad del webhook

Meta firma cada aviso con el *App Secret* de tu app (encabezado `X-Hub-Signature-256`). El bot rechaza cualquier petición sin una firma válida, para que nadie pueda mandar mensajes falsos con el número de otra persona. Si `META_APP_SECRET` no está en el `.env`, el bot avisa al arrancar y no revisa la firma (solo para pruebas).

## Cómo prenderlo

1. En el backend, configura una clave para el chatbot (la misma irá en el `.env` del bot):
   ```powershell
   dotnet user-secrets set "Chatbot:ApiKey" "INVENTA_UNA_CLAVE_LARGA" --project Backend
   ```
2. Inicia el backend con `dotnet run --project Backend` desde la raíz del repositorio.
3. En otra terminal, entra a `Chatbot` y ejecuta `npm ci`.
4. Copia `.env.example` como `.env` y llena:
   - `META_TOKEN` y `META_PHONE_NUMBER_ID`: panel de Meta → WhatsApp → Configuración de la API.
   - `VERIFY_TOKEN`: una contraseña que tú inventas.
   - `META_APP_SECRET`: panel de Meta → Configuración de la app → Básica → Clave secreta de la app.
   - `CHATBOT_API_KEY`: la misma clave del paso 1.
   - `BACKEND_URL` (opcional): por defecto `http://localhost:5080`.
5. Ejecuta `npm start`. El bot muestra cuántos servicios cargó y avisa si falta alguna clave.
6. En otra terminal: `ngrok http 3000`
7. En Meta → WhatsApp → Configuración → Webhook:
   - Callback URL: tu dirección de ngrok + `/webhook`
   - Verify token: el mismo `VERIFY_TOKEN` de tu `.env`
   - Suscríbete al campo **messages**
8. Escribe "hola" al número de WhatsApp desde un número que esté en la lista de destinatarios.

Si cambias el catálogo del backend o el `.env`, reinicia el bot con **Ctrl+C** y `npm start`.

### Probar la identificación con tu celular

Los tres pacientes de prueba tienen teléfonos ficticios (`+520000000001`, ...). Para que el bot te reconozca, pon tu número a uno de ellos en pgAdmin (10 dígitos después de `+52`):

```sql
UPDATE patients SET telefono = '+52TU_NUMERO_A_10_DIGITOS'
WHERE curp = 'DEMO00000000000001';
```

Luego escribe la fecha de nacimiento de ese paciente (`SELECT fecha_nacimiento FROM patients WHERE curp = 'DEMO00000000000001';`).

## Endpoints del backend que usa el bot

| Petición | Para qué |
|---|---|
| `POST /api/chatbot/identidad` | Teléfono + fecha de nacimiento → cookie de sesión de paciente |
| `GET /api/chatbot/pendientes` | Trámites abiertos del paciente y los que pidió para familiares |
| `POST /api/chatbot/familiares/casos` | Crea un trámite para un familiar |
| `POST /api/pacientes/{id}/casos` | Crea un trámite propio |
| `GET /api/pacientes/{id}/casos/{caso}` | Lee el paso actual |
| `PUT /api/pacientes/{id}/casos/{caso}/checkpoint` | Avanza un paso |
| `POST /api/pacientes/{id}/casos/{caso}/retomar` | Retoma el trámite en WhatsApp |

Los de `/api/chatbot` solo responden con el encabezado `X-Chatbot-Key` igual a `Chatbot:ApiKey`; si esa clave no está configurada, no existen (404).

## Notas

- Con el número de prueba de Meta, el bot solo puede contestar a los números agregados en la lista de destinatarios (máximo 5).
- El token temporal de Meta vence en pocas horas; hay que generar otro y reiniciar el bot.
- La app de Meta debe estar publicada y suscrita a la cuenta de WhatsApp Business para recibir mensajes reales.
- Las sesiones del bot viven en memoria: si el bot se reinicia, el paciente vuelve a identificarse.
