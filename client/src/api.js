// Mensaje cuando la respuesta no trae JSON (por ejemplo, un bloqueo del WAF, que responde con HTML)
function mensajeSinJson(status) {
  if (status === 403) return 'El firewall de aplicaciones bloqueó la solicitud porque parece un ataque (por ejemplo, HTML o scripts en el texto).';
  if (status === 413) return 'El contenido es demasiado grande.';
  if (status === 429) return 'Demasiadas solicitudes seguidas, esperá un momento.';
  return 'No se pudo completar la solicitud. Revisá tu conexión e intentá de nuevo.';
}

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || mensajeSinJson(res.status));
    err.status = res.status;
    err.details = data.details;
    throw err;
  }
  return data;
}

export async function uploadImage(file) {
  const body = new FormData();
  body.append('file', file);
  const res = await fetch('/api/media', { method: 'POST', credentials: 'same-origin', body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || mensajeSinJson(res.status));
    err.status = res.status;
    throw err;
  }
  return data;
}