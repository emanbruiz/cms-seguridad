import { Router } from 'express';
import { z } from 'zod';
import { User, ROLES } from '../models/User.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { validId } from '../middleware/params.js';

const router = Router();
const roleSchema = z.strictObject({ role: z.enum(ROLES) });
const statusSchema = z.strictObject({ suspended: z.boolean() });
const emptyBodySchema = z.strictObject({}).optional();

router.get('/', authenticate, authorize('admin'), async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);

  const [users, total] = await Promise.all([
    User.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    User.countDocuments(),
  ]);

  res.json({ users, page, limit, total });
});

router.patch('/:id/role', authenticate, authorize('admin'), validId, validate(roleSchema), async (req, res) => {
  if (String(req.user._id) === req.params.id) {
    return res.status(400).json({ error: 'No podés cambiar tu propio rol' });
  }

  const user = await User.findByIdAndUpdate(
    req.params.id,
    { role: req.body.role },
    { returnDocument: 'after', runValidators: true }
  );
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

  req.log.info(
    { adminId: String(req.user._id), targetId: String(user._id), role: user.role },
    'rol de usuario modificado'
  );
  res.json({ user });
});

// Suspender o reactivar una cuenta. Suspender revoca todas sus sesiones.
// No aplica sobre uno mismo ni sobre otro administrador (primero hay que cambiarle el rol).
router.patch('/:id/status', authenticate, authorize('admin'), validId, validate(statusSchema), async (req, res) => {
  if (String(req.user._id) === req.params.id) {
    return res.status(400).json({ error: 'No podés suspender tu propia cuenta' });
  }

  const target = await User.findById(req.params.id);
  if (!target) return res.status(404).json({ error: 'Usuario no encontrado' });
  if (target.role === 'admin') {
    return res.status(400).json({ error: 'Para suspender a un administrador, primero cambiá su rol' });
  }

  const update = { $set: { suspended: req.body.suspended } };
  if (req.body.suspended) update.$inc = { tokenVersion: 1 };
  const user = await User.findByIdAndUpdate(target._id, update, { returnDocument: 'after' });

  req.log.info(
    { adminId: String(req.user._id), targetId: String(user._id), suspended: user.suspended },
    user.suspended ? 'cuenta suspendida' : 'cuenta reactivada'
  );
  res.json({ user });
});

// Cerrar todas las sesiones de otro usuario (por ejemplo, ante una sospecha de robo de cuenta)
router.post('/:id/revoke-sessions', authenticate, authorize('admin'), validId, validate(emptyBodySchema), async (req, res) => {
  if (String(req.user._id) === req.params.id) {
    return res.status(400).json({ error: 'Para tu propia cuenta usá Cerrar todas las sesiones en Seguridad' });
  }

  const user = await User.findByIdAndUpdate(req.params.id, { $inc: { tokenVersion: 1 } }, { returnDocument: 'after' });
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

  req.log.info({ adminId: String(req.user._id), targetId: String(user._id) }, 'sesiones de usuario revocadas por el admin');
  res.json({ ok: true });
});

export default router;