const INACTIVIDAD_MS = 10 * 60 * 1000;

const sesiones = new Map();

function nueva() {
  return {
    modo: null,
    estado: null,
    cookie: null,
    patientId: null,
    nombre: null,
    para: null,
    familiar: null,
    casos: new Map(),
    ultimaVez: Date.now(),
  };
}
function obtener(numero) {
  const actual = sesiones.get(numero);
  if (actual && Date.now() - actual.ultimaVez <= INACTIVIDAD_MS) {
    actual.ultimaVez = Date.now();
    return { sesion: actual, vencio: false };
  }

  const sesion = nueva();
  sesiones.set(numero, sesion);
  return { sesion, vencio: actual?.modo === "verificado" };
}

function cerrar(numero) {
  sesiones.delete(numero);
}
setInterval(() => {
  const vencidas = Date.now() - INACTIVIDAD_MS;
  const viejas = Date.now() - 6 * 60 * 60 * 1000;
  for (const [numero, sesion] of sesiones) {
    if (sesion.ultimaVez < viejas) sesiones.delete(numero);
    else if (sesion.ultimaVez < vencidas && sesion.cookie) {
      sesiones.set(numero, { ...nueva(), modo: sesion.modo, ultimaVez: sesion.ultimaVez });
    }
  }
}, 60 * 1000).unref();

module.exports = { obtener, cerrar, INACTIVIDAD_MS };
