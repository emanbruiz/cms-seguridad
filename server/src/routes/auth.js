import { Router } from 'express';
import argon2 from 'argon2';
import { User } from '../models/User.js';
import { validate } from '../middleware/validate.js';
import { registerSchema, loginSchema } from '../validators/auth.js';
import { loginLimiter, registerLimiter } from '../middleware/rateLimit.js';
import { authenticate, signToken, COOKIE_NAME, cookieOptions } from '../middleware/auth.js';

const router = Router();
const DUMMY_HASH = await argon2.hash('contraseña-falsa-para-igualar-tiempos');

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

  res.cookie(COOKIE_NAME, signToken(user), cookieOptions);
  res.json({ user });
});

router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, cookieOptions);
  res.json({ ok: true });
});

router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

export default router;