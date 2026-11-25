// Sesion de cada numero de WhatsApp: si ya se identifico, que dato esta esperando el bot
// y los tramites que se le mostraron. Vive en memoria: si el bot se reinicia,
// el paciente vuelve a identificarse (asi nadie queda con una sesion vieja abierta).

const INACTIVIDAD_MS = 10 * 60 * 1000; // la sesion se cierra sola tras 10 minutos sin mensajes

const sesiones = new Map();

function nueva() {
  return {
    modo: null, // null = sin elegir, "invitado" = solo catalogo, "verificado" = paciente identificado
    estado: null, // dato que el bot espera que escriba: "fecha", "nombre-familiar", "curp-familiar"
    cookie: null,
    patientId: null,
    nombre: null,
    para: null, // "mi" o "familiar": para quien es el tramite nuevo
    familiar: null, // { parentesco, nombreCompleto, curp }
    casos: new Map(), // id del caso -> { patientId, paraMi, parentesco }
    ultimaVez: Date.now(),
  };
}

// Regresa la sesion del numero y si la anterior se cerro por inactividad
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

// Cada minuto: las sesiones vencidas pierden la cookie y los datos del paciente al instante.
// Solo se guarda que existio, para avisarle "tu sesion se cerro" si vuelve a escribir;
// despues de 6 horas se borra por completo. (unref: no impide que el proceso termine)
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
