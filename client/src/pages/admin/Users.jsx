import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { api } from '../../api.js';
import { useAuth } from '../../context/AuthContext.jsx';

const ROLES = ['admin', 'editor', 'lector'];
const botonClass = 'rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100 disabled:opacity-40';

export default function Users() {
  const { user: me } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  useEffect(() => {
    api('/users?page=1&limit=50')
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  const reemplazar = (updated) =>
    setData((d) => ({ ...d, users: d.users.map((x) => (x._id === updated._id ? updated : x)) }));

  const changeRole = async (u, role) => {
    setError('');
    setAviso('');
    try {
      const { user: updated } = await api(`/users/${u._id}/role`, { method: 'PATCH', body: { role } });
      reemplazar(updated);
    } catch (err) {
      setError(err.message);
    }
  };

  const cambiarEstado = async (u) => {
    const suspender = !u.suspended;
    const pregunta = suspender
      ? `¿Suspender la cuenta de ${u.name}? Se cerrarán todas sus sesiones y no podrá ingresar.`
      : `¿Reactivar la cuenta de ${u.name}?`;
    if (!window.confirm(pregunta)) return;
    setError('');
    setAviso('');
    try {
      const { user: updated } = await api(`/users/${u._id}/status`, { method: 'PATCH', body: { suspended: suspender } });
      reemplazar(updated);
      setAviso(suspender ? `Cuenta de ${u.name} suspendida.` : `Cuenta de ${u.name} reactivada.`);
    } catch (err) {
      setError(err.message);
    }
  };

  const cerrarSesiones = async (u) => {
    if (!window.confirm(`¿Cerrar todas las sesiones de ${u.name}? Tendrá que volver a ingresar.`)) return;
    setError('');
    setAviso('');
    try {
      await api(`/users/${u._id}/revoke-sessions`, { method: 'POST' });
      setAviso(`Se cerraron todas las sesiones de ${u.name}.`);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section>
      <Link to="/admin" className="text-sm text-blue-700 hover:underline">← Volver al panel</Link>
      <h1 className="mb-4 mt-2 text-2xl font-bold">Usuarios</h1>

      {aviso && <p className="mb-3 rounded bg-green-100 p-3 text-green-800">{aviso}</p>}
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
                <th className="p-3">Estado</th>
                <th className="p-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((u) => {
                const propio = u._id === me._id;
                return (
                  <tr key={u._id} className="border-b border-slate-100">
                    <td className="p-3">{u.name}</td>
                    <td className="p-3">{u.email}</td>
                    <td className="p-3">
                      <select
                        value={u.role}
                        disabled={propio}
                        onChange={(e) => changeRole(u, e.target.value)}
                        className="rounded border border-slate-300 p-1 disabled:opacity-50"
                      >
                        {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </td>
                    <td className="p-3">
                      {u.suspended ? (
                        <span className="rounded bg-red-100 px-2 py-1 text-xs text-red-800">Suspendida</span>
                      ) : (
                        <span className="rounded bg-green-100 px-2 py-1 text-xs text-green-800">Activa</span>
                      )}
                    </td>
                    <td className="space-x-2 p-3 whitespace-nowrap">
                      <button
                        className={botonClass}
                        disabled={propio || u.role === 'admin'}
                        title={u.role === 'admin' ? 'Para suspender a un admin, primero cambiá su rol' : undefined}
                        onClick={() => cambiarEstado(u)}
                      >
                        {u.suspended ? 'Reactivar' : 'Suspender'}
                      </button>
                      <button className={botonClass} disabled={propio} onClick={() => cerrarSesiones(u)}>
                        Cerrar sesiones
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {data && <p className="mt-2 text-sm text-slate-500">Mostrando {data.users.length} de {data.total} usuarios.</p>}
    </section>
  );
}
