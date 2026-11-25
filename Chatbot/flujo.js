const { obtenerServicios, buscarServicio, buscarPaso, obtenerClinicas, obtenerHorarios } = require("./catalogo");
const backend = require("./backend");
const sesiones = require("./sesiones");
const m = require("./mensajes");

const POR_PAGINA = 9;
const MAX_PENDIENTES = 8;

const BOTON_MENU = { id: "menu", titulo: m.botonMenu };
const BOTON_ASESOR = { id: "asesor", titulo: m.botonAsesor };
const BOTON_MIS_TRAMITES = { id: "inicio", titulo: m.botonMisTramites };
const BOTON_SALIR = { id: "salir", titulo: m.botonSalir };
const BOTON_EMPEZAR = { id: "inicio", titulo: m.botonEmpezar };

const SALUDOS = ["hola", "inicio", "buenas", "buenos dias", "buenas tardes", "buenas noches"];
const CURP = /^([A-Z][AEIOUX][A-Z]{2}\d{6}[HMX][A-Z]{2}[B-DF-HJ-NP-TV-Z]{3}[A-Z\d]\d|DEMO\d{14})$/;
const normalizar = (texto) =>
  texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

const emojiDe = (servicio) => m.emojisServicios[servicio.id] || m.emojiServicio;
const rellenar = (texto, servicio) =>
  texto.replaceAll("{servicio}", servicio.nombre).replaceAll("{emoji}", emojiDe(servicio));
const recortar = (texto, max) => (texto.length > max ? texto.slice(0, max - 1) + "…" : texto);
const conPrefijo = (prefijo, respuesta) =>
  prefijo ? { ...respuesta, texto: `${prefijo}\n\n${respuesta.texto}` } : respuesta;
function telefonoE164(numero) {
  const digitos = String(numero).replace(/\D/g, "");
  if (/^521\d{10}$/.test(digitos)) return "+52" + digitos.slice(3);
  return "+" + digitos;
}
function leerFecha(texto) {
  const partes = texto.trim().match(/^(\d{1,2})\s*[/\-. ]\s*(\d{1,2})\s*[/\-. ]\s*(\d{4})$/);
  if (!partes) return null;
  const [, dia, mes, anio] = partes.map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  const real = fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia;
  if (!real || anio < 1900 || fecha > new Date()) return null;
  return fecha.toISOString().slice(0, 10);
}
function menuServicios(pagina = 0, texto = m.bienvenida) {
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

  return { texto: pagina === 0 ? texto : m.masServicios, boton: m.botonServicios, tipo: "lista", opciones };
}
function mensajePaso(servicio, idPaso, idOpcion, botonesFinales) {
  const paso = buscarPaso(servicio, idPaso);
  if (!paso) return null;

  const texto =
    idPaso === servicio.checkpointInicial ? m.alElegirServicio : m.pasos[idPaso] || `Listo: ${paso.nombre}.`;

  const opciones = paso.siguientes.map((sig) => {
    const siguiente = buscarPaso(servicio, sig);
    return {
      id: idOpcion(sig),
      titulo: m.etiquetas[sig] || recortar(siguiente?.nombre || sig, 20),
      descripcion: siguiente?.nombre,
    };
  });
  opciones.push(...botonesFinales(opciones.length === 0));

  return { texto: rellenar(texto, servicio), opciones };
}
function pasoInvitado(servicioId, pasoId) {
  const servicio = buscarServicio(servicioId);
  const respuesta =
    servicio &&
    mensajePaso(servicio, pasoId || servicio.checkpointInicial, (sig) => `cp:${servicio.id}:${sig}`, (final) =>
      final ? [BOTON_ASESOR, BOTON_MENU] : [BOTON_MENU]
    );
  return respuesta ? { ...respuesta, texto: respuesta.texto.replaceAll("{clinica}", "Clínica Demo").replaceAll("{horario}", "mañana a las 9:00") }
    : { texto: m.noEntendi, opciones: [BOTON_MENU] };
}
function pasoCaso(sesion, caso, prefijo = "") {
  const servicio = buscarServicio(caso.tipoConsultaId);
  const respuesta =
    servicio &&
    mensajePaso(servicio, caso.pasoActual, (sig) => `cs:${caso.id}:${sig}`, (final) =>
      final ? [BOTON_MIS_TRAMITES, BOTON_SALIR] : [BOTON_MIS_TRAMITES]
    );
  if (!respuesta) return { texto: prefijo + m.pasoDesconocido, opciones: [BOTON_ASESOR, BOTON_MIS_TRAMITES] };

  const info = sesion.casos.get(caso.id);
  const para = info && !info.paraMi ? m.paraFamiliar(info.parentesco) : "";
  const clinica = caso.datos?.clinica || "Por seleccionar";
  const cita = [caso.datos?.fecha, caso.datos?.horario?.slice(0, 5)].filter(Boolean).join(" a las ");
  const texto = respuesta.texto.replaceAll("{clinica}", clinica).replaceAll("{horario}", cita || "Por seleccionar");
  return { ...respuesta, texto: prefijo + para + texto };
}

function bienvenida(sesion, prefijo = "") {
  Object.assign(sesion, { modo: null, estado: null });
  return conPrefijo(prefijo, {
    texto: m.bienvenidaIdentificar,
    opciones: [
      { id: "id:propio", titulo: m.botonMios },
      { id: "id:otro", titulo: m.botonOtroNumero },
    ],
  });
}

async function revisarFecha(numero, sesion, texto) {
  const fecha = leerFecha(texto);
  if (!fecha) return { texto: m.fechaInvalida };

  const r = await backend.identificar(telefonoE164(numero), fecha);
  if (r.bloqueado) {
    Object.assign(sesion, { modo: "invitado", estado: null });
    return { texto: m.bloqueado(r.minutos), opciones: [{ id: "menu", titulo: m.botonVerServicios }, BOTON_ASESOR] };
  }
  if (!r.ok) return { texto: m.fechaNoCoincide(r.intentosRestantes) };

  Object.assign(sesion, { modo: "verificado", estado: null, cookie: r.cookie, patientId: r.patientId, nombre: r.nombre });
  return pantallaPrincipal(sesion, m.saludoVerificado(r.nombre));
}

const paraQuien = (prefijo = "") =>
  conPrefijo(prefijo, {
    texto: m.paraQuien,
    opciones: [
      { id: "para:mi", titulo: m.botonParaMi },
      { id: "para:familiar", titulo: m.botonParaFamiliar },
      BOTON_SALIR,
    ],
  });
async function pantallaPrincipal(sesion, saludo = "") {
  const lista = await backend.pendientes(sesion);
  sesion.casos = new Map(lista.map((c) => [c.id, { patientId: c.patientId, paraMi: c.paraMi, parentesco: c.parentesco }]));
  if (!lista.length) return paraQuien([saludo, m.sinPendientes].filter(Boolean).join("\n"));

  const opciones = lista.slice(0, MAX_PENDIENTES).map((c) => {
    const servicio = buscarServicio(c.tipoConsultaId);
    const paso = servicio && buscarPaso(servicio, c.pasoActual);
    const para = c.paraMi ? m.paraTi : `Para: ${c.parentesco || "familiar"}`;
    return {
      id: `caso:${c.id}`,
      titulo: recortar(servicio ? `${emojiDe(servicio)} ${servicio.nombre}` : c.tipoConsultaId, 24),
      descripcion: recortar(`${para} · ${paso?.nombre || c.pasoActual} · ${m.canales[c.ultimoCanal] || c.ultimoCanal}`, 72),
      seccion: "Pendientes",
    };
  });
  opciones.push(
    { id: "nuevo", titulo: m.opcionNuevo, seccion: "Otras opciones" },
    { id: "salir", titulo: m.opcionSalir, seccion: "Otras opciones" }
  );

  return {
    texto: [saludo, m.tienesPendientes(lista.length)].filter(Boolean).join("\n"),
    boton: m.botonPendientes,
    tipo: "lista",
    opciones,
  };
}

async function iniciarTramite(sesion, servicioId) {
  const servicio = buscarServicio(servicioId);
  if (!servicio) return { texto: m.noEntendi, opciones: [BOTON_MIS_TRAMITES] };

  let caso;
  if (sesion.para === "familiar" && sesion.familiar?.curp) {
    caso = await backend.crearCasoFamiliar(sesion, { tipoConsultaId: servicio.id, ...sesion.familiar });
    if (caso.error) {
      sesion.familiar = null;
      return paraQuien(m.familiarNoValido(caso.error));
    }
    sesion.casos.set(caso.id, { patientId: caso.patientId, paraMi: false, parentesco: caso.datos?.parentesco });
  } else {
    caso = await backend.crearCaso(sesion, servicio.id);
    sesion.casos.set(caso.id, { patientId: caso.patientId, paraMi: true, parentesco: null });
  }
  return pasoCaso(sesion, caso);
}

async function continuarCaso(sesion, caseId) {
  const info = sesion.casos.get(caseId);
  if (!info) return pantallaPrincipal(sesion);

  let caso = await backend.leerCaso(sesion, info.patientId, caseId);
  if (!caso) return pantallaPrincipal(sesion);

  let prefijo = "";
  if (caso.ultimoCanal !== backend.CANAL) {
    const canalAnterior = m.canales[caso.ultimoCanal] || caso.ultimoCanal;
    const r = await backend.retomar(sesion, info.patientId, caseId, caso.version);
    if (r.caso) {
      caso = r.caso;
      prefijo = m.retomado(canalAnterior);
    } else {
      caso = (await backend.leerCaso(sesion, info.patientId, caseId)) || caso;
      prefijo = m.casoCambio;
    }
  }
  return pasoCaso(sesion, caso, prefijo);
}

async function avanzarCaso(sesion, caseId, paso, opcionId) {
  const info = sesion.casos.get(caseId);
  if (!info) return pantallaPrincipal(sesion);

  const caso = await backend.leerCaso(sesion, info.patientId, caseId);
  if (!caso) return pantallaPrincipal(sesion);
  if (caso.pasoActual === paso) return pasoCaso(sesion, caso);

  let datos;
  if (paso === "clinica-seleccionada") {
    const servicio = buscarServicio(caso.tipoConsultaId);
    if (!buscarPaso(servicio, caso.pasoActual)?.siguientes.includes(paso)) return pasoCaso(sesion, caso);
    if (!opcionId) {
      return {
        texto: "Elige una clínica para continuar.",
        tipo: "lista",
        boton: "Ver clínicas",
        opciones: [
          ...obtenerClinicas().map(({ id, nombre }) => ({
            id: `cs:${caso.id}:${paso}:${id}`, titulo: nombre,
          })),
          BOTON_MIS_TRAMITES,
        ],
      };
    }
    const clinica = obtenerClinicas().find(item => item.id === opcionId);
    if (!clinica) return pasoCaso(sesion, caso);
    datos = { clinica: clinica.nombre };
  }

  if (paso === "horario-seleccionado") {
    const servicio = buscarServicio(caso.tipoConsultaId);
    if (!buscarPaso(servicio, caso.pasoActual)?.siguientes.includes(paso)) return pasoCaso(sesion, caso);
    const hoy = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Mexico_City" }).format(new Date());
    const manana = new Date(Date.parse(hoy) + 86_400_000).toISOString().slice(0, 10);
    const horarios = obtenerHorarios();
    if (!opcionId) {
      return {
        texto: `Elige un horario para el ${manana}.`,
        tipo: "lista",
        boton: "Ver horarios",
        opciones: [
          ...horarios.map(hora => ({ id: `cs:${caso.id}:${paso}:${manana}-${hora.replace(":", "")}`, titulo: hora })),
          BOTON_MIS_TRAMITES,
        ],
      };
    }
    const opcion = /^(\d{4}-\d{2}-\d{2})-(\d{2})(\d{2})$/.exec(opcionId);
    const hora = opcion && `${opcion[2]}:${opcion[3]}`;
    if (!opcion || opcion[1] !== manana || !horarios.includes(hora)) return pasoCaso(sesion, caso, "Vuelve a elegir un horario.\n");
    datos = { fecha: opcion[1], horario: hora };
  }

  const r = await backend.guardarPaso(sesion, info.patientId, caseId, paso, caso.version, datos);
  if (r.caso) return pasoCaso(sesion, r.caso);

  const actual = (await backend.leerCaso(sesion, info.patientId, caseId)) || caso;
  return pasoCaso(sesion, actual, m.casoCambio);
}
async function datoEscrito(numero, sesion, entrada) {
  if (sesion.estado === "fecha") return revisarFecha(numero, sesion, entrada);

  if (sesion.estado === "nombre-familiar") {
    const nombre = entrada.trim().replace(/\s+/g, " ");
    if (nombre.length < 3 || nombre.length > 200 || !/\p{L}/u.test(nombre) || /\d/.test(nombre)) {
      return { texto: m.nombreInvalido };
    }
    sesion.familiar.nombreCompleto = nombre;
    sesion.estado = "curp-familiar";
    return { texto: m.pideCurp };
  }

  if (sesion.estado === "curp-familiar") {
    const curp = entrada.replace(/\s/g, "").toUpperCase();
    if (!CURP.test(curp)) return { texto: m.curpInvalida };
    sesion.familiar.curp = curp;
    Object.assign(sesion, { estado: null, para: "familiar" });
    return menuServicios(0, m.servicioParaFamiliar(sesion.familiar.nombreCompleto.split(" ")[0]));
  }

  return null;
}
const esComando = (t) =>
  /^(id|svc|cp|cs|caso|mas|para|par):/.test(t) ||
  ["menu", "salir", "asesor", "nuevo", "gracias", ...SALUDOS].includes(t);

async function decidir(numero, sesion, entrada) {
  const t = normalizar(entrada);

  if (sesion.estado && !esComando(t)) {
    const respuesta = await datoEscrito(numero, sesion, entrada);
    if (respuesta) return respuesta;
  }
  sesion.estado = null;
  if (t === "salir" || t === "cerrar sesion") {
    const estaba = sesion.modo === "verificado";
    sesiones.cerrar(numero);
    return { texto: estaba ? m.sesionCerrada : m.hastaLuego, opciones: [BOTON_EMPEZAR] };
  }
  if (t === "asesor" || t === "hablar con un asesor") {
    return { texto: m.asesor, opciones: [sesion.modo === "verificado" ? BOTON_MIS_TRAMITES : BOTON_MENU] };
  }
  if (t === "gracias") return { texto: m.gracias, opciones: [sesion.modo === "verificado" ? BOTON_MIS_TRAMITES : BOTON_MENU] };
  if (t === "id:propio") {
    Object.assign(sesion, { modo: null, estado: "fecha" });
    return { texto: m.pideFecha };
  }
  if (t === "id:otro") {
    Object.assign(sesion, { modo: "invitado", estado: null });
    return { texto: m.otroNumero, opciones: [{ id: "menu", titulo: m.botonVerServicios }, BOTON_ASESOR] };
  }
  if (sesion.modo === "verificado") {
    if (SALUDOS.includes(t) || t === "menu") return pantallaPrincipal(sesion);
    if (t === "nuevo") return paraQuien();
    if (t === "para:mi") {
      Object.assign(sesion, { para: "mi", familiar: null });
      return menuServicios(0, m.servicioParaMi);
    }
    if (t === "para:familiar") {
      return {
        texto: m.preguntaParentesco,
        opciones: Object.entries(m.parentescos).map(([id, titulo]) => ({ id: `par:${id.toLowerCase()}`, titulo })),
      };
    }
    if (t.startsWith("par:")) {
      const parentesco = t.slice(4).toUpperCase();
      if (!m.parentescos[parentesco]) return paraQuien();
      Object.assign(sesion, { familiar: { parentesco }, estado: "nombre-familiar" });
      return { texto: m.pideNombreFamiliar };
    }
    if (t.startsWith("mas:")) {
      return menuServicios(Number(t.slice(4)) || 0);
    }
    if (t.startsWith("svc:")) return iniciarTramite(sesion, t.slice(4));
    if (t.startsWith("caso:")) return continuarCaso(sesion, t.slice(5));
    if (t.startsWith("cs:")) {
      const [, caseId, paso, opcionId] = t.split(":");
      return avanzarCaso(sesion, caseId, paso, opcionId);
    }
    const servicio = obtenerServicios().find((s) => normalizar(s.nombre) === t || s.id === t);
    if (servicio) return iniciarTramite(sesion, servicio.id);
    return { texto: m.noEntendi, opciones: [BOTON_MIS_TRAMITES] };
  }
  if (/^(caso|cs|para|par):/.test(t) || t === "nuevo") return bienvenida(sesion, m.identificateDeNuevo);
  if (t === "menu" && sesion.modo === "invitado") return menuServicios(0);
  if (t.startsWith("mas:")) return menuServicios(Number(t.slice(4)) || 0);
  if (t.startsWith("svc:")) return pasoInvitado(t.slice(4), null);
  if (t.startsWith("cp:")) {
    const [, servicioId, pasoId] = t.split(":");
    return pasoInvitado(servicioId, pasoId);
  }
  if (sesion.modo === "invitado") {
    const servicio = obtenerServicios().find((s) => normalizar(s.nombre) === t || s.id === t);
    if (servicio) return pasoInvitado(servicio.id, null);
    if (!SALUDOS.includes(t) && t !== "menu") return { texto: m.noEntendi, opciones: [BOTON_MENU] };
  }
  return bienvenida(sesion);
}
async function responder(numero, entrada) {
  const { sesion, vencio } = sesiones.obtener(numero);
  try {
    const respuesta = await decidir(numero, sesion, entrada);
    return vencio ? conPrefijo(m.sesionVencida, respuesta) : respuesta;
  } catch (error) {
    if (error.code === "SESION_VENCIDA") {
      sesiones.cerrar(numero);
      return bienvenida(sesiones.obtener(numero).sesion, m.sesionVencida);
    }
    console.log("Error al consultar el backend:", error.cause?.code || error.message);
    return { texto: m.errorBackend, opciones: [sesion.modo === "verificado" ? BOTON_MIS_TRAMITES : BOTON_MENU] };
  }
}

module.exports = { responder };
