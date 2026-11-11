import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import MarkdownView from '../components/MarkdownView.jsx';
import { api } from '../api.js';

export default function Post() {
  const { slug } = useParams();
  const [post, setPost] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api(`/posts/${encodeURIComponent(slug)}`)
      .then((d) => setPost(d.post))
      .catch((err) => setError(err.status === 404 ? 'Publicación no encontrada' : err.message));
  }, [slug]);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!post) return <p className="muted">Cargando...</p>;

  return (
    <article className="card mx-auto max-w-3xl overflow-hidden">
      {post.featuredImage?.filename && (
        <img src={`/api/media/${post.featuredImage.filename}`} alt="" className="aspect-[21/9] w-full object-cover" />
      )}
      <div className="p-6 sm:p-10">
      <Link to="/" className="link text-sm">← Volver</Link>
      <Link to={`/?category=${encodeURIComponent(post.category || 'General')}`} className="mt-6 block text-xs font-semibold tracking-wide text-indigo-600 uppercase hover:underline dark:text-indigo-400">
        {post.category || 'General'}
      </Link>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">{post.title}</h1>
      <p className="muted mt-3 mb-8">
        {post.author?.name} · {new Date(post.publishedAt).toLocaleDateString('es-GT')} · {post.readingMinutes || 1} min de lectura
      </p>
      <MarkdownView>{post.content}</MarkdownView>
      {post.tags?.length > 0 && (
        <div className="mt-10 flex flex-wrap gap-2 border-t border-slate-200 pt-6 dark:border-slate-800">
          {post.tags.map((t) => (
            <Link key={t} to={`/?tag=${encodeURIComponent(t)}`} className="badge badge-slate hover:bg-slate-200 dark:hover:bg-slate-700">#{t}</Link>
          ))}
        </div>
      )}
      </div>
    </article>
  );
}