// =============================================================
//  CATALOGO DE SERVICIOS DEL CHATBOT
//  Es una copia de Backend/Models/Consultations/ConsultationCatalog.cs
//  (mismos ids, nombres y pasos).
//
//  Si el backend esta corriendo y pones BACKEND_URL en el .env,
//  el bot lee el catalogo en vivo de GET /api/tipos-consulta y esta
//  copia solo se usa como respaldo. Si cambias ConsultationCatalog.cs
//  y no usas BACKEND_URL, actualiza tambien este archivo.
// =============================================================

const INICIO = "inicio";

const nodo = (id, nombre, ...siguientes) => ({ id, nombre, siguientes, guardadoInmediato: false });
const confirmado = (id, nombre, ...siguientes) => ({ id, nombre, siguientes, guardadoInmediato: true });

// Flujo de cita (todos los servicios menos Laboratorio)
const flujoCita = [
  nodo(INICIO, "Inicio", "cotizado", "requisitos"),
  nodo("cotizado", "Cotización lista", "clinica-seleccionada"),
  nodo("clinica-seleccionada", "Clínica seleccionada", "horario-seleccionado"),
  nodo("horario-seleccionado", "Horario seleccionado", "cita-confirmada", "pago-pendiente"),
  confirmado("cita-confirmada", "Cita simulada confirmada sin prepago", "resumen-cita"),
  nodo("resumen-cita", "Ver resumen de cita"),
  nodo("pago-pendiente", "Iniciar pago simulado", "pago-confirmado"),
  confirmado("pago-confirmado", "Pago simulado confirmado", "cita-confirmada-con-pago"),
  confirmado("cita-confirmada-con-pago", "Cita simulada confirmada con pago", "resumen-cita-con-pago"),
  nodo("resumen-cita-con-pago", "Ver resumen de cita con pago"),
  nodo("requisitos", "Consultar requisitos", "resumen-requisitos"),
  nodo("resumen-requisitos", "Ver información del estudio"),
];

// Flujo de Laboratorio (prerregistro)
const flujoLaboratorio = [
  nodo(INICIO, "Estudio de laboratorio", "prerregistro", "consultar-estudios"),
  nodo("prerregistro", "Iniciar prerregistro", "clinica-seleccionada"),
  nodo("clinica-seleccionada", "Clínica seleccionada", "datos-revisados"),
  nodo("datos-revisados", "Datos del prerregistro revisados", "prerregistro-confirmado"),
  confirmado("prerregistro-confirmado", "Prerregistro simulado confirmado", "resumen-visita"),
  nodo("resumen-visita", "Ver resumen de la visita"),
  nodo("consultar-estudios", "Consultar estudios", "resumen-estudios"),
  nodo("resumen-estudios", "Ver estudios disponibles en la simulación"),
];

const servicio = (id, nombre, checkpoints = flujoCita) => ({
  id,
  nombre,
  checkpointInicial: INICIO,
  checkpoints,
  version: 1,
});

const catalogoLocal = [
  servicio("laboratorio", "Laboratorio", flujoLaboratorio),
  servicio("resonancia-magnetica", "Resonancia Magnética"),
  servicio("electrocardiograma", "Electrocardiograma"),
  servicio("lentes", "Lentes"),
  servicio("nutricion", "Nutrición"),
  servicio("tomografia", "Tomografía"),
  servicio("ultrasonido", "Ultrasonido"),
  servicio("papanicolaou", "Papanicolaou"),
  servicio("rayos-x", "Rayos X"),
  servicio("densitometria", "Densitometría"),
  servicio("mastografia", "Mastografía"),
  servicio("biopsia", "Biopsia"),
  servicio("covid-19", "COVID-19"),
];

let catalogo = catalogoLocal;

// Intenta leer el catalogo del backend; si no puede, se queda con la copia local
async function cargarCatalogo(backendUrl) {
  if (!backendUrl) {
    console.log(`Catalogo: copia local (${catalogo.length} servicios)`);
    return;
  }
  try {
    const url = `${backendUrl.replace(/\/$/, "")}/api/tipos-consulta?canal=WHATSAPP`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const datos = await res.json();
    if (!Array.isArray(datos) || !datos.length) throw new Error("respuesta vacia");
    catalogo = datos;
    console.log(`Catalogo: cargado del backend (${datos.length} servicios)`);
  } catch (err) {
    console.log(`Catalogo: no se pudo leer del backend (${err.message}); uso la copia local`);
  }
}

const obtenerServicios = () => catalogo;
const buscarServicio = (id) => catalogo.find((s) => s.id === id);
const buscarPaso = (serv, id) => serv?.checkpoints.find((c) => c.id === id);

module.exports = { cargarCatalogo, obtenerServicios, buscarServicio, buscarPaso };
