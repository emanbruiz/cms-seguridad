import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { User } from '../models/User.js';

export const COOKIE_NAME = 'token';

export const cookieOptions = {
  httpOnly: true,
  sameSite: 'strict',
  secure: config.nodeEnv === 'production',
  maxAge: 30 * 60 * 1000,
};

export function signToken(user) {
  return jwt.sign({ role: user.role }, config.jwtSecret, {
    algorithm: 'HS256',
    subject: String(user._id),
    expiresIn: '30m',
  });
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

  const user = await User.findById(payload.sub);
  if (!user) return res.status(401).json({ error: 'Sesión inválida o expirada' });

  req.user = user;
  next();
}

export const authorize = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'No tenés permiso para esta acción' });
  }
  next();
};