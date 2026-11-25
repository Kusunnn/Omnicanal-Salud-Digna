const crypto = require("crypto");

const BACKEND_LOCAL = "http://localhost:5080";
const CANAL = "WHATSAPP";
const COOKIE = "salud-digna-session";

const baseUrl = () => (process.env.BACKEND_URL?.trim() || BACKEND_LOCAL).replace(/\/+$/, "");

class SesionVencida extends Error {
  constructor() {
    super("La sesión del paciente venció en el backend");
    this.code = "SESION_VENCIDA";
  }
}
function leerCookie(respuesta) {
  const cookies = respuesta.headers.getSetCookie?.() || [];
  const sesion = cookies.map((c) => c.split(";")[0]).filter((c) => c.startsWith(COOKIE));
  return sesion.length ? sesion.join("; ") : null;
}

async function llamar(ruta, { metodo = "GET", cuerpo, sesion } = {}) {
  const headers = { "X-Chatbot-Key": process.env.CHATBOT_API_KEY || "" };
  if (cuerpo) headers["Content-Type"] = "application/json";
  if (sesion?.cookie) headers.Cookie = sesion.cookie;

  const respuesta = await fetch(baseUrl() + ruta, {
    method: metodo,
    headers,
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    signal: AbortSignal.timeout(8000),
  });

  const cookie = leerCookie(respuesta);
  if (cookie && sesion) sesion.cookie = cookie;

  let datos = null;
  try {
    datos = await respuesta.json();
  } catch {
  }
  if (sesion && respuesta.status === 401) throw new SesionVencida();
  return { status: respuesta.status, datos, cookie };
}

function falla(ruta, resultado) {
  return new Error(`El backend respondió ${resultado.status} en ${ruta}`);
}
async function identificar(telefono, fechaNacimiento) {
  const ruta = "/api/chatbot/identidad";
  const r = await llamar(ruta, { metodo: "POST", cuerpo: { telefono, fechaNacimiento } });
  if (r.status === 200 && r.cookie) return { ok: true, cookie: r.cookie, ...r.datos };
  if (r.status === 401 && Number.isInteger(r.datos?.intentosRestantes)) {
    return { ok: false, intentosRestantes: r.datos.intentosRestantes };
  }
  if (r.status === 423) return { ok: false, bloqueado: true, minutos: r.datos?.minutosRestantes ?? 15 };
  if (r.status === 404) throw new Error("El backend no tiene configurada la clave Chatbot:ApiKey");
  if (r.status === 401) throw new Error("CHATBOT_API_KEY no coincide con Chatbot:ApiKey del backend");
  throw falla(ruta, r);
}

async function pendientes(sesion) {
  const ruta = "/api/chatbot/pendientes";
  const r = await llamar(ruta, { sesion });
  if (r.status !== 200) throw falla(ruta, r);
  return r.datos;
}

async function crearCaso(sesion, tipoConsultaId) {
  const ruta = `/api/pacientes/${sesion.patientId}/casos`;
  const r = await llamar(ruta, { metodo: "POST", sesion, cuerpo: { tipoConsultaId, canal: CANAL, datos: { parentesco: "Para mí" } } });
  if (r.status !== 201) throw falla(ruta, r);
  return r.datos;
}

async function crearCasoFamiliar(sesion, { tipoConsultaId, parentesco, nombreCompleto, curp }) {
  const ruta = "/api/chatbot/familiares/casos";
  const r = await llamar(ruta, {
    metodo: "POST",
    sesion,
    cuerpo: { tipoConsultaId, parentesco, nombreCompleto, curp },
  });
  if (r.status === 400) return { error: r.datos?.title || "Datos no válidos" };
  if (r.status !== 201) throw falla(ruta, r);
  return r.datos;
}

async function leerCaso(sesion, patientId, caseId) {
  const ruta = `/api/pacientes/${patientId}/casos/${caseId}`;
  const r = await llamar(ruta, { sesion });
  if (r.status === 404) return null;
  if (r.status !== 200) throw falla(ruta, r);
  return r.datos;
}
async function guardarPaso(sesion, patientId, caseId, pasoActual, versionEsperada, datos) {
  const ruta = `/api/pacientes/${patientId}/casos/${caseId}/checkpoint`;
  const r = await llamar(ruta, {
    metodo: "PUT",
    sesion,
    cuerpo: { pasoActual, canal: CANAL, versionEsperada, datos },
  });
  if (r.status === 200 || r.status === 202) return { caso: r.datos };
  if (r.status === 409 || r.status === 400) return { conflicto: true };
  throw falla(ruta, r);
}
async function retomar(sesion, patientId, caseId, versionEsperada) {
  const ruta = `/api/pacientes/${patientId}/casos/${caseId}/retomar`;
  const r = await llamar(ruta, {
    metodo: "POST",
    sesion,
    cuerpo: { canal: CANAL, versionEsperada, interaccionId: crypto.randomUUID() },
  });
  if (r.status === 200) return { caso: r.datos };
  if (r.status === 409) return { conflicto: true };
  throw falla(ruta, r);
}

module.exports = {
  CANAL,
  identificar,
  pendientes,
  crearCaso,
  crearCasoFamiliar,
  leerCaso,
  guardarPaso,
  retomar,
};
