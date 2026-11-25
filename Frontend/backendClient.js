export async function api(path, method = 'GET', body, basePath = '/api') {
  const response = await fetch(basePath + path, {
    method, credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const messages = { 401: 'Verifica tus credenciales o vuelve a iniciar sesión.', 403: 'Tu rol no tiene acceso a esta acción.', 409: 'El caso cambió. Actualízalo antes de continuar.', 503: 'El backend o Redis no está disponible.' };
    throw new Error(Object.values(data?.errors ?? {}).flat().join(' ') || data?.title || messages[response.status] || ('La API respondió con HTTP ' + response.status));
  }
  return data;
}

export const casesPath = patientId => '/pacientes/' + patientId + '/casos';
export const casePath = item => casesPath(item.patientId) + '/' + item.id;
