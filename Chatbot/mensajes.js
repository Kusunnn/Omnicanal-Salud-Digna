// =============================================================
//  AQUI SE CONFIGURAN LOS TEXTOS DEL CHATBOT
//  Los servicios y pasos salen de catalogo.js (ConsultationCatalog.cs).
//  {servicio} se reemplaza por el nombre del servicio elegido.
//  Todo es una SIMULACION: no hay precios, clinicas ni citas reales.
//  Despues de guardar, reinicia el bot (Ctrl + C y luego npm start).
// =============================================================

// OJO con los limites: los emojis tambien cuentan como caracteres
// (algunos cuentan como 2). Si te pasas, el bot avisa en la terminal.

// Menu principal (lista de servicios)
const bienvenida = "👋 Hola, soy el asistente de Salud Digna.\nElige el servicio que te interesa:";
const masServicios = "Más servicios:";
const botonServicios = "Ver servicios"; // maximo 20 caracteres
const verMas = "➡️ Ver más servicios"; // maximo 24 caracteres
const volverInicio = "🏠 Volver al inicio"; // maximo 24 caracteres

// Emoji que aparece antes de cada servicio en la lista (por id del catalogo)
const emojisServicios = {
  laboratorio: "🧪",
  "resonancia-magnetica": "🧲",
  electrocardiograma: "💓",
  lentes: "👓",
  nutricion: "🥗",
  tomografia: "🔍",
  ultrasonido: "🩺",
  papanicolaou: "🌸",
  "rayos-x": "🩻",
  densitometria: "🦴",
  mastografia: "🎀",
  biopsia: "🔬",
  "covid-19": "🦠",
};
const emojiServicio = "🏥"; // si un servicio no tiene emoji en la lista de arriba

// Al elegir un servicio
const alElegirServicio = "{emoji} Elegiste *{servicio}*. ¿Qué quieres hacer?";

// Lo que dice el bot al llegar a cada paso del catalogo
const pasos = {
  // Flujo de cita
  cotizado: "Tu cotización de *{servicio}* está lista (simulada).\n¿Quieres continuar para agendar?",
  "clinica-seleccionada": "Clínica seleccionada: *Clínica Demo* (simulada).",
  "horario-seleccionado": "Horario seleccionado: *mañana a las 9:00* (simulado).\n¿Cómo quieres confirmar tu cita?",
  "cita-confirmada": "✅ Tu cita de *{servicio}* quedó confirmada sin prepago (simulada).",
  "resumen-cita":
    "Resumen de tu cita (simulada):\n• Servicio: {servicio}\n• Clínica: Clínica Demo\n• Horario: mañana a las 9:00\n• Pago: en la clínica",
  "pago-pendiente": "Iniciamos el pago simulado de *{servicio}*.",
  "pago-confirmado": "✅ Pago simulado confirmado.",
  "cita-confirmada-con-pago": "✅ Tu cita de *{servicio}* quedó confirmada con pago (simulada).",
  "resumen-cita-con-pago":
    "Resumen de tu cita (simulada):\n• Servicio: {servicio}\n• Clínica: Clínica Demo\n• Horario: mañana a las 9:00\n• Pago: pagado en línea",
  requisitos: "Estos son los requisitos generales para *{servicio}* (simulados).",
  "resumen-requisitos":
    "Información de *{servicio}* (simulada):\n• Llega 15 minutos antes\n• Trae una identificación oficial\n• Sigue las indicaciones de preparación que te dé la clínica",

  // Flujo de laboratorio
  prerregistro: "Iniciamos tu prerregistro para *{servicio}* (simulado).",
  "datos-revisados": "Revisamos los datos de tu prerregistro (simulado).",
  "prerregistro-confirmado": "✅ Tu prerregistro de laboratorio quedó confirmado (simulado).",
  "resumen-visita":
    "Resumen de tu visita (simulada):\n• Servicio: {servicio}\n• Clínica: Clínica Demo\n• Presenta tu prerregistro en recepción",
  "consultar-estudios": "Te muestro los estudios de laboratorio de la simulación.",
  "resumen-estudios":
    "Estudios disponibles en la simulación:\n• Química sanguínea\n• Biometría hemática\n• Examen general de orina",
};

// Texto del boton que lleva a cada paso (maximo 20 caracteres, con emoji)
const etiquetas = {
  cotizado: "💲 Cotizar",
  requisitos: "📋 Ver requisitos",
  "clinica-seleccionada": "🏥 Elegir clínica",
  "horario-seleccionado": "🕘 Elegir horario",
  "cita-confirmada": "✅ Confirmar sin pago",
  "pago-pendiente": "💳 Pagar en línea",
  "resumen-cita": "📄 Ver resumen",
  "pago-confirmado": "✅ Confirmar pago",
  "cita-confirmada-con-pago": "✅ Confirmar cita",
  "resumen-cita-con-pago": "📄 Ver resumen",
  "resumen-requisitos": "📖 Ver información",
  prerregistro: "📝 Prerregistro",
  "datos-revisados": "🔎 Revisar datos",
  "prerregistro-confirmado": "✅ Confirmar",
  "resumen-visita": "📄 Ver resumen",
  "consultar-estudios": "🧪 Ver estudios",
  "resumen-estudios": "📋 Ver lista",
};

// Botones fijos
const botonMenu = "🏠 Menú principal";
const botonAsesor = "💬 Hablar con asesor";
const opcionAsesor = "💬 Hablar con un asesor"; // en la lista del menu (maximo 24)

// Otras respuestas
const asesor = "💬 En un momento te atiende un asesor. Gracias por tu paciencia.";
const gracias = "😊 Con gusto. Escribe *menu* si necesitas algo más.";
const noEntendi = "🤔 No te entendí. Toca *Menú principal* o escribe el nombre de un servicio.";

// ---------------------------------------------------------------
// Identificacion del paciente
// ---------------------------------------------------------------
const bienvenidaIdentificar = "👋 Hola, soy el asistente de Salud Digna.\n¿De quién son los trámites que quieres ver?";
const botonMios = "Míos, este número"; // maximo 20 caracteres
const botonOtroNumero = "Usar otro número"; // maximo 20 caracteres
const pideFecha = "🔒 Para proteger tus datos, escribe tu fecha de nacimiento.\nEjemplo: 15/03/1990";
const fechaInvalida = "🤔 No entendí la fecha. Escríbela así: 15/03/1990 (día/mes/año).";
// Nunca decir cual dato fallo (asi nadie averigua que numeros son pacientes)
const fechaNoCoincide = (restantes) =>
  `❌ Los datos no coinciden. Revisa tu fecha de nacimiento e inténtalo de nuevo.\n` +
  (restantes === 1 ? "Te queda 1 intento." : `Te quedan ${restantes} intentos.`);
const bloqueado = (minutos) =>
  `🔒 Por seguridad no puedo mostrar tus trámites ahora.\nPuedes intentarlo de nuevo en ${minutos} minutos.\nMientras tanto puedes:`;
const otroNumero =
  "🔒 Por seguridad, tus trámites solo se pueden ver desde el WhatsApp con el que te registraste.\nDesde este celular puedes:";
const botonVerServicios = "📋 Ver servicios";
const identificateDeNuevo = "🔒 Para continuar con tus trámites necesito confirmar que eres tú.";

// ---------------------------------------------------------------
// Paciente identificado
// ---------------------------------------------------------------
const saludoVerificado = (nombre) => `✅ ¡Listo${nombre ? `, ${nombre}` : ""}!`;
const tienesPendientes = (n) => (n === 1 ? "Tienes 1 trámite pendiente:" : `Tienes ${n} trámites pendientes:`);
const sinPendientes = "No tienes trámites pendientes.";
const botonPendientes = "Ver pendientes"; // maximo 20 caracteres
const paraTi = "Para ti";
const opcionNuevo = "➕ Trámite nuevo"; // maximo 24
const opcionSalir = "🚪 Cerrar sesión"; // maximo 24
const paraQuien = "¿Para quién es la cita?";
const botonParaMi = "🙋 Para mí";
const botonParaFamiliar = "👥 Para un familiar";
const servicioParaMi = "¿Qué servicio necesitas?";

// Citas para familiares
const preguntaParentesco = "¿Qué es de ti?";
const parentescos = { HIJO: "👶 Hijo(a)", PADRE_MADRE: "👵 Padre/Madre", OTRO: "👤 Otro familiar" }; // maximo 20
const pideNombreFamiliar = "Escribe su nombre completo (nombre y apellidos):";
const nombreInvalido = "🤔 Escribe el nombre completo, solo con letras (nombre y apellidos).";
const pideCurp = "Ahora escribe su CURP (18 caracteres).\nLa encuentras en su acta de nacimiento o en gob.mx/curp";
const curpInvalida = "🤔 Esa CURP no parece válida. Revisa que tenga 18 caracteres e inténtalo de nuevo.";
const servicioParaFamiliar = (nombre) => `¿Qué servicio necesita ${nombre}?`;
const familiarNoValido = (detalle) => `😕 No pude registrar al familiar: ${detalle}`;
const paraFamiliar = (parentesco) => `👥 Trámite para: *${parentesco || "tu familiar"}*\n`;

// Continuar tramites
const canales = { WEB: "la web", WHATSAPP: "WhatsApp", CALL_CENTER: "el call center", APP: "la app", CLINICA: "la clínica" };
const retomado = (canal) => `🔄 Seguimos con el trámite que empezaste en ${canal}.\n`;
const casoCambio = "🔄 Este trámite cambió desde otro canal. Este es el paso actual:\n";
const pasoDesconocido = "Este trámite ya no se puede continuar por aquí. Un asesor te puede ayudar.";
const botonMisTramites = "🏠 Mis trámites";

// Sesion
const botonSalir = "🚪 Cerrar sesión";
const botonEmpezar = "👋 Empezar";
const sesionCerrada = "🚪 Sesión cerrada. Cuando quieras volver, escribe *hola*.";
const hastaLuego = "👋 ¡Hasta luego! Cuando quieras volver, escribe *hola*.";
const sesionVencida = "⏱️ Tu sesión se cerró por inactividad.";
const errorBackend = "😕 Tuvimos un problema para consultar tus trámites. Inténtalo en un momento.";

module.exports = {
  bienvenidaIdentificar,
  botonMios,
  botonOtroNumero,
  pideFecha,
  fechaInvalida,
  fechaNoCoincide,
  bloqueado,
  otroNumero,
  botonVerServicios,
  identificateDeNuevo,
  saludoVerificado,
  tienesPendientes,
  sinPendientes,
  botonPendientes,
  paraTi,
  opcionNuevo,
  opcionSalir,
  paraQuien,
  botonParaMi,
  botonParaFamiliar,
  servicioParaMi,
  preguntaParentesco,
  parentescos,
  pideNombreFamiliar,
  nombreInvalido,
  pideCurp,
  curpInvalida,
  servicioParaFamiliar,
  familiarNoValido,
  paraFamiliar,
  canales,
  retomado,
  casoCambio,
  pasoDesconocido,
  botonMisTramites,
  botonSalir,
  botonEmpezar,
  sesionCerrada,
  hastaLuego,
  sesionVencida,
  errorBackend,
  bienvenida,
  masServicios,
  botonServicios,
  verMas,
  volverInicio,
  emojisServicios,
  emojiServicio,
  opcionAsesor,
  alElegirServicio,
  pasos,
  etiquetas,
  botonMenu,
  botonAsesor,
  asesor,
  gracias,
  noEntendi,
};
