import { Router } from 'express';
import mongoose from 'mongoose';
import { Post } from '../models/Post.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { validId, validSlug } from '../middleware/params.js';
import { createPostSchema, updatePostSchema, searchSchema, emptyBodySchema } from '../validators/post.js';
import { slugify, randomSuffix } from '../utils/slug.js';

const router = Router();
const RESERVED_SLUGS = ['manage', 'trash'];
const NOT_DELETED = { deletedAt: null };
// sanitizeFilter envuelve los operadores; trusted() marca este como propio, no del usuario
const inTrash = () => ({ deletedAt: mongoose.trusted({ $ne: null }) });
const canWrite = [authenticate, authorize('editor', 'admin')];

function pageParams(query) {
  const page = Math.min(Math.max(parseInt(query.page, 10) || 1, 1), 1000);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 10, 1), 20);
  return { page, limit };
}

async function uniqueSlug(title) {
  const base = slugify(title);
  const taken = RESERVED_SLUGS.includes(base) || (await Post.exists({ slug: base }));
  return taken ? `${base}-${randomSuffix()}` : base;
}

// Carga un post y verifica que sea del usuario (o que sea admin).
// Por defecto ignora los que están en la papelera; con { trash: true } busca solo en la papelera.
async function loadPostFor(req, res, { trash = false } = {}) {
  const post = await Post.findOne({ _id: req.params.id, ...(trash ? inTrash() : NOT_DELETED) });
  if (!post) {
    res.status(404).json({ error: 'Post no encontrado' });
    return null;
  }
  const isOwner = post.author.equals(req.user._id);
  if (!isOwner && req.user.role !== 'admin') {
    req.log.warn(
      { userId: String(req.user._id), postId: String(post._id) },
      'acceso denegado a post ajeno'
    );
    res.status(403).json({ error: 'No tenés permiso sobre este post' });
    return null;
  }
  return post;
}

// Público: solo posts publicados y fuera de la papelera. Admite búsqueda con ?q=
router.get('/', async (req, res) => {
  const { page, limit } = pageParams(req.query);
  const filter = { status: 'publicado', ...NOT_DELETED };

  if (req.query.q !== undefined) {
    const result = searchSchema.safeParse(req.query.q);
    if (!result.success) {
      return res.status(400).json({ error: 'Búsqueda inválida', details: [{ field: 'q', message: result.error.issues[0].message }] });
    }
    filter.$text = mongoose.trusted({ $search: result.data });
  }

  const [posts, total] = await Promise.all([
    Post.find(filter)
      .select('-content')
      .populate('author', 'name')
      .sort({ publishedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Post.countDocuments(filter),
  ]);
  res.json({ posts, page, limit, total });
});

// Editor: sus posts. Admin: todos. Incluye borradores.
router.get('/manage', ...canWrite, async (req, res) => {
  const { page, limit } = pageParams(req.query);
  const filter = req.user.role === 'admin' ? { ...NOT_DELETED } : { author: req.user._id, ...NOT_DELETED };
  const [posts, total] = await Promise.all([
    Post.find(filter)
      .select('-content')
      .populate('author', 'name')
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Post.countDocuments(filter),
  ]);
  res.json({ posts, page, limit, total });
});

// Papelera: el editor ve lo suyo, el admin todo
router.get('/trash', ...canWrite, async (req, res) => {
  const { page, limit } = pageParams(req.query);
  const filter = req.user.role === 'admin' ? inTrash() : { author: req.user._id, ...inTrash() };
  const [posts, total] = await Promise.all([
    Post.find(filter)
      .select('-content')
      .populate('author', 'name')
      .populate('deletedBy', 'name')
      .sort({ deletedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Post.countDocuments(filter),
  ]);
  res.json({ posts, page, limit, total });
});

router.get('/manage/:id', ...canWrite, validId, async (req, res) => {
  const post = await loadPostFor(req, res);
  if (!post) return;
  res.json({ post });
});

router.get('/:slug', validSlug, async (req, res) => {
  const post = await Post.findOne({ slug: req.params.slug, status: 'publicado', ...NOT_DELETED }).populate('author', 'name');
  if (!post) return res.status(404).json({ error: 'Post no encontrado' });
  res.json({ post });
});

router.post('/', ...canWrite, validate(createPostSchema), async (req, res) => {
  const { title, content, status } = req.body;
  try {
    const slug = await uniqueSlug(title);
    const post = await Post.create({
      title,
      content,
      status,
      slug,
      author: req.user._id,
      publishedAt: status === 'publicado' ? new Date() : null,
    });
    res.status(201).json({ post });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Conflicto al generar el slug, intentá de nuevo' });
    }
    throw err;
  }
});

router.patch('/:id', ...canWrite, validId, validate(updatePostSchema), async (req, res) => {
  const post = await loadPostFor(req, res);
  if (!post) return;

  const { title, content, status } = req.body;
  if (title !== undefined) post.title = title;
  if (content !== undefined) post.content = content;
  if (status !== undefined) {
    if (status === 'publicado' && !post.publishedAt) post.publishedAt = new Date();
    post.status = status;
  }
  await post.save();
  res.json({ post });
});

// Borrar: envía el post a la papelera (borrado lógico) y deja de verse en el sitio público
router.delete('/:id', ...canWrite, validId, async (req, res) => {
  const post = await loadPostFor(req, res);
  if (!post) return;
  post.deletedAt = new Date();
  post.deletedBy = req.user._id;
  await post.save();
  req.log.info({ userId: String(req.user._id), postId: String(post._id) }, 'post enviado a la papelera');
  res.json({ ok: true });
});

// Restaurar desde la papelera. Vuelve como borrador: no se republica sin revisarlo.
router.post('/:id/restore', ...canWrite, validId, validate(emptyBodySchema), async (req, res) => {
  const post = await loadPostFor(req, res, { trash: true });
  if (!post) return;
  post.deletedAt = null;
  post.deletedBy = null;
  post.status = 'borrador';
  await post.save();
  req.log.info({ userId: String(req.user._id), postId: String(post._id) }, 'post restaurado de la papelera');
  res.json({ post });
});

// Borrado definitivo: solo desde la papelera
router.delete('/:id/permanent', ...canWrite, validId, async (req, res) => {
  const post = await loadPostFor(req, res, { trash: true });
  if (!post) return;
  await post.deleteOne();
  req.log.info({ userId: String(req.user._id), postId: String(post._id) }, 'post eliminado definitivamente');
  res.json({ ok: true });
});

export default router;