import { Router } from 'express';
import mongoose from 'mongoose';
import { Comment } from '../models/Comment.js';
import { Post } from '../models/Post.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { validId } from '../middleware/params.js';
import { commentLimiter } from '../middleware/rateLimit.js';
import { createCommentSchema, moderateSchema } from '../validators/comment.js';

const router = Router();
const canModerate = [authenticate, authorize('editor', 'admin')];
const PUBLIC_POST = { status: 'publicado', deletedAt: null };
const OBJECT_ID = /^[a-f0-9]{24}$/i;

function pageParams(query, max) {
  const page = Math.min(Math.max(parseInt(query.page, 10) || 1, 1), 1000);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), max);
  return { page, limit };
}

// Puede moderar o borrar: el admin, o el autor del post donde está el comentario
function isModerator(user, post) {
  return user.role === 'admin' || (post && String(post.author) === String(user._id));
}

// Público: comentarios aprobados de una publicación publicada. Del autor solo se expone el nombre.
router.get('/', async (req, res) => {
  const postId = req.query.post;
  if (typeof postId !== 'string' || !OBJECT_ID.test(postId)) {
    return res.status(400).json({ error: 'Publicación inválida' });
  }
  const post = await Post.exists({ _id: postId, ...PUBLIC_POST });
  if (!post) return res.status(404).json({ error: 'Publicación no encontrada' });

  const { page, limit } = pageParams(req.query, 50);
  const filter = { post: postId, status: 'aprobado' };
  const [comments, total] = await Promise.all([
    Comment.find(filter)
      .select('content author createdAt')
      .populate('author', 'name')
      .sort({ createdAt: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Comment.countDocuments(filter),
  ]);
  res.json({ comments, page, limit, total });
});

// Comentar: usuario con sesión, en una publicación publicada. Queda pendiente, salvo que lo escriba
// el autor del post o un admin. El estado lo decide el servidor (el esquema rechaza el campo status).
router.post('/', authenticate, commentLimiter, validate(createCommentSchema), async (req, res) => {
  const post = await Post.findOne({ _id: req.body.post, ...PUBLIC_POST }).select('author');
  if (!post) return res.status(404).json({ error: 'Publicación no encontrada' });

  const autoApproved = isModerator(req.user, post);
  const comment = await Comment.create({
    post: post._id,
    author: req.user._id,
    content: req.body.content,
    status: autoApproved ? 'aprobado' : 'pendiente',
    moderatedBy: autoApproved ? req.user._id : null,
    moderatedAt: autoApproved ? new Date() : null,
  });
  req.log.info({ userId: String(req.user._id), commentId: String(comment._id) }, 'comentario creado');
  res.status(201).json({ comment: { _id: comment._id, content: comment.content, status: comment.status, createdAt: comment.createdAt } });
});

// Moderación: el editor ve los comentarios de sus posts; el admin, todos
router.get('/moderation', ...canModerate, async (req, res) => {
  const status = ['pendiente', 'aprobado', 'rechazado'].includes(req.query.status) ? req.query.status : 'pendiente';
  const { page, limit } = pageParams(req.query, 50);
  const filter = { status };
  if (req.user.role !== 'admin') {
    const own = await Post.find({ author: req.user._id }).distinct('_id');
    // sanitizeFilter envolvería el operador: trusted() lo marca como propio del servidor
    filter.post = mongoose.trusted({ $in: own });
  }
  const [comments, total] = await Promise.all([
    Comment.find(filter)
      .populate('author', 'name')
      .populate('post', 'title slug')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Comment.countDocuments(filter),
  ]);
  res.json({ comments, page, limit, total, status });
});

router.patch('/:id/status', ...canModerate, validId, validate(moderateSchema), async (req, res) => {
  const comment = await Comment.findById(req.params.id);
  if (!comment) return res.status(404).json({ error: 'Comentario no encontrado' });
  const post = await Post.findById(comment.post).select('author');
  if (!isModerator(req.user, post)) {
    req.log.warn({ userId: String(req.user._id), commentId: String(comment._id) }, 'moderacion de comentario ajeno');
    return res.status(403).json({ error: 'No podés moderar comentarios de publicaciones ajenas' });
  }
  comment.status = req.body.status;
  comment.moderatedBy = req.user._id;
  comment.moderatedAt = new Date();
  await comment.save();
  req.log.info({ userId: String(req.user._id), commentId: String(comment._id), status: comment.status }, 'comentario moderado');
  res.json({ comment: { _id: comment._id, status: comment.status } });
});

// Borrar: el autor del comentario, el autor del post o un admin
router.delete('/:id', authenticate, validId, async (req, res) => {
  const comment = await Comment.findById(req.params.id);
  if (!comment) return res.status(404).json({ error: 'Comentario no encontrado' });
  const post = await Post.findById(comment.post).select('author');
  const own = String(comment.author) === String(req.user._id);
  if (!own && !isModerator(req.user, post)) {
    req.log.warn({ userId: String(req.user._id), commentId: String(comment._id) }, 'borrado de comentario ajeno');
    return res.status(403).json({ error: 'No podés borrar este comentario' });
  }
  await comment.deleteOne();
  req.log.info({ userId: String(req.user._id), commentId: String(comment._id) }, 'comentario eliminado');
  res.json({ ok: true });
});

export default router;
