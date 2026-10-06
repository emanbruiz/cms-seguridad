import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import MarkdownView from '../../components/MarkdownView.jsx';
import { api } from '../../api.js';

export default function PostForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const editing = Boolean(id);
  const [form, setForm] = useState({ title: '', content: '', status: 'borrador' });
  const [loading, setLoading] = useState(editing);
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!editing) return;
    api(`/posts/manage/${id}`)
      .then(({ post }) => setForm({ title: post.title, content: post.content, status: post.status }))
      .catch((err) => setErrors([err.message]))
      .finally(() => setLoading(false));
  }, [id, editing]);

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setErrors([]);
    setBusy(true);
    try {
      if (editing) {
        await api(`/posts/${id}`, { method: 'PATCH', body: form });
      } else {
        await api('/posts', { method: 'POST', body: form });
      }
      navigate('/admin');
    } catch (err) {
      setErrors(err.details?.map((d) => `${d.field}: ${d.message}`) || [err.message]);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p>Cargando...</p>;

  const input = 'w-full rounded border border-slate-300 p-2';

  return (
    <section>
      <Link to="/admin" className="text-sm text-blue-700 hover:underline">← Volver al panel</Link>
      <h1 className="mb-4 mt-2 text-2xl font-bold">{editing ? 'Editar post' : 'Nuevo post'}</h1>

      <form onSubmit={onSubmit} className="space-y-3">
        <input className={input} placeholder="Título" value={form.title} onChange={update('title')} required minLength={3} maxLength={150} />
        <textarea className={`${input} font-mono`} rows={12} placeholder="Contenido en Markdown" value={form.content} onChange={update('content')} required maxLength={20000} />
        <select className={input} value={form.status} onChange={update('status')}>
          <option value="borrador">Borrador</option>
          <option value="publicado">Publicado</option>
        </select>
        {errors.map((m) => <p key={m} className="text-sm text-red-600">{m}</p>)}
        <button disabled={busy} className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50">
          {busy ? 'Guardando...' : 'Guardar'}
        </button>
      </form>

      <h2 className="mb-2 mt-8 text-lg font-semibold">Vista previa</h2>
      <div className="rounded border border-slate-200 bg-white p-4">
        <MarkdownView>{form.content || '*Nada que mostrar todavía*'}</MarkdownView>
      </div>
    </section>
  );
}