import { Router } from 'express';
import mongoose from 'mongoose';
import { AuditLog } from '../models/AuditLog.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, authorize('admin'), async (req, res) => {
  const page = Math.min(Math.max(parseInt(req.query.page, 10) || 1, 1), 1000);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);

  const filter = {};
  if (req.query.errors === '1') filter.status = mongoose.trusted({ $gte: 400 });

  const [logs, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    AuditLog.countDocuments(filter),
  ]);
  res.json({ logs, page, limit, total });
});

export default router;