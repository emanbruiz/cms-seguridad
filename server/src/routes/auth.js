import { Router } from 'express';
import argon2 from 'argon2';
import QRCode from 'qrcode';
import { generateSecret, verify as verifyTotp } from 'otplib';
import { User } from '../models/User.js';
import { validate } from '../middleware/validate.js';
import { registerSchema, loginSchema, mfaCodeSchema } from '../validators/auth.js';
import { loginLimiter, registerLimiter, mfaLimiter } from '../middleware/rateLimit.js';
import {
  authenticate,
  signToken,
  signMfaToken,
  verifyMfaToken,
  COOKIE_NAME,
  MFA_COOKIE_NAME,
  cookieOptions,
  mfaCookieOptions,
} from '../middleware/auth.js';
import { encrypt, decrypt } from '../utils/crypto.js';

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
  if (!user || !user.mfaEnabled) {
    return res.status(401).json({ error: 'La verificación expiró, ingresá de nuevo' });
  }

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

router.post('/mfa/setup', authenticate, async (req, res) => {
  if (req.user.mfaEnabled) {
    return res.status(409).json({ error: 'El MFA ya está activo' });
  }
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

router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, cookieOptions);
  res.clearCookie(MFA_COOKIE_NAME, mfaCookieOptions);
  res.json({ ok: true });
});

router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user, mfa: req.auth.mfa });
});

export default router;