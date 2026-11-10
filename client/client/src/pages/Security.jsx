import { useState } from 'react';
import { useNavigate } from 'react-router';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

// Muestra el detalle de validación del servidor cuando lo hay (por ejemplo, contraseña común)
function mensajeDe(err) {
  if (err.details?.length) return err.details.map((d) => d.message).join('. ');
  return err.message;
}

const inputClass = 'w-full rounded border border-slate-300 p-2';
const buttonClass = 'rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50';
const cardClass = 'space-y-3 rounded border border-slate-200 bg-white p-4';

function CambioContrasena() {
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    setError('');
    setOk(false);
    if (nueva !== confirmar) {
      setError('La confirmación no coincide con la nueva contraseña');
      return;
    }
    setBusy(true);
    try {
      await api('/auth/password', { method: 'POST', body: { currentPassword: actual, newPassword: nueva } });
      setActual('');
      setNueva('');
      setConfirmar('');
      setOk(true);
    } catch (err) {
      setError(mensajeDe(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cardClass}>
      <h2 className="text-lg font-semibold">Contraseña</h2>
      {ok && (
        <p className="rounded bg-green-100 p-3 text-green-800">
          Contraseña actualizada. Cerramos tus sesiones en otros dispositivos.
        </p>
      )}
      {error && <p className="text-red-600">{error}</p>}
      <form onSubmit={enviar} className="space-y-3">
        <label className="block text-sm">
          Contraseña actual
          <input type="password" className={inputClass} autoComplete="current-password" value={actual} onChange={(e) => setActual(e.target.value)} required maxLength={128} />
        </label>
        <label className="block text-sm">
          Nueva contraseña (mínimo 15 caracteres)
          <input type="password" className={inputClass} autoComplete="new-password" value={nueva} onChange={(e) => setNueva(e.target.value)} required minLength={15} maxLength={128} />
        </label>
        <label className="block text-sm">
          Confirmá la nueva contraseña
          <input type="password" className={inputClass} autoComplete="new-password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} required minLength={15} maxLength={128} />
        </label>
        <button disabled={busy} className={buttonClass}>
          {busy ? 'Guardando...' : 'Cambiar contraseña'}
        </button>
      </form>
    </div>
  );
}

function Mfa() {
  const { user, refresh } = useAuth();
  const [setup, setSetup] = useState(null);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [aviso, setAviso] = useState('');

  const limpiar = () => {
    setPassword('');
    setCode('');
  };

  const start = async (e) => {
    e.preventDefault();
    setError('');
    setAviso('');
    setBusy(true);
    try {
      setSetup(await api('/auth/mfa/setup', { method: 'POST', body: { password } }));
      limpiar();
    } catch (err) {
      setError(mensajeDe(err));
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
      limpiar();
      setAviso('MFA activado correctamente.');
      await refresh();
    } catch (err) {
      setError(mensajeDe(err));
    } finally {
      setBusy(false);
    }
  };

  const disable = async (e) => {
    e.preventDefault();
    setError('');
    setAviso('');
    setBusy(true);
    try {
      await api('/auth/mfa/disable', { method: 'POST', body: { password, code } });
      limpiar();
      setAviso('MFA desactivado. Cerramos tus sesiones en otros dispositivos.');
      await refresh();
    } catch (err) {
      setError(mensajeDe(err));
    } finally {
      setBusy(false);
    }
  };

  const campoCodigo = (
    <input className={inputClass} inputMode="numeric" autoComplete="one-time-code" placeholder="123456" value={code} onChange={(e) => setCode(e.target.value)} required minLength={6} maxLength={6} />
  );
  const campoPassword = (
    <label className="block text-sm">
      Contraseña actual
      <input type="password" className={inputClass} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required maxLength={128} />
    </label>
  );

  let contenido;
  if (user.mfaEnabled && user.role === 'admin') {
    contenido = (
      <p>La verificación en dos pasos está <strong>activa</strong>. Para el administrador es obligatoria y no se puede desactivar.</p>
    );
  } else if (user.mfaEnabled) {
    contenido = (
      <div className="space-y-3">
        <p>La verificación en dos pasos está <strong>activa</strong> en tu cuenta.</p>
        <form onSubmit={disable} className="space-y-3">
          <p className="text-sm">Para desactivarla, confirmá tu contraseña y un código de la app.</p>
          {campoPassword}
          {campoCodigo}
          <button disabled={busy} className={buttonClass}>
            {busy ? 'Verificando...' : 'Desactivar MFA'}
          </button>
        </form>
      </div>
    );
  } else if (setup) {
    contenido = (
      <div className="space-y-3">
        <p className="text-sm">1. En Microsoft Authenticator tocá <strong>+</strong> → <strong>Otra cuenta</strong> y escaneá este código QR.</p>
        <img src={setup.qr} alt="Código QR para activar MFA" width={220} height={220} />
        <p className="text-sm">¿No podés escanear? Ingresá esta clave a mano: <code className="break-all">{setup.secret}</code></p>
        <p className="text-sm">2. Escribí el código de 6 dígitos que muestra la app.</p>
        <form onSubmit={enable} className="space-y-3">
          {campoCodigo}
          <button disabled={busy} className={buttonClass}>
            {busy ? 'Verificando...' : 'Activar'}
          </button>
        </form>
      </div>
    );
  } else {
    contenido = (
      <form onSubmit={start} className="space-y-3">
        <p>
          Agregá una segunda verificación con una app de autenticación.
          {user.role === 'admin' && ' Como admin, es obligatoria para usar el panel.'}
        </p>
        {campoPassword}
        <button disabled={busy} className={buttonClass}>
          {busy ? 'Generando...' : 'Activar MFA'}
        </button>
      </form>
    );
  }

  return (
    <div className={cardClass}>
      <h2 className="text-lg font-semibold">Verificación en dos pasos (MFA)</h2>
      {aviso && <p className="rounded bg-green-100 p-3 text-green-800">{aviso}</p>}
      {error && <p className="text-red-600">{error}</p>}
      {contenido}
    </div>
  );
}

function Sesiones() {
  const { logoutAll } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const cerrarTodas = async () => {
    if (!window.confirm('Se cerrará tu sesión en todos los dispositivos, incluido este. ¿Continuar?')) return;
    setError('');
    setBusy(true);
    try {
      await logoutAll();
      navigate('/login', { replace: true });
    } catch (err) {
      setError(mensajeDe(err));
      setBusy(false);
    }
  };

  return (
    <div className={cardClass}>
      <h2 className="text-lg font-semibold">Sesiones</h2>
      <p className="text-sm">
        Si perdiste un dispositivo o creés que alguien más entró a tu cuenta, cerrá todas las sesiones.
        Vas a tener que volver a ingresar.
      </p>
      {error && <p className="text-red-600">{error}</p>}
      <button onClick={cerrarTodas} disabled={busy} className={buttonClass}>
        {busy ? 'Cerrando...' : 'Cerrar todas las sesiones'}
      </button>
    </div>
  );
}

export default function Security() {
  return (
    <section className="mx-auto max-w-md space-y-6">
      <h1 className="text-2xl font-bold">Seguridad de la cuenta</h1>
      <CambioContrasena />
      <Mfa />
      <Sesiones />
    </section>
  );
}
