import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { login, verifyMfa } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [code, setCode] = useState('');
  const [step, setStep] = useState('password');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const backToPassword = () => {
    setStep('password');
    setCode('');
    setError('');
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (step === 'password') {
        const result = await login(form.email, form.password);
        if (result.mfaRequired) {
          setStep('code');
          return;
        }
      } else {
        await verifyMfa(code);
      }
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
      <h1 className="mb-4 text-2xl font-bold">{step === 'password' ? 'Ingresar' : 'Verificación en dos pasos'}</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        {step === 'password' ? (
          <>
            <input className={input} type="email" placeholder="Correo" value={form.email} onChange={update('email')} required maxLength={254} autoComplete="email" />
            <input className={input} type="password" placeholder="Contraseña" value={form.password} onChange={update('password')} required maxLength={128} autoComplete="current-password" />
          </>
        ) : (
          <>
            <p className="text-sm text-slate-600">Ingresá el código de 6 dígitos que muestra tu app de autenticación.</p>
            <input className={input} inputMode="numeric" autoComplete="one-time-code" placeholder="123456" value={code} onChange={(e) => setCode(e.target.value)} required minLength={6} maxLength={6} autoFocus />
          </>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button disabled={busy} className="w-full rounded bg-slate-900 p-2 text-white disabled:opacity-50">
          {busy ? 'Verificando...' : step === 'password' ? 'Ingresar' : 'Verificar'}
        </button>
      </form>
      {step === 'code' ? (
        <button onClick={backToPassword} className="mt-3 text-sm text-blue-700 underline">Volver</button>
      ) : (
        <p className="mt-3 text-sm">¿No tenés cuenta? <Link to="/register" className="text-blue-700 underline">Registrate</Link></p>
      )}
    </section>
  );
}