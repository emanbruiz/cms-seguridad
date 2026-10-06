import { Router } from 'express';
import { z } from 'zod';
import { User, ROLES } from '../models/User.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { validId } from '../middleware/params.js';

const router = Router();
const roleSchema = z.strictObject({ role: z.enum(ROLES) });

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

export default router;