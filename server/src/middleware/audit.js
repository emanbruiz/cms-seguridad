import { AuditLog } from '../models/AuditLog.js';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const AUTH_ROUTE = /^\/api\/auth\//;

function normalizePath(url) {
  return url
    .split('?')[0]
    .replace(/[a-f0-9]{24}/gi, ':id')
    .replace(/[a-f0-9-]{36}\.\w+/gi, ':file')
    .slice(0, 100);
}

export function auditRequests(req, res, next) {
  if (!WRITE_METHODS.has(req.method)) return next();

  res.on('finish', () => {
    if (res.statusCode === 404) return;

    const bodyEmail =
      AUTH_ROUTE.test(req.originalUrl) && typeof req.body?.email === 'string'
        ? req.body.email.slice(0, 254)
        : null;

    AuditLog.create({
      action: `${req.method} ${normalizePath(req.originalUrl)}`,
      status: res.statusCode,
      userId: req.user?._id ?? req.auditUser?._id ?? null,
      email: req.user?.email ?? req.auditUser?.email ?? bodyEmail,
      ip: req.ip,
      userAgent: String(req.get('user-agent') ?? '').slice(0, 200),
    }).catch((err) => req.log.error({ err }, 'no se pudo guardar la auditoría'));
  });

  next();
}