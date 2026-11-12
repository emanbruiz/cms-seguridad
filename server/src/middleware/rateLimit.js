import rateLimit from 'express-rate-limit';

// Límite general para toda la API: 120 peticiones por minuto y por IP
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiadas peticiones, esperá un momento' },
});

// Inicio de sesión por IP: 10 fallos cada 15 minutos, contra el relleno de credenciales desde una IP.
// Cada cuenta tiene además su propio bloqueo progresivo (routes/auth.js), que no depende de la IP.
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Demasiados intentos, intentá de nuevo en 15 minutos' },
});

export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiados registros desde esta IP, intentá más tarde' },
});

export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiadas subidas, intentá más tarde' },
});

export const mfaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Demasiados intentos de código, intentá de nuevo en 15 minutos' },
});

// Cambio de contraseña: 5 fallos cada 15 minutos por usuario (no por IP), para que una sesión
// robada no pueda probar contraseñas actuales desde muchas IP. Va después de authenticate.
export const passwordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `usuario:${req.user._id}`,
  message: { error: 'Demasiados intentos, intentá de nuevo en 15 minutos' },
});

// Comentarios: 5 cada 10 minutos por usuario, contra el spam. Los rechazados por validación no cuentan.
export const commentLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipFailedRequests: true,
  keyGenerator: (req) => `comentarios:${req.user._id}`,
  message: { error: 'Estás comentando demasiado seguido, esperá unos minutos' },
});
