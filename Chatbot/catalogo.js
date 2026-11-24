const BACKEND_LOCAL = "http://localhost:5080";
let serviciosPorId = new Map();

async function cargarCatalogo(backendUrl = BACKEND_LOCAL) {
  const baseUrl = (backendUrl.trim() || BACKEND_LOCAL).replace(/\/+$/, "");
  const respuesta = await fetch(`${baseUrl}/api/tipos-consulta`, {
    signal: AbortSignal.timeout(5000),
  });
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

module.exports = { cargarCatalogo, obtenerServicios, buscarServicio, buscarPaso };
