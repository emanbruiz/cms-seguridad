import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import MarkdownView from '../../components/MarkdownView.jsx';
import { api, uploadImage } from '../../api.js';

export default function PostForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const editing = Boolean(id);
  const [form, setForm] = useState({ title: '', content: '', status: 'borrador', category: 'General', tags: '', excerpt: '' });
  const [categories, setCategories] = useState(['General']);
  const [featured, setFeatured] = useState(null);
  const [uploadingFeatured, setUploadingFeatured] = useState(false);
  const [loading, setLoading] = useState(editing);
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    api('/posts/meta')
      .then((d) => setCategories(d.categories))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!editing) return;
    api(`/posts/manage/${id}`)
      .then(({ post }) => {
        setForm({
          title: post.title,
          content: post.content,
          status: post.status,
          category: post.category || 'General',
          tags: (post.tags || []).join(', '),
          excerpt: post.excerpt || '',
        });
        setFeatured(post.featuredImage || null);
      })
      .catch((err) => setErrors([err.message]))
      .finally(() => setLoading(false));
  }, [id, editing]);

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const onPickImage = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErrors([]);
    setUploading(true);
    try {
      const { url } = await uploadImage(file);
      setForm((f) => ({ ...f, content: `${f.content}${f.content ? '\n\n' : ''}![imagen](${url})\n` }));
    } catch (err) {
      setErrors([err.message]);
    } finally {
      setUploading(false);
    }
  };

  const onPickFeatured = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErrors([]);
    setUploadingFeatured(true);
    try {
      const { media } = await uploadImage(file);
      setFeatured({ _id: media._id, filename: media.filename });
    } catch (err) {
      setErrors([err.message]);
    } finally {
      setUploadingFeatured(false);
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setErrors([]);
    setBusy(true);
    try {
      const body = {
        title: form.title,
        content: form.content,
        status: form.status,
        category: form.category,
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
        excerpt: form.excerpt,
        featuredImage: featured ? featured._id : null,
      };
      if (editing) {
        await api(`/posts/${id}`, { method: 'PATCH', body });
      } else {
        await api('/posts', { method: 'POST', body });
      }
      navigate('/admin');
    } catch (err) {
      setErrors(err.details?.map((d) => `${d.field}: ${d.message}`) || [err.message]);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p>Cargando...</p>;

  const input = 'input';

  return (
    <section>
      <Link to="/admin" className="link text-sm">← Volver al panel</Link>
      <h1 className="page-title mt-2 mb-6">{editing ? 'Editar post' : 'Nuevo post'}</h1>

      <form onSubmit={onSubmit} className="space-y-3">
        <input className={input} placeholder="Título" value={form.title} onChange={update('title')} required minLength={3} maxLength={150} />
        <textarea className={`${input} font-mono`} rows={12} placeholder="Contenido en Markdown" value={form.content} onChange={update('content')} required maxLength={20000} />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="label">
            Categoría
            <select className={input} value={form.category} onChange={update('category')}>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="label">
            Etiquetas (separadas por comas, máximo 8)
            <input className={input} placeholder="seguridad, docker" value={form.tags} onChange={update('tags')} maxLength={300} />
          </label>
        </div>
        <label className="label">
          Extracto (opcional, si lo dejás vacío se genera del contenido)
          <textarea className={input} rows={2} value={form.excerpt} onChange={update('excerpt')} maxLength={300} />
        </label>
        <div className="label">
          <p>Imagen destacada</p>
          {featured && (
            <div className="flex items-center gap-3">
              <img src={`/api/media/${featured.filename}`} alt="Imagen destacada" className="h-20 w-32 rounded object-cover" />
              <button type="button" onClick={() => setFeatured(null)} className="btn btn-secondary btn-sm">Quitar</button>
            </div>
          )}
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onPickFeatured} disabled={uploadingFeatured} className="block" />
          {uploadingFeatured && <p>Subiendo imagen...</p>}
        </div>
        <label className="label">
          {uploading ? 'Subiendo imagen...' : 'Subir imagen (PNG, JPG o WEBP, máximo 2 MB)'}
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onPickImage} disabled={uploading} className="mt-1 block" />
        </label>
        <select className={input} value={form.status} onChange={update('status')}>
          <option value="borrador">Borrador</option>
          <option value="publicado">Publicado</option>
        </select>
        {errors.map((m) => <p key={m} className="text-sm text-red-600">{m}</p>)}
        <button disabled={busy} className="btn btn-primary">
          {busy ? 'Guardando...' : 'Guardar'}
        </button>
      </form>

      <h2 className="mb-2 mt-8 text-lg font-semibold text-slate-900 dark:text-white">Vista previa</h2>
      <div className="card p-6">
        <MarkdownView>{form.content || '*Nada que mostrar todavía*'}</MarkdownView>
      </div>
    </section>
  );
}