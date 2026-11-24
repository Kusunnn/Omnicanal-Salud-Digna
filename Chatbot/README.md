# Chatbot de WhatsApp

Bot de WhatsApp (Cloud API de Meta, Node.js + Express) para OmniCanal Salud Digna. Muestra los 13 servicios del catálogo del backend (`Backend/Models/Consultations/ConsultationCatalog.cs`) y guía al paciente por los pasos de cada servicio con botones y listas. Todo es una simulación: no agenda citas reales.

## Dónde se configura cada cosa

| Archivo | Qué contiene |
|---|---|
| `mensajes.js` | Textos del bot y de los botones de cada paso |
| `catalogo.js` | Carga los servicios y sus pasos desde la API del backend |
| `flujo.js` | Decide qué contestar según lo que escribe o toca el paciente |
| `index.js` | Webhook y envío de mensajes a WhatsApp |
| `.env` | Archivo local con los valores `META_TOKEN`, `META_PHONE_NUMBER_ID` y `VERIFY_TOKEN` |

## Cómo funciona

- **"hola" o "menu"**: lista con los servicios. Son más de 10, así que se reparte en dos páginas con la opción "Ver más servicios".
- **Al elegir un servicio** el bot muestra los pasos siguientes del catálogo. Si son 3 o menos salen como botones de un clic; si son más, como lista.
  - Laboratorio: prerregistro → clínica → revisar datos → confirmar → resumen, o consultar estudios.
  - Los demás: cotizar → clínica → horario → confirmar sin pago o pagar → resumen, o consultar requisitos.
- También funciona si el paciente escribe el nombre del servicio, por ejemplo "rayos x".
- El chatbot carga `GET /api/tipos-consulta` al arrancar. Si existen varias versiones de un servicio, muestra una sola opción con la versión más reciente.

## Cómo prenderlo

1. Inicia el backend con `dotnet run --project Backend` desde la raíz del repositorio.
2. En otra terminal, entra a `Chatbot` y ejecuta `npm ci`.
3. Configura tus credenciales de prueba en `Chatbot/.env`. El bot usa `http://localhost:5080` por defecto; si tu backend tiene otra dirección, agrega `BACKEND_URL` al archivo.
4. Ejecuta `npm start`. El bot muestra cuántos servicios cargó y avisa si el backend no responde.
5. En otra terminal: `ngrok http 3000`
6. En Meta > WhatsApp > Configuración > Webhooks:
   - Callback URL: tu dirección de ngrok + `/webhook`
   - Verify token: el mismo `VERIFY_TOKEN` de tu `.env`
   - Suscríbete al campo **messages**
7. Escribe "hola" al número de WhatsApp desde un número que esté en la lista de destinatarios.

Si cambias el catálogo del backend o el `.env`, reinicia el bot con **Ctrl+C** y `npm start`.

## Notas

- Con el número de prueba de Meta, el bot solo puede contestar a los números agregados en la lista de destinatarios (máximo 5).
- El token temporal de Meta vence en pocas horas; hay que generar otro y reiniciar el bot.
- La app de Meta debe estar publicada y suscrita a la cuenta de WhatsApp Business para recibir mensajes reales.
