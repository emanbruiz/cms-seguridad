import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { User } from '../models/User.js';

export const COOKIE_NAME = 'token';
export const MFA_COOKIE_NAME = 'mfa_token';

export const cookieOptions = {
  httpOnly: true,
  sameSite: 'strict',
    secure: config.cookieSecure,
  maxAge: 30 * 60 * 1000,
};

export const mfaCookieOptions = { ...cookieOptions, maxAge: 5 * 60 * 1000 };

export function signToken(user, { mfa = false } = {}) {
  return jwt.sign({ role: user.role, mfa }, config.jwtSecret, {
    algorithm: 'HS256',
    subject: String(user._id),
    expiresIn: '30m',
  });
}

export function signMfaToken(user) {
  return jwt.sign({ purpose: 'mfa' }, config.jwtSecret, {
    algorithm: 'HS256',
    subject: String(user._id),
    expiresIn: '5m',
  });
}

export function verifyMfaToken(token) {
  const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
  if (payload.purpose !== 'mfa') throw new Error('Token inválido');
  return payload;
}

export async function authenticate(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'No autenticado' });

  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
  } catch {
    return res.status(401).json({ error: 'Sesión inválida o expirada' });
  }

  // El token temporal de MFA nunca vale como sesión
  if (payload.purpose === 'mfa') {
    return res.status(401).json({ error: 'Sesión inválida o expirada' });
  }

  const user = await User.findById(payload.sub);
  if (!user) return res.status(401).json({ error: 'Sesión inválida o expirada' });

  req.user = user;
  req.auth = { mfa: payload.mfa === true };
  next();
}

export const authorize = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'No tenés permiso para esta acción' });
  }
  if (req.user.role === 'admin' && !(req.auth?.mfa && req.user.mfaEnabled)) {
    return res.status(403).json({
      error: 'El admin necesita verificar MFA para esta acción',
      code: 'MFA_REQUIRED',
    });
  }
  next();
};