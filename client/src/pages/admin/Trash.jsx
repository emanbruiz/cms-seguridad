import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { api } from '../../api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useUI } from '../../components/ui.jsx';

const DIAS_RETENCION = 30;

function diasRestantes(deletedAt) {
  const limite = new Date(deletedAt).getTime() + DIAS_RETENCION * 24 * 60 * 60 * 1000;
  return Math.max(Math.ceil((limite - Date.now()) / (24 * 60 * 60 * 1000)), 0);
}

export default function Trash() {
  const { user } = useAuth();
  const { confirm, toast } = useUI();
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [tick, setTick] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    api(`/posts/trash?page=${page}&limit=10`)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [page, tick]);

  const restaurar = async (post) => {
    setError('');
    try {
      await api(`/posts/${post._id}/restore`, { method: 'POST' });
      toast(`"${post.title}" se restauró como borrador.`);
      setTick((t) => t + 1);
    } catch (err) {
      setError(err.message);
    }
  };

  const eliminar = async (post) => {
    const ok = await confirm({
      title: 'Eliminar definitivamente',
      message: `"${post.title}" se eliminará para siempre. Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      danger: true,
    });
    if (!ok) return;
    setError('');
    try {
      await api(`/posts/${post._id}/permanent`, { method: 'DELETE' });
      toast(`"${post.title}" se eliminó definitivamente.`);
      setTick((t) => t + 1);
    } catch (err) {
      setError(err.message);
    }
  };

  const pages = data ? Math.max(Math.ceil(data.total / data.limit), 1) : 1;

  return (
    <section>
      <Link to="/admin" className="link text-sm">← Volver al panel</Link>
      <h1 className="page-title mt-2 mb-1">Papelera</h1>
      <p className="muted mb-6">
        {user.role === 'admin' ? 'Publicaciones enviadas a la papelera por cualquier usuario.' : 'Tus publicaciones enviadas a la papelera.'}{' '}
        Se eliminan solas a los {DIAS_RETENCION} días. Al restaurarlas vuelven como borrador.
      </p>

      {error && <p className="mb-3 text-red-600">{error}</p>}
      {!data && !error && <p>Cargando...</p>}
      {data && data.posts.length === 0 && <p>La papelera está vacía.</p>}

      {data && (
        <ul className="space-y-3">
          {data.posts.map((p) => (
            <li key={p._id} className="card flex flex-wrap items-center justify-between gap-4 p-5">
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">{p.title}</p>
                <p className="muted mt-1">
                  {p.author?.name} · enviado por {p.deletedBy?.name || 'desconocido'} el{' '}
                  {new Date(p.deletedAt).toLocaleDateString('es-GT')} · se elimina en {diasRestantes(p.deletedAt)} días
                </p>
              </div>
              <div className="flex gap-2 text-sm">
                <button onClick={() => restaurar(p)} className="btn btn-secondary btn-sm">Restaurar</button>
                <button onClick={() => eliminar(p)} className="btn btn-danger btn-sm">Eliminar definitivamente</button>
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
