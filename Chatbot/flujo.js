// Decide que contestar. No guarda estado: el id de cada boton u opcion
// lleva el servicio y el paso (por ejemplo "cp:ultrasonido:cotizado"),
// asi que el flujo sigue funcionando aunque el bot se reinicie.

const { obtenerServicios, buscarServicio, buscarPaso } = require("./catalogo");
const m = require("./mensajes");

const POR_PAGINA = 9; // 9 opciones + "Ver más servicios" = 10 (maximo de una lista)

const BOTON_MENU = { id: "menu", titulo: m.botonMenu };
const BOTON_ASESOR = { id: "asesor", titulo: m.botonAsesor };

// Minusculas, sin acentos ni espacios extra (para comparar lo que escribe la persona)
const normalizar = (texto) =>
  texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

const emojiDe = (servicio) => m.emojisServicios[servicio.id] || m.emojiServicio;
const rellenar = (texto, servicio) =>
  texto.replaceAll("{servicio}", servicio.nombre).replaceAll("{emoji}", emojiDe(servicio));
const recortar = (texto, max) => (texto.length > max ? texto.slice(0, max - 1) + "…" : texto);

// Menu principal: lista con los servicios del catalogo (en paginas si son mas de 10)
function menuServicios(pagina = 0) {
  const todas = [
    ...obtenerServicios().map((s) => ({
      id: `svc:${s.id}`,
      titulo: recortar(`${emojiDe(s)} ${s.nombre}`, 24),
      seccion: "Servicios",
    })),
    { id: "asesor", titulo: m.opcionAsesor, seccion: "Ayuda" },
  ];

  let opciones = todas;
  if (todas.length > 10) {
    const paginas = Math.ceil(todas.length / POR_PAGINA);
    pagina = Math.min(Math.max(pagina, 0), paginas - 1);
    opciones = todas.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA);
    if (pagina < paginas - 1) opciones.push({ id: `mas:${pagina + 1}`, titulo: m.verMas, seccion: "Más opciones" });
    else opciones.push({ id: "menu", titulo: m.volverInicio, seccion: "Más opciones" });
  }

  return {
    texto: pagina === 0 ? m.bienvenida : m.masServicios,
    boton: m.botonServicios,
    tipo: "lista",
    opciones,
  };
}

// Un paso del flujo de un servicio (sin paso = el inicio del servicio)
function pasoServicio(servicioId, pasoId) {
  const servicio = buscarServicio(servicioId);
  if (!servicio) return { texto: m.noEntendi, opciones: [BOTON_MENU] };

  const idPaso = pasoId || servicio.checkpointInicial;
  const paso = buscarPaso(servicio, idPaso);
  if (!paso) return { texto: m.noEntendi, opciones: [BOTON_MENU] };

  const texto =
    idPaso === servicio.checkpointInicial ? m.alElegirServicio : m.pasos[idPaso] || `Listo: ${paso.nombre}.`;

  const opciones = paso.siguientes.map((sig) => {
    const siguiente = buscarPaso(servicio, sig);
    return {
      id: `cp:${servicio.id}:${sig}`,
      titulo: m.etiquetas[sig] || recortar(siguiente?.nombre || sig, 20),
      descripcion: siguiente?.nombre,
    };
  });
  if (!opciones.length) opciones.push(BOTON_ASESOR); // ultimo paso del flujo
  opciones.push(BOTON_MENU);

  return { texto: rellenar(texto, servicio), opciones };
}

// Recibe lo que escribio la persona o el id de lo que toco
function responder(entrada) {
  const t = normalizar(entrada);

  if (["hola", "menu", "inicio", "buenas", "buenos dias", "buenas tardes"].includes(t)) return menuServicios(0);
  if (t.startsWith("mas:")) return menuServicios(Number(t.slice(4)) || 0);
  if (t === "asesor" || t === "hablar con un asesor") return { texto: m.asesor, opciones: [BOTON_MENU] };
  if (t === "gracias") return { texto: m.gracias, opciones: [BOTON_MENU] };
  if (t.startsWith("svc:")) return pasoServicio(t.slice(4), null);
  if (t.startsWith("cp:")) {
    const [, servicioId, pasoId] = t.split(":");
    return pasoServicio(servicioId, pasoId);
  }

  // Si escribe el nombre de un servicio (ej. "rayos x"), empieza ese flujo
  const servicio = obtenerServicios().find((s) => normalizar(s.nombre) === t || s.id === t);
  if (servicio) return pasoServicio(servicio.id, null);

  return { texto: m.noEntendi, opciones: [BOTON_MENU] };
}

module.exports = { responder };
