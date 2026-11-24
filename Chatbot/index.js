// Chatbot de WhatsApp (Cloud API de Meta) para OmniCanal Salud Digna.
// Los textos se cambian en mensajes.js y los servicios salen de catalogo.js.

require("dotenv").config();
const express = require("express");
const { cargarCatalogo } = require("./catalogo");
const { responder } = require("./flujo");

const app = express();
app.use(express.json());

const { META_TOKEN, META_PHONE_NUMBER_ID, VERIFY_TOKEN, BACKEND_URL } = process.env;
const PORT = Number(process.env.PORT) || 3000;

if (!META_TOKEN || META_TOKEN === "PEGA_AQUI_TU_TOKEN") {
  console.log("AVISO: falta poner tu token en el archivo .env");
}

// Saca lo que mando la persona: el texto escrito o el id de lo que toco
function leerMensaje(msg) {
  if (msg.type === "text") return { valor: msg.text.body, mostrar: msg.text.body };
  if (msg.type === "interactive") {
    const r = msg.interactive?.button_reply || msg.interactive?.list_reply;
    if (r) return { valor: r.id, mostrar: `[${msg.interactive.list_reply ? "lista" : "boton"}] ${r.title}` };
  }
  return null;
}

// Meta revisa que la direccion es tuya (se hace una vez al configurar el webhook)
app.get("/webhook", (req, res) => {
  if (req.query["hub.verify_token"] === VERIFY_TOKEN) {
    console.log("Meta verifico el webhook correctamente");
    return res.send(req.query["hub.challenge"]);
  }
  console.log("Intento de verificacion con token incorrecto");
  res.sendStatus(403);
});

// Aqui llegan los mensajes que le escriben al bot
const yaVistos = new Set();
app.post("/webhook", async (req, res) => {
  res.sendStatus(200); // contestar rapido para que Meta no reintente

  const msg = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!msg) return;
  const leido = leerMensaje(msg);
  if (!leido) return;

  // Meta a veces manda el mismo mensaje dos veces; lo ignoramos
  if (yaVistos.has(msg.id)) return;
  yaVistos.add(msg.id);

  console.log(`Te escribio ${msg.from}: ${leido.mostrar}`);
  await enviar(msg.from, responder(leido.valor));
});

// 3 opciones o menos -> botones; 4 o mas -> lista. Se puede forzar con tipo.
function esLista({ tipo, opciones }) {
  if (tipo === "lista") return true;
  if (tipo === "botones") return false;
  return opciones.length > 3;
}

// Avisa en la terminal si algo pasa de los limites de WhatsApp
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

// Junta las opciones por seccion (en el orden en que aparecen) para la lista
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

// Arma el mensaje para WhatsApp: lista, botones de un clic o texto normal
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

// Manda un mensaje por WhatsApp
async function enviar(numero, respuesta) {
  // Los numeros de Mexico llegan como 521..., pero se envian como 52...
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
    if (data.error) console.log("Error de Meta:", data.error.message);
    else console.log("Respuesta enviada");
  } catch (err) {
    // Si falla internet o Meta, el bot avisa pero no se apaga
    console.log("No se pudo enviar el mensaje:", err.cause?.code || err.message);
  }
}

cargarCatalogo(BACKEND_URL).then((cantidad) => {
  console.log(`Catálogo cargado del backend: ${cantidad} servicios`);
  app.listen(PORT, () => {
    console.log(`Chatbot prendido en http://localhost:${PORT}`);
    console.log(`Siguiente paso: en otra terminal corre  ngrok http ${PORT}`);
  });
}).catch((error) => {
  console.error("No se pudo cargar el catálogo. Inicia el backend y revisa BACKEND_URL.");
  console.error(error.cause?.code || error.message);
  process.exitCode = 1;
});
