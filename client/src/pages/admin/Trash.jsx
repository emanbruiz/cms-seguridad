import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { api } from '../../api.js';
import { useAuth } from '../../context/AuthContext.jsx';

const DIAS_RETENCION = 30;

function diasRestantes(deletedAt) {
  const limite = new Date(deletedAt).getTime() + DIAS_RETENCION * 24 * 60 * 60 * 1000;
  return Math.max(Math.ceil((limite - Date.now()) / (24 * 60 * 60 * 1000)), 0);
}

export default function Trash() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [tick, setTick] = useState(0);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  useEffect(() => {
    api(`/posts/trash?page=${page}&limit=10`)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [page, tick]);

  const restaurar = async (post) => {
    setError('');
    setAviso('');
    try {
      await api(`/posts/${post._id}/restore`, { method: 'POST' });
      setAviso(`"${post.title}" se restauró como borrador.`);
      setTick((t) => t + 1);
    } catch (err) {
      setError(err.message);
    }
  };

  const eliminar = async (post) => {
    if (!window.confirm(`¿Eliminar "${post.title}" definitivamente? Esta acción no se puede deshacer.`)) return;
    setError('');
    setAviso('');
    try {
      await api(`/posts/${post._id}/permanent`, { method: 'DELETE' });
      setAviso(`"${post.title}" se eliminó definitivamente.`);
      setTick((t) => t + 1);
    } catch (err) {
      setError(err.message);
    }
  };

  const pages = data ? Math.max(Math.ceil(data.total / data.limit), 1) : 1;

  return (
    <section>
      <Link to="/admin" className="text-sm text-blue-700 hover:underline">← Volver al panel</Link>
      <h1 className="mb-1 mt-2 text-2xl font-bold">Papelera</h1>
      <p className="mb-4 text-sm text-slate-600">
        {user.role === 'admin' ? 'Publicaciones enviadas a la papelera por cualquier usuario.' : 'Tus publicaciones enviadas a la papelera.'}{' '}
        Se eliminan solas a los {DIAS_RETENCION} días. Al restaurarlas vuelven como borrador.
      </p>

      {aviso && <p className="mb-3 rounded bg-green-100 p-3 text-green-800">{aviso}</p>}
      {error && <p className="mb-3 text-red-600">{error}</p>}
      {!data && !error && <p>Cargando...</p>}
      {data && data.posts.length === 0 && <p>La papelera está vacía.</p>}

      {data && (
        <ul className="space-y-3">
          {data.posts.map((p) => (
            <li key={p._id} className="flex items-center justify-between rounded border border-slate-200 bg-white p-4">
              <div>
                <p className="font-semibold">{p.title}</p>
                <p className="text-sm text-slate-500">
                  {p.author?.name} · enviado por {p.deletedBy?.name || 'desconocido'} el{' '}
                  {new Date(p.deletedAt).toLocaleDateString('es-GT')} · se elimina en {diasRestantes(p.deletedAt)} días
                </p>
              </div>
              <div className="flex gap-2 text-sm">
                <button onClick={() => restaurar(p)} className="rounded border border-slate-300 px-3 py-1 hover:bg-slate-100">Restaurar</button>
                <button onClick={() => eliminar(p)} className="rounded bg-red-600 px-3 py-1 text-white hover:bg-red-500">Eliminar definitivamente</button>
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
