import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(form.email, form.password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const input = 'w-full rounded border border-slate-300 p-2';

  return (
    <section className="mx-auto max-w-sm">
      <h1 className="mb-4 text-2xl font-bold">Ingresar</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <input className={input} type="email" placeholder="Correo" value={form.email} onChange={update('email')} required maxLength={254} autoComplete="email" />
        <input className={input} type="password" placeholder="Contraseña" value={form.password} onChange={update('password')} required maxLength={128} autoComplete="current-password" />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button disabled={busy} className="w-full rounded bg-slate-900 p-2 text-white disabled:opacity-50">
          {busy ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>
      <p className="mt-3 text-sm">¿No tenés cuenta? <Link to="/register" className="text-blue-700 underline">Registrate</Link></p>
    </section>
  );
}