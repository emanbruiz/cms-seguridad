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
  if (!post) return <p>Cargando...</p>;

  return (
    <article className="rounded border border-slate-200 bg-white p-6">
      <Link to="/" className="text-sm text-blue-700 hover:underline">← Volver</Link>
      <h1 className="mt-2 text-3xl font-bold">{post.title}</h1>
      <p className="mb-4 text-sm text-slate-500">
        {post.author?.name} · {new Date(post.publishedAt).toLocaleDateString('es-GT')}
      </p>
      <MarkdownView>{post.content}</MarkdownView>
    </article>
  );
}