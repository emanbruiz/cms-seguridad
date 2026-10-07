import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { api } from '../../api.js';
import { useAuth } from '../../context/AuthContext.jsx';

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [tick, setTick] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    api(`/posts/manage?page=${page}&limit=10`)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [page, tick]);

  const remove = async (post) => {
    if (!window.confirm(`¿Borrar "${post.title}"?`)) return;
    setError('');
    try {
      await api(`/posts/${post._id}`, { method: 'DELETE' });
      setTick((t) => t + 1);
    } catch (err) {
      setError(err.message);
    }
  };

  const pages = data ? Math.max(Math.ceil(data.total / data.limit), 1) : 1;

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          {user.role === 'admin' ? 'Todas las publicaciones' : 'Mis publicaciones'}
        </h1>
        <div className="flex gap-2 text-sm">
          {user.role === 'admin' && (
            <>
              <Link to="/admin/users" className="rounded border border-slate-300 px-3 py-1 hover:bg-slate-100">Usuarios</Link>
              <Link to="/admin/audit" className="rounded border border-slate-300 px-3 py-1 hover:bg-slate-100">Auditoría</Link>
            </>
          )}
          <Link to="/admin/posts/new" className="rounded bg-slate-900 px-3 py-1 text-white hover:bg-slate-700">Nuevo post</Link>
        </div>
      </div>

      {error && <p className="mb-3 text-red-600">{error}</p>}
      {!data && !error && <p>Cargando...</p>}
      {data && data.posts.length === 0 && <p>No hay publicaciones todavía.</p>}

      {data && (
        <ul className="space-y-3">
          {data.posts.map((p) => (
            <li key={p._id} className="flex items-center justify-between rounded border border-slate-200 bg-white p-4">
              <div>
                <p className="font-semibold">{p.title}</p>
                <p className="text-sm text-slate-500">
                  {p.author?.name} · {p.status}
                </p>
              </div>
              <div className="flex gap-2 text-sm">
                <Link to={`/admin/posts/${p._id}/edit`} className="rounded border border-slate-300 px-3 py-1 hover:bg-slate-100">Editar</Link>
                <button onClick={() => remove(p)} className="rounded bg-red-600 px-3 py-1 text-white hover:bg-red-500">Borrar</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {data && pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded border px-3 py-1 disabled:opacity-40">Anterior</button>
          <span>Página {data.page} de {pages}</span>
          <button disabled={page >= pages} onClick={() => setPage(page + 1)} className="rounded border px-3 py-1 disabled:opacity-40">Siguiente</button>
        </div>
      )}
    </section>
  );
}