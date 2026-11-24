# Chatbot de WhatsApp

Bot de WhatsApp (Cloud API de Meta, Node.js + Express) para OmniCanal Salud Digna. Muestra los 13 servicios del catálogo del backend (`Backend/Models/Consultations/ConsultationCatalog.cs`) y guía al paciente por los pasos de cada servicio con botones y listas. Todo es una simulación: no agenda citas reales.

## Dónde se configura cada cosa

| Archivo | Qué contiene |
|---|---|
| `mensajes.js` | Textos del bot y de los botones de cada paso |
| `catalogo.js` | Copia del catálogo de servicios y pasos de `ConsultationCatalog.cs` |
| `flujo.js` | Decide qué contestar según lo que escribe o toca el paciente |
| `index.js` | Webhook y envío de mensajes a WhatsApp |
| `.env` | Token y datos de Meta (se crea a partir de `.env.example`, no se sube a GitHub) |

## Cómo funciona

- **"hola" o "menu"**: lista con los servicios. Son más de 10, así que se reparte en dos páginas con la opción "Ver más servicios".
- **Al elegir un servicio** el bot muestra los pasos siguientes del catálogo. Si son 3 o menos salen como botones de un clic; si son más, como lista.
  - Laboratorio: prerregistro → clínica → revisar datos → confirmar → resumen, o consultar estudios.
  - Los demás: cotizar → clínica → horario → confirmar sin pago o pagar → resumen, o consultar requisitos.
- También funciona si el paciente escribe el nombre del servicio, por ejemplo "rayos x".
- Si el backend está corriendo y pones `BACKEND_URL` en el `.env`, el bot lee el catálogo en vivo de `GET /api/tipos-consulta`. Si no, usa la copia de `catalogo.js`.

## Cómo prenderlo

1. Abre una terminal en la carpeta `Chatbot`.
2. `npm install` (solo la primera vez).
3. Copia `.env.example` como `.env` y llena tus datos de Meta.
4. `npm start`
5. En otra terminal: `ngrok http 3000`
6. En Meta > WhatsApp > Configuración > Webhooks:
   - Callback URL: tu dirección de ngrok + `/webhook`
   - Verify token: el mismo `VERIFY_TOKEN` de tu `.env`
   - Suscríbete al campo **messages**
7. Escribe "hola" al número de WhatsApp desde un número que esté en la lista de destinatarios.

Cada vez que cambies un archivo o el `.env`, reinicia el bot: Ctrl + C y luego `npm start`.

## Notas

- Con el número de prueba de Meta, el bot solo puede contestar a los números agregados en la lista de destinatarios (máximo 5).
- El token temporal de Meta vence en pocas horas; hay que generar otro y reiniciar el bot.
- La app de Meta debe estar publicada y suscrita a la cuenta de WhatsApp Business para recibir mensajes reales.
