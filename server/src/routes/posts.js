import { Router } from 'express';
import { Post } from '../models/Post.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { validId, validSlug } from '../middleware/params.js';
import { createPostSchema, updatePostSchema } from '../validators/post.js';
import { slugify, randomSuffix } from '../utils/slug.js';

const router = Router();
const RESERVED_SLUGS = ['manage'];
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

async function loadPostFor(req, res) {
  const post = await Post.findById(req.params.id);
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

// Público: solo posts publicados
router.get('/', async (req, res) => {
  const { page, limit } = pageParams(req.query);
  const filter = { status: 'publicado' };
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
  const filter = req.user.role === 'admin' ? {} : { author: req.user._id };
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

router.get('/manage/:id', ...canWrite, validId, async (req, res) => {
  const post = await loadPostFor(req, res);
  if (!post) return;
  res.json({ post });
});

router.get('/:slug', validSlug, async (req, res) => {
  const post = await Post.findOne({ slug: req.params.slug, status: 'publicado' }).populate('author', 'name');
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

router.delete('/:id', ...canWrite, validId, async (req, res) => {
  const post = await loadPostFor(req, res);
  if (!post) return;
  await post.deleteOne();
  req.log.info({ userId: String(req.user._id), postId: String(post._id) }, 'post eliminado');
  res.json({ ok: true });
});

export default router;