import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { api } from '../api.js';

export default function Home() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const categoria = params.get('category') || '';
  const etiqueta = params.get('tag') || '';
  const [meta, setMeta] = useState({ categories: [], tags: [] });
  const [texto, setTexto] = useState(q);
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/posts/meta')
      .then(setMeta)
      .catch(() => {});
  }, []);

  useEffect(() => {
    const extra = new URLSearchParams();
    if (q) extra.set('q', q);
    if (categoria) extra.set('category', categoria);
    if (etiqueta) extra.set('tag', etiqueta);
    const sufijo = extra.toString() ? `&${extra.toString()}` : '';
    api(`/posts?page=${page}&limit=10${sufijo}`)
      .then((d) => {
        setError('');
        setData(d);
      })
      .catch((err) => setError(err.details?.[0]?.message || err.message));
  }, [page, q, categoria, etiqueta]);

  const buscar = (e) => {
    e.preventDefault();
    setPage(1);
    const limpio = texto.trim();
    setParams(limpio ? { q: limpio } : {});
  };

  const filtrar = (nombre, valor) => {
    setPage(1);
    const nuevos = {};
    if (q) nuevos.q = q;
    if (valor) nuevos[nombre] = valor;
    setParams(nuevos);
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

      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <button onClick={() => filtrar('category', '')} className={`rounded-full border px-3 py-1 ${!categoria ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 hover:bg-slate-100'}`}>
          Todas
        </button>
        {meta.categories.map((c) => (
          <button key={c} onClick={() => filtrar('category', c)} className={`rounded-full border px-3 py-1 ${categoria === c ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 hover:bg-slate-100'}`}>
            {c}
          </button>
        ))}
      </div>

      {etiqueta && (
        <p className="mb-3 text-sm text-slate-600">
          Etiqueta <strong>#{etiqueta}</strong>.{' '}
          <button onClick={() => filtrar('tag', '')} className="text-blue-700 hover:underline">Quitar filtro</button>
        </p>
      )}

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
            <li key={p._id} className="overflow-hidden rounded border border-slate-200 bg-white">
              {p.featuredImage?.filename && (
                <img src={`/api/media/${p.featuredImage.filename}`} alt="" className="h-48 w-full object-cover" />
              )}
              <div className="space-y-2 p-4">
                <button onClick={() => filtrar('category', p.category)} className="text-xs font-semibold uppercase tracking-wide text-blue-700 hover:underline">
                  {p.category || 'General'}
                </button>
                <Link to={`/posts/${p.slug}`} className="block text-lg font-semibold text-slate-900 hover:underline">
                  {p.title}
                </Link>
                {p.excerpt && <p className="text-sm text-slate-600">{p.excerpt}</p>}
                <p className="text-sm text-slate-500">
                  {p.author?.name} · {new Date(p.publishedAt).toLocaleDateString('es-GT')} · {p.readingMinutes || 1} min de lectura
                </p>
                {p.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {p.tags.map((t) => (
                      <button key={t} onClick={() => filtrar('tag', t)} className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-200">#{t}</button>
                    ))}
                  </div>
                )}
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
