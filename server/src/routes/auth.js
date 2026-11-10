import { Router } from 'express';
import argon2 from 'argon2';
import QRCode from 'qrcode';
import { generateSecret, verify as verifyTotp } from 'otplib';
import { User } from '../models/User.js';
import { validate } from '../middleware/validate.js';
import {
  registerSchema,
  loginSchema,
  mfaCodeSchema,
  changePasswordSchema,
  emptyBodySchema,
  mfaSetupSchema,
  mfaDisableSchema,
} from '../validators/auth.js';
import { loginLimiter, registerLimiter, mfaLimiter, passwordLimiter } from '../middleware/rateLimit.js';
import {
  authenticate,
  signToken,
  signMfaToken,
  verifyMfaToken,
  readSession,
  COOKIE_NAME,
  MFA_COOKIE_NAME,
  cookieOptions,
  mfaCookieOptions,
} from '../middleware/auth.js';
import { encrypt, decrypt } from '../utils/crypto.js';
import { isWeakPassword } from '../utils/passwords.js';

const router = Router();
const DUMMY_HASH = await argon2.hash('contraseña-falsa-para-igualar-tiempos');
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;
const REPLAY_WINDOW_MS = 90 * 1000;
const MFA_FIELDS = '+mfaSecretEnc +mfaLastCode +mfaLastCodeAt +mfaFailCount +mfaLockUntil';

function otpauthUri(email, secret) {
  const issuer = encodeURIComponent('Mi CMS');
  return `otpauth://totp/${issuer}:${encodeURIComponent(email)}?secret=${secret}&issuer=${issuer}`;
}

async function checkTotp(user, code) {
  if (!/^\d{6}$/.test(code)) return false;

  const recentlyUsed =
    user.mfaLastCode === code &&
    user.mfaLastCodeAt &&
    Date.now() - user.mfaLastCodeAt.getTime() < REPLAY_WINDOW_MS;
  if (recentlyUsed) return false;

  const result = await verifyTotp({
    secret: decrypt(user.mfaSecretEnc),
    token: code,
    epochTolerance: 30,
  });
  const valid = typeof result === 'boolean' ? result : result?.valid === true;

  if (valid) {
    user.mfaLastCode = code;
    user.mfaLastCodeAt = new Date();
  }
  return valid;
}

async function registerFailure(userId) {
  const updated = await User.findByIdAndUpdate(
    userId,
    { $inc: { mfaFailCount: 1 } },
    { returnDocument: 'after' }
  ).select('+mfaFailCount');

  if (updated && updated.mfaFailCount >= MAX_FAILS) {
    await User.updateOne(
      { _id: userId },
      { $set: { mfaFailCount: 0, mfaLockUntil: new Date(Date.now() + LOCK_MS) } }
    );
  }
}

router.post('/register', registerLimiter, validate(registerSchema), async (req, res) => {
  const { name, email, password } = req.body;

  if (isWeakPassword(password, { email, name })) {
    return res.status(400).json({
      error: 'Datos inválidos',
      details: [{ field: 'password', message: 'Esa contraseña es demasiado común o fácil de adivinar' }],
    });
  }

  try {
    const passwordHash = await argon2.hash(password);
    const user = await User.create({ name, email, passwordHash });
    res.status(201).json({ user });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Ese correo ya está registrado' });
    }
    throw err;
  }
});

router.post('/login', loginLimiter, validate(loginSchema), async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+passwordHash');
  const valid = await argon2.verify(user ? user.passwordHash : DUMMY_HASH, password);

  if (!user || !valid) {
    req.log.warn({ email }, 'login fallido');
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }

  // Cuenta suspendida: el mismo mensaje que unas credenciales inválidas, para no revelar el estado
  if (user.suspended) {
    req.log.warn({ userId: String(user._id) }, 'login de cuenta suspendida');
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }

  res.clearCookie(COOKIE_NAME, cookieOptions);

  if (user.mfaEnabled) {
    res.cookie(MFA_COOKIE_NAME, signMfaToken(user), mfaCookieOptions);
    return res.json({ mfaRequired: true });
  }

  res.cookie(COOKIE_NAME, signToken(user), cookieOptions);
  res.json({ user, mfa: false });
});

router.post('/mfa/verify', mfaLimiter, validate(mfaCodeSchema), async (req, res) => {
  const pending = req.cookies?.[MFA_COOKIE_NAME];
  if (!pending) {
    return res.status(401).json({ error: 'Primero ingresá tu correo y contraseña' });
  }

  let payload;
  try {
    payload = verifyMfaToken(pending);
  } catch {
    return res.status(401).json({ error: 'La verificación expiró, ingresá de nuevo' });
  }

  const user = await User.findById(payload.sub).select(MFA_FIELDS);
  if (!user || !user.mfaEnabled || user.suspended) {
    return res.status(401).json({ error: 'La verificación expiró, ingresá de nuevo' });
  }
  req.auditUser = user;

  if (user.mfaLockUntil && user.mfaLockUntil > new Date()) {
    req.log.warn({ userId: String(user._id) }, 'mfa bloqueado');
    return res.status(429).json({ error: 'Cuenta bloqueada temporalmente por intentos fallidos' });
  }

  if (!(await checkTotp(user, req.body.code))) {
    await registerFailure(user._id);
    req.log.warn({ userId: String(user._id) }, 'codigo mfa invalido');
    return res.status(401).json({ error: 'Código inválido' });
  }

  user.mfaFailCount = 0;
  user.mfaLockUntil = undefined;
  await user.save();

  res.clearCookie(MFA_COOKIE_NAME, mfaCookieOptions);
  res.cookie(COOKIE_NAME, signToken(user, { mfa: true }), cookieOptions);
  res.json({ user, mfa: true });
});

// Verifica la contraseña del usuario de la sesión; si falla, responde 400 y devuelve false
async function checkPassword(req, res, password) {
  const withHash = await User.findById(req.user._id).select('+passwordHash');
  if (withHash && (await argon2.verify(withHash.passwordHash, password))) return true;
  req.log.warn({ userId: String(req.user._id) }, 'contraseña incorrecta en una operación sensible');
  res.status(400).json({
    error: 'Datos inválidos',
    details: [{ field: 'password', message: 'La contraseña no es correcta' }],
  });
  return false;
}

router.post('/mfa/setup', authenticate, passwordLimiter, validate(mfaSetupSchema), async (req, res) => {
  if (req.user.mfaEnabled) {
    return res.status(409).json({ error: 'El MFA ya está activo' });
  }
  if (!(await checkPassword(req, res, req.body.password))) return;
  const secret = generateSecret();
  await User.updateOne({ _id: req.user._id }, { $set: { mfaSecretEnc: encrypt(secret) } });
  const qr = await QRCode.toDataURL(otpauthUri(req.user.email, secret), { margin: 1, width: 220 });
  res.json({ secret, qr });
});

router.post('/mfa/enable', authenticate, mfaLimiter, validate(mfaCodeSchema), async (req, res) => {
  const user = await User.findById(req.user._id).select(MFA_FIELDS);
  if (user.mfaEnabled) return res.status(409).json({ error: 'El MFA ya está activo' });
  if (!user.mfaSecretEnc) return res.status(400).json({ error: 'Primero generá el código QR' });

  if (!(await checkTotp(user, req.body.code))) {
    req.log.warn({ userId: String(user._id) }, 'activacion mfa con codigo invalido');
    return res.status(401).json({ error: 'Código inválido' });
  }

  user.mfaEnabled = true;
  user.mfaFailCount = 0;
  await user.save();

  res.cookie(COOKIE_NAME, signToken(user, { mfa: true }), cookieOptions);
  res.json({ user });
});

// Cerrar sesión revoca todos los tokens del usuario: sube su versión de tokens
router.post('/logout', async (req, res) => {
  const session = readSession(req.cookies?.[COOKIE_NAME]);
  if (session) {
    await User.updateOne({ _id: session.sub }, { $inc: { tokenVersion: 1 } });
    req.auditUser = { _id: session.sub };
  }
  res.clearCookie(COOKIE_NAME, cookieOptions);
  res.clearCookie(MFA_COOKIE_NAME, mfaCookieOptions);
  res.json({ ok: true });
});

// Desactivar el MFA: contraseña y código vigente. El admin no puede, porque para él es obligatorio.
// Revoca las demás sesiones, porque cambia la forma de autenticarse.
router.post('/mfa/disable', authenticate, passwordLimiter, validate(mfaDisableSchema), async (req, res) => {
  if (!req.user.mfaEnabled) {
    return res.status(409).json({ error: 'El MFA no está activo' });
  }
  if (req.user.role === 'admin') {
    return res.status(403).json({ error: 'El MFA es obligatorio para el administrador' });
  }
  if (!(await checkPassword(req, res, req.body.password))) return;

  const user = await User.findById(req.user._id).select(MFA_FIELDS);
  if (!(await checkTotp(user, req.body.code))) {
    req.log.warn({ userId: String(user._id) }, 'desactivacion mfa con codigo invalido');
    return res.status(400).json({
      error: 'Datos inválidos',
      details: [{ field: 'code', message: 'El código no es válido' }],
    });
  }

  const updated = await User.findByIdAndUpdate(
    user._id,
    {
      $set: { mfaEnabled: false, mfaFailCount: 0 },
      $unset: { mfaSecretEnc: 1, mfaLastCode: 1, mfaLastCodeAt: 1, mfaLockUntil: 1 },
      $inc: { tokenVersion: 1 },
    },
    { returnDocument: 'after' }
  );

  req.log.info({ userId: String(user._id) }, 'mfa desactivado; sesiones anteriores revocadas');
  res.cookie(COOKIE_NAME, signToken(updated, { mfa: false }), cookieOptions);
  res.json({ user: updated });
});

// Cambio de contraseña: exige la actual, aplica la misma política que el registro y revoca todas
// las demás sesiones (sube la versión de tokens). La sesión actual recibe un token nuevo.
router.post('/password', authenticate, passwordLimiter, validate(changePasswordSchema), async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id).select('+passwordHash');

  if (!(await argon2.verify(user.passwordHash, currentPassword))) {
    req.log.warn({ userId: String(user._id) }, 'cambio de contraseña con clave actual incorrecta');
    return res.status(400).json({
      error: 'Datos inválidos',
      details: [{ field: 'currentPassword', message: 'La contraseña actual no es correcta' }],
    });
  }

  if (newPassword === currentPassword) {
    return res.status(400).json({
      error: 'Datos inválidos',
      details: [{ field: 'newPassword', message: 'La nueva contraseña tiene que ser distinta de la actual' }],
    });
  }

  if (isWeakPassword(newPassword, { email: user.email, name: user.name })) {
    return res.status(400).json({
      error: 'Datos inválidos',
      details: [{ field: 'newPassword', message: 'Esa contraseña es demasiado común o fácil de adivinar' }],
    });
  }

  const passwordHash = await argon2.hash(newPassword);
  const updated = await User.findByIdAndUpdate(
    user._id,
    { $set: { passwordHash }, $inc: { tokenVersion: 1 } },
    { returnDocument: 'after' }
  );

  req.log.info({ userId: String(user._id) }, 'contraseña cambiada; sesiones anteriores revocadas');
  res.cookie(COOKIE_NAME, signToken(updated, { mfa: req.auth.mfa }), cookieOptions);
  res.json({ ok: true });
});

// Cerrar todas las sesiones, incluida la actual (por ejemplo, ante un dispositivo perdido)
router.post('/logout-all', authenticate, validate(emptyBodySchema), async (req, res) => {
  await User.updateOne({ _id: req.user._id }, { $inc: { tokenVersion: 1 } });
  req.log.info({ userId: String(req.user._id) }, 'todas las sesiones cerradas');
  res.clearCookie(COOKIE_NAME, cookieOptions);
  res.clearCookie(MFA_COOKIE_NAME, mfaCookieOptions);
  res.json({ ok: true });
});

router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user, mfa: req.auth.mfa });
});

export default router;
