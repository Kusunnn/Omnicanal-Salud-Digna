const BACKEND_LOCAL = "http://localhost:5080";
let serviciosPorId = new Map();
let clinicas = [];
let horarios = [];

async function cargarCatalogo(backendUrl = BACKEND_LOCAL) {
  const baseUrl = (backendUrl.trim() || BACKEND_LOCAL).replace(/\/+$/, "");
  const [respuesta, sedes, horas] = await Promise.all([
    fetch(`${baseUrl}/api/tipos-consulta`, { signal: AbortSignal.timeout(5000) }),
    fetch(`${baseUrl}/api/clinicas`, { signal: AbortSignal.timeout(5000) }),
    fetch(`${baseUrl}/api/horarios`, { signal: AbortSignal.timeout(5000) }),
  ]);
  if (!sedes.ok) throw new Error(`HTTP ${sedes.status} al cargar clínicas`);
  const opcionesClinica = await sedes.json();
  if (!Array.isArray(opcionesClinica) || opcionesClinica.length === 0) throw new Error("No hay clínicas disponibles");
  if (!horas.ok) throw new Error(`HTTP ${horas.status} al cargar horarios`);
  horarios = await horas.json();
  clinicas = opcionesClinica;
  if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);

  const servicios = await respuesta.json();
  if (!Array.isArray(servicios) || servicios.length === 0) {
    throw new Error("El backend no devolvió servicios");
  }

  const nuevosServicios = new Map();
  for (const servicio of servicios) {
    if (!servicio?.id || !servicio.nombre || !Number.isInteger(servicio.version) ||
        !Array.isArray(servicio.checkpoints) || !buscarPaso(servicio, servicio.checkpointInicial)) {
      throw new Error("El backend devolvió un servicio sin un flujo válido");
    }

    const anterior = nuevosServicios.get(servicio.id);
    if (!anterior || servicio.version > anterior.version) {
      nuevosServicios.set(servicio.id, servicio);
    }
  }

  serviciosPorId = nuevosServicios;
  return serviciosPorId.size;
}

const obtenerServicios = () => [...serviciosPorId.values()];
const buscarServicio = (id) => serviciosPorId.get(id);
const buscarPaso = (servicio, id) => servicio?.checkpoints.find((paso) => paso.id === id);

module.exports = { obtenerHorarios: () => horarios, obtenerClinicas: () => clinicas, cargarCatalogo, obtenerServicios, buscarServicio, buscarPaso };
