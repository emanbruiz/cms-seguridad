import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { api } from '../../api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useUI } from '../../components/ui.jsx';

const ROLES = ['admin', 'editor', 'lector'];
const botonClass = 'btn btn-secondary btn-sm';

export default function Users() {
  const { user: me } = useAuth();
  const { confirm, toast } = useUI();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/users?page=1&limit=50')
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  const reemplazar = (updated) =>
    setData((d) => ({ ...d, users: d.users.map((x) => (x._id === updated._id ? updated : x)) }));

  const changeRole = async (u, role) => {
    setError('');
    try {
      const { user: updated } = await api(`/users/${u._id}/role`, { method: 'PATCH', body: { role } });
      reemplazar(updated);
    } catch (err) {
      setError(err.message);
    }
  };

  const cambiarEstado = async (u) => {
    const suspender = !u.suspended;
    const ok = await confirm(
      suspender
        ? {
            title: 'Suspender cuenta',
            message: `Se cerrarán todas las sesiones de ${u.name} y no podrá ingresar hasta que la reactives.`,
            confirmText: 'Suspender',
            danger: true,
          }
        : { title: 'Reactivar cuenta', message: `${u.name} podrá volver a ingresar.`, confirmText: 'Reactivar' }
    );
    if (!ok) return;
    setError('');
    try {
      const { user: updated } = await api(`/users/${u._id}/status`, { method: 'PATCH', body: { suspended: suspender } });
      reemplazar(updated);
      toast(suspender ? `Cuenta de ${u.name} suspendida.` : `Cuenta de ${u.name} reactivada.`);
    } catch (err) {
      setError(err.message);
    }
  };

  const cerrarSesiones = async (u) => {
    const ok = await confirm({
      title: 'Cerrar sesiones',
      message: `Se cerrarán todas las sesiones de ${u.name}. Tendrá que volver a ingresar.`,
      confirmText: 'Cerrar sesiones',
      danger: true,
    });
    if (!ok) return;
    setError('');
    try {
      await api(`/users/${u._id}/revoke-sessions`, { method: 'POST' });
      toast(`Se cerraron todas las sesiones de ${u.name}.`);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section>
      <Link to="/admin" className="link text-sm">← Volver al panel</Link>
      <h1 className="page-title mt-2 mb-6">Usuarios</h1>

      {error && <p className="mb-3 text-red-600">{error}</p>}
      {!data && !error && <p>Cargando...</p>}

      {data && (
        <div className="card overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs tracking-wide text-slate-500 uppercase dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
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
                  <tr key={u._id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                    <td className="p-3">{u.name}</td>
                    <td className="p-3">{u.email}</td>
                    <td className="p-3">
                      <select
                        value={u.role}
                        disabled={propio}
                        onChange={(e) => changeRole(u, e.target.value)}
                        className="input w-auto py-1"
                      >
                        {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </td>
                    <td className="p-3">
                      {u.suspended ? (
                        <span className="badge badge-red">Suspendida</span>
                      ) : (
                        <span className="badge badge-green">Activa</span>
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
      {data && <p className="muted mt-3">Mostrando {data.users.length} de {data.total} usuarios.</p>}
    </section>
  );
}
