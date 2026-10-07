import { useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function Security() {
  const { user, refresh } = useAuth();
  const [setup, setSetup] = useState(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const start = async () => {
    setError('');
    setBusy(true);
    try {
      setSetup(await api('/auth/mfa/setup', { method: 'POST' }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const enable = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api('/auth/mfa/enable', { method: 'POST', body: { code } });
      setSetup(null);
      setCode('');
      setDone(true);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mx-auto max-w-md">
      <h1 className="mb-4 text-2xl font-bold">Seguridad de la cuenta</h1>
      {done && <p className="mb-3 rounded bg-green-100 p-3 text-green-800">MFA activado correctamente.</p>}
      {error && <p className="mb-3 text-red-600">{error}</p>}

      {user.mfaEnabled ? (
        <p>La verificación en dos pasos (MFA) está <strong>activa</strong> en tu cuenta.</p>
      ) : setup ? (
        <div className="space-y-3">
          <p className="text-sm">1. En Microsoft Authenticator tocá <strong>+</strong> → <strong>Otra cuenta</strong> y escaneá este código QR.</p>
          <img src={setup.qr} alt="Código QR para activar MFA" width={220} height={220} />
          <p className="text-sm">¿No podés escanear? Ingresá esta clave a mano: <code className="break-all">{setup.secret}</code></p>
          <p className="text-sm">2. Escribí el código de 6 dígitos que muestra la app.</p>
          <form onSubmit={enable} className="space-y-3">
            <input className="w-full rounded border border-slate-300 p-2" inputMode="numeric" autoComplete="one-time-code" placeholder="123456" value={code} onChange={(e) => setCode(e.target.value)} required minLength={6} maxLength={6} />
            <button disabled={busy} className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50">
              {busy ? 'Verificando...' : 'Activar'}
            </button>
          </form>
        </div>
      ) : (
        <div className="space-y-3">
          <p>
            Agregá una segunda verificación con una app de autenticación.
            {user.role === 'admin' && ' Como admin, es obligatoria para usar el panel.'}
          </p>
          <button onClick={start} disabled={busy} className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50">
            {busy ? 'Generando...' : 'Activar MFA'}
          </button>
        </div>
      )}
    </section>
  );
}