import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { api } from '../../api.js';
import { useAuth } from '../../context/AuthContext.jsx';

const ROLES = ['admin', 'editor', 'lector'];

export default function Users() {
  const { user: me } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/users?page=1&limit=50')
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  const changeRole = async (u, role) => {
    setError('');
    try {
      const { user: updated } = await api(`/users/${u._id}/role`, { method: 'PATCH', body: { role } });
      setData((d) => ({ ...d, users: d.users.map((x) => (x._id === updated._id ? updated : x)) }));
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section>
      <Link to="/admin" className="text-sm text-blue-700 hover:underline">← Volver al panel</Link>
      <h1 className="mb-4 mt-2 text-2xl font-bold">Usuarios</h1>

      {error && <p className="mb-3 text-red-600">{error}</p>}
      {!data && !error && <p>Cargando...</p>}

      {data && (
        <div className="overflow-x-auto rounded border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-100">
              <tr>
                <th className="p-3">Nombre</th>
                <th className="p-3">Correo</th>
                <th className="p-3">Rol</th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((u) => (
                <tr key={u._id} className="border-b border-slate-100">
                  <td className="p-3">{u.name}</td>
                  <td className="p-3">{u.email}</td>
                  <td className="p-3">
                    <select
                      value={u.role}
                      disabled={u._id === me._id}
                      onChange={(e) => changeRole(u, e.target.value)}
                      className="rounded border border-slate-300 p-1 disabled:opacity-50"
                    >
                      {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && <p className="mt-2 text-sm text-slate-500">Mostrando {data.users.length} de {data.total} usuarios.</p>}
    </section>
  );
}