import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { api } from '../../api.js';
import { useUI } from '../../components/ui.jsx';

const ESTADOS = [
  { id: 'pendiente', label: 'Pendientes' },
  { id: 'aprobado', label: 'Aprobados' },
  { id: 'rechazado', label: 'Rechazados' },
];

export default function Comments() {
  const { confirm, toast } = useUI();
  const [estado, setEstado] = useState('pendiente');
  const [data, setData] = useState(null);
  const [tick, setTick] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    api(`/comments/moderation?status=${estado}&limit=50`)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [estado, tick]);

  const moderar = async (c, status) => {
    try {
      await api(`/comments/${c._id}/status`, { method: 'PATCH', body: { status } });
      toast(status === 'aprobado' ? 'Comentario aprobado y publicado.' : 'Comentario rechazado.');
      setTick((t) => t + 1);
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const eliminar = async (c) => {
    const ok = await confirm({ title: 'Eliminar comentario', message: 'El comentario se eliminará para siempre.', confirmText: 'Eliminar', danger: true });
    if (!ok) return;
    try {
      await api(`/comments/${c._id}`, { method: 'DELETE' });
      toast('Comentario eliminado.');
      setTick((t) => t + 1);
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <section>
      <Link to="/admin" className="link text-sm">← Volver al panel</Link>
      <h1 className="page-title mt-2 mb-1">Comentarios</h1>
      <p className="muted mb-6">Los comentarios nuevos no se publican hasta que los aprobás. Solo ves los de tus publicaciones, salvo que seas admin.</p>

      <div className="mb-4 flex gap-2" role="tablist">
        {ESTADOS.map((e) => (
          <button
            key={e.id}
            role="tab"
            aria-selected={estado === e.id}
            onClick={() => {
              setData(null);
              setEstado(e.id);
            }}
            className={`btn btn-sm ${estado === e.id ? 'btn-primary' : 'btn-secondary'}`}
          >
            {e.label}
          </button>
        ))}
      </div>

      {error && <p className="mb-3 text-red-600">{error}</p>}
      {!data && !error && <p className="muted">Cargando...</p>}
      {data && data.comments.length === 0 && <div className="card p-10 text-center text-slate-500">No hay comentarios en esta lista.</div>}

      {data && (
        <ul className="space-y-3">
          {data.comments.map((c) => (
            <li key={c._id} className="card p-5">
              <p className="muted">
                <span className="font-semibold text-slate-900 dark:text-white">{c.author?.name || 'Usuario'}</span> en{' '}
                {c.post ? <Link to={`/posts/${c.post.slug}`} className="link">{c.post.title}</Link> : 'una publicación eliminada'} ·{' '}
                {new Date(c.createdAt).toLocaleString('es-GT')}
              </p>
              <p className="mt-2 break-words whitespace-pre-line text-slate-700 dark:text-slate-300">{c.content}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {estado !== 'aprobado' && <button onClick={() => moderar(c, 'aprobado')} className="btn btn-primary btn-sm">Aprobar</button>}
                {estado !== 'rechazado' && <button onClick={() => moderar(c, 'rechazado')} className="btn btn-secondary btn-sm">Rechazar</button>}
                <button onClick={() => eliminar(c)} className="btn btn-danger btn-sm">Eliminar</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
