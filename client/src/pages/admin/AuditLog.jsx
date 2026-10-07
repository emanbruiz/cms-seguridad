import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { api } from '../../api.js';

export default function AuditLog() {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [onlyErrors, setOnlyErrors] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api(`/audit?page=${page}&limit=50${onlyErrors ? '&errors=1' : ''}`)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [page, onlyErrors]);

  const pages = data ? Math.max(Math.ceil(data.total / data.limit), 1) : 1;

  return (
    <section>
      <Link to="/admin" className="text-sm text-blue-700 hover:underline">← Volver al panel</Link>
      <h1 className="mb-4 mt-2 text-2xl font-bold">Auditoría</h1>

      <label className="mb-3 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={onlyErrors}
          onChange={(e) => {
            setOnlyErrors(e.target.checked);
            setPage(1);
          }}
        />
        Solo errores y rechazos (4xx y 5xx)
      </label>

      {error && <p className="mb-3 text-red-600">{error}</p>}
      {!data && !error && <p>Cargando...</p>}

      {data && (
        <div className="overflow-x-auto rounded border border-slate-200 bg-white">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-100">
              <tr>
                <th className="p-2">Fecha</th>
                <th className="p-2">Usuario</th>
                <th className="p-2">Acción</th>
                <th className="p-2">Estado</th>
                <th className="p-2">IP</th>
              </tr>
            </thead>
            <tbody>
              {data.logs.map((l) => (
                <tr key={l._id} className="border-b border-slate-100">
                  <td className="whitespace-nowrap p-2">{new Date(l.createdAt).toLocaleString('es-GT')}</td>
                  <td className="p-2">{l.email || '—'}</td>
                  <td className="p-2 font-mono">{l.action}</td>
                  <td className={`p-2 font-semibold ${l.status >= 400 ? 'text-red-600' : 'text-green-700'}`}>{l.status}</td>
                  <td className="p-2">{l.ip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded border px-3 py-1 disabled:opacity-40">Anterior</button>
          <span>Página {data.page} de {pages} ({data.total} registros)</span>
          <button disabled={page >= pages} onClick={() => setPage(page + 1)} className="rounded border px-3 py-1 disabled:opacity-40">Siguiente</button>
        </div>
      )}
    </section>
  );
}