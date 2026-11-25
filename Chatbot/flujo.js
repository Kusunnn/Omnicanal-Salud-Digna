// Decide que contestar.
//
// 1. Al iniciar, el bot pregunta de quien son los tramites:
//    - "Mios, este numero": usa el numero de WhatsApp (lo pone Meta, no se puede falsificar)
//      y pide la fecha de nacimiento. El backend lleva la cuenta: 3 fallos = 15 min bloqueado.
//    - "Usar otro numero": por seguridad no muestra datos personales; solo catalogo o asesor.
// 2. Ya identificado, muestra sus tramites pendientes de cualquier canal (web, call center...)
//    y los de familiares que el pidio, para continuarlos desde el paso donde se quedaron.
// 3. Puede iniciar un tramite para el o para un familiar.
//
// Sin identificarse (invitado) el catalogo funciona como antes y no guarda nada: el id de cada
// boton lleva el servicio y el paso (por ejemplo "cp:ultrasonido:cotizado").

const { obtenerServicios, buscarServicio, buscarPaso } = require("./catalogo");
const backend = require("./backend");
const sesiones = require("./sesiones");
const m = require("./mensajes");

const POR_PAGINA = 9; // 9 opciones + "Ver más servicios" = 10 (maximo de una lista)
const MAX_PENDIENTES = 8; // 8 tramites + "Trámite nuevo" + "Cerrar sesión" = 10

const BOTON_MENU = { id: "menu", titulo: m.botonMenu };
const BOTON_ASESOR = { id: "asesor", titulo: m.botonAsesor };
const BOTON_MIS_TRAMITES = { id: "inicio", titulo: m.botonMisTramites };
const BOTON_SALIR = { id: "salir", titulo: m.botonSalir };
const BOTON_EMPEZAR = { id: "inicio", titulo: m.botonEmpezar };

const SALUDOS = ["hola", "inicio", "buenas", "buenos dias", "buenas tardes", "buenas noches"];
const CURP = /^([A-Z][AEIOUX][A-Z]{2}\d{6}[HMX][A-Z]{2}[B-DF-HJ-NP-TV-Z]{3}[A-Z\d]\d|DEMO\d{14})$/;

// Minusculas, sin acentos ni espacios extra (para comparar lo que escribe la persona)
const normalizar = (texto) =>
  texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

const emojiDe = (servicio) => m.emojisServicios[servicio.id] || m.emojiServicio;
const rellenar = (texto, servicio) =>
  texto.replaceAll("{servicio}", servicio.nombre).replaceAll("{emoji}", emojiDe(servicio));
const recortar = (texto, max) => (texto.length > max ? texto.slice(0, max - 1) + "…" : texto);
const conPrefijo = (prefijo, respuesta) =>
  prefijo ? { ...respuesta, texto: `${prefijo}\n\n${respuesta.texto}` } : respuesta;

// WhatsApp manda "5216671234567" (Mexico con 1). En la base de datos esta como "+526671234567".
function telefonoE164(numero) {
  const digitos = String(numero).replace(/\D/g, "");
  if (/^521\d{10}$/.test(digitos)) return "+52" + digitos.slice(3);
  return "+" + digitos;
}

// "15/03/1990", "15-3-1990" o "15.03.1990" -> "1990-03-15" (null si no es una fecha real)
function leerFecha(texto) {
  const partes = texto.trim().match(/^(\d{1,2})\s*[/\-. ]\s*(\d{1,2})\s*[/\-. ]\s*(\d{4})$/);
  if (!partes) return null;
  const [, dia, mes, anio] = partes.map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  const real = fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia;
  if (!real || anio < 1900 || fecha > new Date()) return null;
  return fecha.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Catalogo (invitado y paciente)
// ---------------------------------------------------------------------------

// Lista con los servicios del catalogo (en paginas si son mas de 10)
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

// Arma el mensaje de un paso. "idOpcion" decide el id de cada boton siguiente.
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

// Paso de un servicio como invitado (no se guarda nada)
function pasoInvitado(servicioId, pasoId) {
  const servicio = buscarServicio(servicioId);
  const respuesta =
    servicio &&
    mensajePaso(servicio, pasoId || servicio.checkpointInicial, (sig) => `cp:${servicio.id}:${sig}`, (final) =>
      final ? [BOTON_ASESOR, BOTON_MENU] : [BOTON_MENU]
    );
  return respuesta || { texto: m.noEntendi, opciones: [BOTON_MENU] };
}

// Paso de un caso real del paciente (cada boton guarda el avance en el backend)
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
  return { ...respuesta, texto: prefijo + para + respuesta.texto };
}

// ---------------------------------------------------------------------------
// Identificacion
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Paciente identificado
// ---------------------------------------------------------------------------

const paraQuien = (prefijo = "") =>
  conPrefijo(prefijo, {
    texto: m.paraQuien,
    opciones: [
      { id: "para:mi", titulo: m.botonParaMi },
      { id: "para:familiar", titulo: m.botonParaFamiliar },
      BOTON_SALIR,
    ],
  });

// Tramites pendientes (de cualquier canal) o, si no hay, "¿para quien es la cita?"
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

async function avanzarCaso(sesion, caseId, paso) {
  const info = sesion.casos.get(caseId);
  if (!info) return pantallaPrincipal(sesion);

  const caso = await backend.leerCaso(sesion, info.patientId, caseId);
  if (!caso) return pantallaPrincipal(sesion);
  if (caso.pasoActual === paso) return pasoCaso(sesion, caso); // toco dos veces el mismo boton

  const r = await backend.guardarPaso(sesion, info.patientId, caseId, paso, caso.version);
  if (r.caso) return pasoCaso(sesion, r.caso);

  const actual = (await backend.leerCaso(sesion, info.patientId, caseId)) || caso;
  return pasoCaso(sesion, actual, m.casoCambio);
}

// Lo que escribe el paciente cuando el bot le pidio un dato
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

// ---------------------------------------------------------------------------
// Entrada principal
// ---------------------------------------------------------------------------

// Botones y palabras clave: si llegan mientras el bot espera un dato, cuentan como comando
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

  // Siempre disponibles
  if (t === "salir" || t === "cerrar sesion") {
    const estaba = sesion.modo === "verificado";
    sesiones.cerrar(numero);
    return { texto: estaba ? m.sesionCerrada : m.hastaLuego, opciones: [BOTON_EMPEZAR] };
  }
  if (t === "asesor" || t === "hablar con un asesor") {
    return { texto: m.asesor, opciones: [sesion.modo === "verificado" ? BOTON_MIS_TRAMITES : BOTON_MENU] };
  }
  if (t === "gracias") return { texto: m.gracias, opciones: [sesion.modo === "verificado" ? BOTON_MIS_TRAMITES : BOTON_MENU] };

  // Eleccion inicial
  if (t === "id:propio") {
    Object.assign(sesion, { modo: null, estado: "fecha" });
    return { texto: m.pideFecha };
  }
  if (t === "id:otro") {
    Object.assign(sesion, { modo: "invitado", estado: null });
    return { texto: m.otroNumero, opciones: [{ id: "menu", titulo: m.botonVerServicios }, BOTON_ASESOR] };
  }

  // Paciente identificado
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
      const [, caseId, paso] = t.split(":");
      return avanzarCaso(sesion, caseId, paso);
    }

    // Si escribe el nombre de un servicio (ej. "rayos x"), inicia ese tramite
    const servicio = obtenerServicios().find((s) => normalizar(s.nombre) === t || s.id === t);
    if (servicio) return iniciarTramite(sesion, servicio.id);
    return { texto: m.noEntendi, opciones: [BOTON_MIS_TRAMITES] };
  }

  // Botones de un caso real sin sesion (por ejemplo, despues de cerrar sesion)
  if (/^(caso|cs|para|par):/.test(t) || t === "nuevo") return bienvenida(sesion, m.identificateDeNuevo);

  // Invitado: catalogo sin datos personales
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

  // Cualquier otra cosa: empezar
  return bienvenida(sesion);
}

// Recibe el numero de WhatsApp y lo que escribio o toco la persona
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

module.exports = { responder, telefonoE164, leerFecha };
