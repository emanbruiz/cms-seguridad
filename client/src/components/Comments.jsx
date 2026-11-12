import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useUI } from './ui.jsx';

const MAX = 1000;

// Comentarios de una publicación. Se muestran como texto plano: nunca se interpreta HTML ni Markdown.
export default function Comments({ post }) {
  const { user } = useAuth();
  const { confirm, toast } = useUI();
  const [data, setData] = useState(null);
  const [tick, setTick] = useState(0);
  const [texto, setTexto] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api(`/comments?post=${post._id}&limit=50`)
      .then(setData)
      .catch(() => setData({ comments: [], total: 0 }));
  }, [post._id, tick]);

  const esModerador = user && (user.role === 'admin' || user._id === post.author?._id);

  const enviar = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { comment } = await api('/comments', { method: 'POST', body: { post: post._id, content: texto } });
      setTexto('');
      if (comment.status === 'aprobado') {
        toast('Comentario publicado.');
        setTick((t) => t + 1);
      } else {
        toast('Tu comentario quedó pendiente de moderación.');
      }
    } catch (err) {
      setError(err.details?.length ? err.details.map((d) => d.message).join('. ') : err.message);
    } finally {
      setBusy(false);
    }
  };

  const borrar = async (c) => {
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
    <section className="card mx-auto mt-8 max-w-3xl p-6 sm:p-10">
      <h2 className="text-xl font-bold text-slate-900 dark:text-white">
        Comentarios {data ? <span className="muted font-normal">({data.total})</span> : null}
      </h2>

      {user ? (
        <form onSubmit={enviar} className="mt-4 space-y-2">
          <textarea
            className="input"
            rows={3}
            placeholder="Escribí un comentario. Se publica cuando lo apruebe el autor."
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            required
            minLength={2}
            maxLength={MAX}
            aria-label="Comentario"
          />
          <div className="flex items-center justify-between">
            <span className="muted">{texto.length}/{MAX}</span>
            <button disabled={busy} className="btn btn-primary">{busy ? 'Enviando...' : 'Comentar'}</button>
          </div>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        </form>
      ) : (
        <p className="muted mt-3">
          <Link to="/login" className="link">Ingresá</Link> para comentar.
        </p>
      )}

      <ul className="mt-6 space-y-5">
        {data?.comments.map((c) => (
          <li key={c._id} className="flex gap-3">
            <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
              {(c.author?.name || '?').charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm">
                <span className="font-semibold text-slate-900 dark:text-white">{c.author?.name || 'Usuario'}</span>{' '}
                <span className="muted">· {new Date(c.createdAt).toLocaleDateString('es-GT')}</span>
              </p>
              <p className="mt-1 break-words whitespace-pre-line text-slate-700 dark:text-slate-300">{c.content}</p>
              {user && (esModerador || user._id === c.author?._id) && (
                <button onClick={() => borrar(c)} className="mt-1 text-xs text-red-600 hover:underline">Eliminar</button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {data && data.total === 0 && <p className="muted mt-4">Todavía no hay comentarios.</p>}
    </section>
  );
}
