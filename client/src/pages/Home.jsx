import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { api } from '../api.js';

export default function Home() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const [texto, setTexto] = useState(q);
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');

  useEffect(() => {
    const busqueda = q ? `&q=${encodeURIComponent(q)}` : '';
    api(`/posts?page=${page}&limit=10${busqueda}`)
      .then((d) => {
        setError('');
        setData(d);
      })
      .catch((err) => setError(err.details?.[0]?.message || err.message));
  }, [page, q]);

  const buscar = (e) => {
    e.preventDefault();
    setPage(1);
    const limpio = texto.trim();
    setParams(limpio ? { q: limpio } : {});
  };

  const limpiar = () => {
    setTexto('');
    setPage(1);
    setParams({});
  };

  const pages = data ? Math.max(Math.ceil(data.total / data.limit), 1) : 1;

  return (
    <section>
      <h1 className="mb-4 text-2xl font-bold">Publicaciones</h1>

      <form onSubmit={buscar} role="search" className="mb-4 flex gap-2">
        <input
          type="search"
          aria-label="Buscar publicaciones"
          placeholder="Buscar publicaciones..."
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          minLength={2}
          maxLength={100}
          className="w-full rounded border border-slate-300 p-2"
        />
        <button className="rounded bg-slate-900 px-4 py-2 text-white">Buscar</button>
      </form>

      {q && (
        <p className="mb-3 text-sm text-slate-600">
          Resultados para <strong>{q}</strong>{data ? ` (${data.total})` : ''}.{' '}
          <button onClick={limpiar} className="text-blue-700 hover:underline">Ver todas</button>
        </p>
      )}

      {error && <p className="text-red-600">{error}</p>}
      {!data && !error && <p>Cargando...</p>}
      {data && data.posts.length === 0 && (
        <p>{q ? 'No se encontraron publicaciones con esa búsqueda.' : 'Todavía no hay publicaciones.'}</p>
      )}

      {data && (
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
