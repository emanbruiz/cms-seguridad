export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Error de red');
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
    const err = new Error(data.error || 'Error de red');
    err.status = res.status;
    throw err;
  }
  return data;
}