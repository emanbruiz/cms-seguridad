import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { fileTypeFromBuffer } from 'file-type';
import { Media } from '../models/Media.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validId } from '../middleware/params.js';
import { uploadLimiter } from '../middleware/rateLimit.js';
import { UPLOAD_DIR, MAX_UPLOAD_BYTES } from '../config/uploads.js';

const router = Router();
const canUpload = [authenticate, authorize('editor', 'admin')];

const ALLOWED = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
const MIME_BY_EXT = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' };
const FILE_RE = /^[a-f0-9-]{36}\.(png|jpg|webp)$/;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 0 },
});

function receive(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      const tooBig = err.code === 'LIMIT_FILE_SIZE';
      return res
        .status(tooBig ? 413 : 400)
        .json({ error: tooBig ? 'La imagen supera 2 MB' : 'Subida inválida' });
    }
    next(err);
  });
}

// Público: sirve una imagen por su nombre aleatorio
router.get('/:filename', (req, res) => {
  const { filename } = req.params;
  if (!FILE_RE.test(filename)) {
    return res.status(404).json({ error: 'Archivo no encontrado' });
  }
  res.set({
    'Content-Type': MIME_BY_EXT[filename.split('.').pop()],
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; sandbox",
    'Cache-Control': 'public, max-age=31536000, immutable',
  });
  res.sendFile(filename, { root: UPLOAD_DIR, dotfiles: 'deny' }, (err) => {
    if (err && !res.headersSent) {
      res.status(404).json({ error: 'Archivo no encontrado' });
    }
  });
});

// Editor: sus imágenes. Admin: todas.
router.get('/', ...canUpload, async (req, res) => {
  const page = Math.min(Math.max(parseInt(req.query.page, 10) || 1, 1), 1000);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);
  const filter = req.user.role === 'admin' ? {} : { owner: req.user._id };

  const [media, total] = await Promise.all([
    Media.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Media.countDocuments(filter),
  ]);
  res.json({ media, page, limit, total });
});

router.post('/', uploadLimiter, ...canUpload, receive, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Falta el archivo' });

  const type = await fileTypeFromBuffer(req.file.buffer);
  const ext = type ? ALLOWED[type.mime] : undefined;
  if (!ext) {
    req.log.warn({ userId: String(req.user._id), claimed: req.file.mimetype }, 'subida rechazada por tipo');
    return res.status(415).json({ error: 'Solo se permiten imágenes PNG, JPG o WEBP' });
  }

  const filename = `${crypto.randomUUID()}.${ext}`;
  const filePath = path.join(UPLOAD_DIR, filename);
  await fs.writeFile(filePath, req.file.buffer, { flag: 'wx' });

  try {
    const media = await Media.create({
      filename,
      mime: type.mime,
      size: req.file.size,
      owner: req.user._id,
    });
    req.log.info({ userId: String(req.user._id), filename, size: req.file.size }, 'imagen subida');
    res.status(201).json({ media, url: `/api/media/${filename}` });
  } catch (err) {
    await fs.unlink(filePath).catch(() => {});
    throw err;
  }
});

router.delete('/:id', ...canUpload, validId, async (req, res) => {
  const media = await Media.findById(req.params.id);
  if (!media) return res.status(404).json({ error: 'Imagen no encontrada' });

  if (!media.owner.equals(req.user._id) && req.user.role !== 'admin') {
    req.log.warn({ userId: String(req.user._id), mediaId: String(media._id) }, 'acceso denegado a imagen ajena');
    return res.status(403).json({ error: 'No tenés permiso sobre esta imagen' });
  }

  await media.deleteOne();
  await fs.unlink(path.join(UPLOAD_DIR, media.filename)).catch(() => {});
  req.log.info({ userId: String(req.user._id), mediaId: String(media._id) }, 'imagen eliminada');
  res.json({ ok: true });
});

export default router;