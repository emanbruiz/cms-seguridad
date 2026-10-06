import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { api } from '../api.js';

export default function Home() {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');

  useEffect(() => {
    api(`/posts?page=${page}&limit=10`)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [page]);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!data) return <p>Cargando...</p>;

  const pages = Math.max(Math.ceil(data.total / data.limit), 1);

  return (
    <section>
      <h1 className="mb-4 text-2xl font-bold">Publicaciones</h1>
      {data.posts.length === 0 && <p>Todavía no hay publicaciones.</p>}
      <ul className="space-y-3">
        {data.posts.map((p) => (
          <li key={p._id} className="rounded border border-slate-200 bg-white p-4">
            <Link to={`/posts/${p.slug}`} className="text-lg font-semibold text-blue-700 hover:underline">
              {p.title}
            </Link>
            <p className="text-sm text-slate-500">
              {p.author?.name} · {new Date(p.publishedAt).toLocaleDateString('es-GT')}
            </p>
          </li>
        ))}
      </ul>
      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded border px-3 py-1 disabled:opacity-40">Anterior</button>
          <span>Página {data.page} de {pages}</span>
          <button disabled={page >= pages} onClick={() => setPage(page + 1)} className="rounded border px-3 py-1 disabled:opacity-40">Siguiente</button>
        </div>
      )}
    </section>
  );
}