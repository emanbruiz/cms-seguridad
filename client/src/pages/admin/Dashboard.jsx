import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { api } from '../../api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useUI } from '../../components/ui.jsx';

export default function Dashboard() {
  const { user } = useAuth();
  const { confirm, toast } = useUI();
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
    const ok = await confirm({
      title: 'Enviar a la papelera',
      message: `"${post.title}" dejará de verse en el sitio. Podrás restaurarlo durante 30 días.`,
      confirmText: 'Enviar a la papelera',
      danger: true,
    });
    if (!ok) return;
    setError('');
    try {
      await api(`/posts/${post._id}`, { method: 'DELETE' });
      toast(`"${post.title}" se envió a la papelera.`);
      setTick((t) => t + 1);
    } catch (err) {
      setError(err.message);
    }
  };

  const pages = data ? Math.max(Math.ceil(data.total / data.limit), 1) : 1;

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="page-title">
          {user.role === 'admin' ? 'Todas las publicaciones' : 'Mis publicaciones'}
        </h1>
        <div className="flex gap-2 text-sm">
          {user.role === 'admin' && (
            <>
              <Link to="/admin/users" className="btn btn-secondary btn-sm">Usuarios</Link>
              <Link to="/admin/audit" className="btn btn-secondary btn-sm">Auditoría</Link>
            </>
          )}
          <Link to="/admin/trash" className="btn btn-secondary btn-sm">Papelera</Link>
          <Link to="/admin/posts/new" className="btn btn-primary btn-sm">Nuevo post</Link>
        </div>
      </div>

      {error && <p className="mb-3 text-red-600">{error}</p>}
      {!data && !error && <p>Cargando...</p>}
      {data && data.posts.length === 0 && <p>No hay publicaciones todavía.</p>}

      {data && (
        <ul className="space-y-3">
          {data.posts.map((p) => (
            <li key={p._id} className="card flex flex-wrap items-center justify-between gap-4 p-5">
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">{p.title}</p>
                <p className="muted mt-1 flex items-center gap-2">
                  {p.author?.name}
                  <span className={`badge ${p.status === 'publicado' ? 'badge-green' : 'badge-slate'}`}>{p.status}</span>
                </p>
              </div>
              <div className="flex gap-2 text-sm">
                <Link to={`/admin/posts/${p._id}/edit`} className="btn btn-secondary btn-sm">Editar</Link>
                <button onClick={() => remove(p)} className="btn btn-danger btn-sm">Enviar a la papelera</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {data && pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="btn btn-secondary btn-sm">Anterior</button>
          <span>Página {data.page} de {pages}</span>
          <button disabled={page >= pages} onClick={() => setPage(page + 1)} className="btn btn-secondary btn-sm">Siguiente</button>
        </div>
      )}
    </section>
  );
}