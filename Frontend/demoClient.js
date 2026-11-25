const storageKey = 'salud-digna-demo-casos-v1';
const patientId = 'DEMO-PACIENTE-01';
const steps = ['inicio', 'cotizado', 'clinica-seleccionada', 'horario-seleccionado', 'cita-confirmada'];

const initialCases = [{
  id: 'DEMO-WHATSAPP-01',
  patientId,
  tipoConsultaId: 'ultrasonido',
  pasoActual: 'clinica-seleccionada',
  estado: 'INTERRUMPIDO',
  ultimoCanal: 'WHATSAPP',
  version: 1,
  datos: { estudio: 'Ultrasonido', clinica: 'Chihuahua Nueva España' },
}];

function readCases() {
  const stored = window.localStorage.getItem(storageKey);
  return stored ? JSON.parse(stored) : initialCases;
}

function saveCase(cases, item) {
  const updated = { ...item, updatedAt: new Date().toISOString() };
  window.localStorage.setItem(storageKey, JSON.stringify([
    updated,
    ...cases.filter(existing => existing.id !== item.id),
  ]));
  return updated;
}

export async function demoApi(path, method = 'GET', body = {}) {
  if (path === '/demo/identidad/paciente' && method === 'POST') return { patientId, rol: 'PACIENTE' };
  if (path === '/demo/identidad/personal' && method === 'POST' && body.rol === 'ADMIN') return { rol: 'ADMIN' };
  const route = path.split('?')[0];
  if (route === '/tablero/casos' && method === 'GET') return readCases().slice(0, 100);
  const match = route.match(/^\/pacientes\/([^/]+)\/casos(?:\/([^/]+))?(?:\/(checkpoint|retomar))?$/);
  if (!match || match[1] !== patientId) throw new Error('Ruta de demostración no disponible.');

  const [, , caseId, action] = match;
  const cases = readCases();
  if (!caseId && method === 'GET') return cases;
  if (!caseId && method === 'POST') {
    return saveCase(cases, {
      id: crypto.randomUUID(), patientId, tipoConsultaId: body.tipoConsultaId,
      pasoActual: 'inicio', estado: 'EN_PROGRESO', ultimoCanal: body.canal, version: 1,
      datos: body.datos ?? {},
    });
  }

  const item = cases.find(existing => existing.id === caseId);
  if (!item) throw new Error('No se encontró el caso de demostración.');
  if (!action && method === 'GET') return item;
  if (item.version !== body.versionEsperada || item.estado === 'COMPLETADO') {
    throw new Error('El caso cambió. Vuelve al tablero para actualizarlo.');
  }

  if (action === 'retomar' && method === 'POST') {
    return saveCase(cases, { ...item, ultimoCanal: body.canal, estado: 'EN_PROGRESO', version: item.version + 1 });
  }
  if (action === 'checkpoint' && method === 'PUT') {
    const current = steps.indexOf(item.pasoActual);
    const next = steps.indexOf(body.pasoActual);
    if (current < 0 || next < current || next > current + 1) throw new Error('El paso solicitado no está disponible.');
    return saveCase(cases, {
      ...item, pasoActual: body.pasoActual, ultimoCanal: body.canal, version: item.version + 1,
      estado: body.pasoActual === 'cita-confirmada' ? 'COMPLETADO' : 'EN_PROGRESO',
      datos: { ...item.datos, ...body.datos },
    });
  }
  throw new Error('Acción de demostración no disponible.');
}
