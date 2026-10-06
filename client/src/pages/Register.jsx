import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext.jsx';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState(false);

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setErrors([]);
    setBusy(true);
    try {
      await register(form.name, form.email, form.password);
      navigate('/');
    } catch (err) {
      setErrors(err.details?.map((d) => d.message) || [err.message]);
    } finally {
      setBusy(false);
    }
  };

  const input = 'w-full rounded border border-slate-300 p-2';

  return (
    <section className="mx-auto max-w-sm">
      <h1 className="mb-4 text-2xl font-bold">Crear cuenta</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <input className={input} placeholder="Nombre" value={form.name} onChange={update('name')} required minLength={2} maxLength={60} />
        <input className={input} type="email" placeholder="Correo" value={form.email} onChange={update('email')} required maxLength={254} autoComplete="email" />
        <input className={input} type="password" placeholder="Contraseña (mínimo 10 caracteres)" value={form.password} onChange={update('password')} required minLength={10} maxLength={128} autoComplete="new-password" />
        {errors.map((m) => <p key={m} className="text-sm text-red-600">{m}</p>)}
        <button disabled={busy} className="w-full rounded bg-slate-900 p-2 text-white disabled:opacity-50">
          {busy ? 'Creando...' : 'Registrarse'}
        </button>
      </form>
      <p className="mt-3 text-sm">¿Ya tenés cuenta? <Link to="/login" className="text-blue-700 underline">Ingresá</Link></p>
    </section>
  );
}