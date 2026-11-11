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

  const input = 'input';

  return (
    <section className="card mx-auto mt-6 max-w-md p-8">
      <h1 className="mb-6 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Crear cuenta</h1>
      <form onSubmit={onSubmit} className="space-y-4">
        <input className={input} placeholder="Nombre" value={form.name} onChange={update('name')} required minLength={2} maxLength={60} />
        <input className={input} type="email" placeholder="Correo" value={form.email} onChange={update('email')} required maxLength={254} autoComplete="email" />
        <input className={input} type="password" placeholder="Contraseña (mínimo 15 caracteres)" value={form.password} onChange={update('password')} required minLength={15} maxLength={128} autoComplete="new-password" />
        {errors.map((m) => <p key={m} className="text-sm text-red-600">{m}</p>)}
        <button disabled={busy} className="btn btn-primary w-full">
          {busy ? 'Creando...' : 'Registrarse'}
        </button>
      </form>
      <p className="muted mt-6 text-center">¿Ya tenés cuenta? <Link to="/login" className="link">Ingresá</Link></p>
    </section>
  );
}