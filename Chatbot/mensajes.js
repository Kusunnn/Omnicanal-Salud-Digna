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

module.exports = {
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
