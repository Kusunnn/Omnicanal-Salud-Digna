require("dotenv").config();
const crypto = require("crypto");
const express = require("express");
const { cargarCatalogo } = require("./catalogo");
const { responder } = require("./flujo");

const app = express();
app.use(express.json({ verify: (req, _res, buffer) => (req.cuerpoOriginal = buffer) }));

const { META_TOKEN, META_PHONE_NUMBER_ID, VERIFY_TOKEN, BACKEND_URL, META_APP_SECRET, CHATBOT_API_KEY } = process.env;
const PORT = Number(process.env.PORT) || 3000;

if (!META_TOKEN || META_TOKEN === "PEGA_AQUI_TU_TOKEN") {
  console.log("AVISO: falta poner tu token en el archivo .env");
}
if (!META_APP_SECRET) {
  console.log("AVISO: falta META_APP_SECRET en el .env; el bot no puede comprobar que los mensajes vienen de Meta");
}
if (!CHATBOT_API_KEY) {
  console.log("AVISO: falta CHATBOT_API_KEY en el .env; el bot no podrá identificar pacientes en el backend");
}
function firmaValida(req) {
  if (!META_APP_SECRET) return true;
  const firma = req.get("x-hub-signature-256") || "";
  const esperada =
    "sha256=" + crypto.createHmac("sha256", META_APP_SECRET).update(req.cuerpoOriginal || "").digest("hex");
  const a = Buffer.from(firma);
  const b = Buffer.from(esperada);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function leerMensaje(msg) {
  if (msg.type === "text") return { valor: msg.text?.body, mostrar: "[texto]" };
  if (msg.type === "interactive") {
    const r = msg.interactive?.button_reply || msg.interactive?.list_reply;
    if (r) return { valor: r.id, mostrar: `[${msg.interactive.list_reply ? "lista" : "boton"}] ${r.title}` };
  }
  return null;
}
app.get("/webhook", (req, res) => {
  if (req.query["hub.verify_token"] === VERIFY_TOKEN) {
    console.log("Meta verifico el webhook correctamente");
    return res.send(req.query["hub.challenge"]);
  }
  console.log("Intento de verificacion con token incorrecto");
  res.sendStatus(403);
});
const yaVistos = new Set();
const colas = new Map();

function enCola(numero, tarea) {
  const actual = (colas.get(numero) || Promise.resolve()).then(tarea);
  colas.set(numero, actual);
  actual.finally(() => colas.get(numero) === actual && colas.delete(numero));
}

app.post("/webhook", (req, res) => {
  if (!firmaValida(req)) {
    console.warn("Webhook rechazado: falta la firma de Meta o es inválida.");
    return res.sendStatus(401);
  }
  res.sendStatus(200);

  const msg = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!msg) return;
  const leido = leerMensaje(msg);
  if (!leido?.valor || !msg.from) return;
  if (yaVistos.has(msg.id)) return;
  yaVistos.add(msg.id);
  console.log(`WhatsApp • ${msg.from.slice(-4)}: ${leido.mostrar}`);
  enCola(msg.from, async () => {
    try {
      await enviar(msg.from, await responder(msg.from, leido.valor));
    } catch (error) {
      console.log("No se pudo contestar:", error.message);
    }
  });
});
function esLista({ tipo, opciones }) {
  if (tipo === "lista") return true;
  if (tipo === "botones") return false;
  return opciones.length > 3;
}
function revisarLimites(respuesta) {
  const { opciones = [], boton } = respuesta;
  const avisar = (cosa, texto, max) => {
    if (texto && texto.length > max) console.log(`AVISO: ${cosa} "${texto}" pasa de ${max} caracteres`);
  };
  if (esLista(respuesta)) {
    if (opciones.length > 10) console.log("AVISO: la lista tiene mas de 10 opciones");
    avisar("el boton de la lista", boton, 20);
    for (const o of opciones) {
      avisar("la opcion", o.titulo, 24);
      avisar("la descripcion", o.descripcion, 72);
      avisar("la seccion", o.seccion, 24);
    }
  } else {
    if (opciones.length > 3) console.log("AVISO: hay mas de 3 botones");
    for (const o of opciones) avisar("el boton", o.titulo, 20);
  }
}
function agruparSecciones(opciones) {
  const secciones = [];
  for (const o of opciones) {
    const titulo = o.seccion || "Opciones";
    let s = secciones.find((x) => x.title === titulo);
    if (!s) secciones.push((s = { title: titulo, rows: [] }));
    s.rows.push({ id: o.id, title: o.titulo, ...(o.descripcion ? { description: o.descripcion } : {}) });
  }
  return secciones;
}
function armarMensaje(numero, respuesta) {
  const { texto, opciones = [], boton } = respuesta;
  const base = { messaging_product: "whatsapp", to: numero };
  if (!opciones.length) return { ...base, type: "text", text: { body: texto } };

  revisarLimites(respuesta);
  if (esLista(respuesta)) {
    return {
      ...base,
      type: "interactive",
      interactive: {
        type: "list",
        body: { text: texto },
        action: { button: boton || "Ver opciones", sections: agruparSecciones(opciones) },
      },
    };
  }
  return {
    ...base,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: texto },
      action: {
        buttons: opciones.map((o) => ({ type: "reply", reply: { id: o.id, title: o.titulo } })),
      },
    },
  };
}
async function enviar(numero, respuesta) {
  if (numero.startsWith("521") && numero.length === 13) numero = "52" + numero.slice(3);

  try {
    const res = await fetch(`https://graph.facebook.com/v25.0/${META_PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${META_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(armarMensaje(numero, respuesta)),
    });

    const data = await res.json();
    if (!res.ok || data.error) {
      console.warn("Error de Meta:", {
        status: res.status,
        code: data.error?.code,
        subcode: data.error?.error_subcode,
        mensaje: data.error?.message,
        traza: data.error?.fbtrace_id,
      });
    } else console.log("Respuesta enviada");
  } catch (err) {
    console.log("No se pudo enviar el mensaje:", err.cause?.code || err.message);
  }
}

cargarCatalogo(BACKEND_URL).then((cantidad) => {
  console.log(`Catálogo cargado del backend: ${cantidad} servicios`);
  app.listen(PORT, () => {
    console.log(`Chatbot escuchando en http://localhost:${PORT}`);
  });
}).catch((error) => {
  console.error("No se pudo cargar el catálogo. Inicia el backend y revisa BACKEND_URL.");
  console.error(error.cause?.code || error.message);
  process.exitCode = 1;
});
