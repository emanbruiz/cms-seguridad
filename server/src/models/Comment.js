import mongoose from 'mongoose';

export const COMMENT_STATUSES = ['pendiente', 'aprobado', 'rechazado'];

// Comentario de un usuario registrado en una publicación. Solo se muestra cuando está aprobado.
const commentSchema = new mongoose.Schema(
  {
    post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true, maxlength: 1000 },
    status: { type: String, enum: COMMENT_STATUSES, default: 'pendiente' },
    moderatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    moderatedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

commentSchema.index({ post: 1, status: 1, createdAt: -1 });
commentSchema.index({ status: 1, createdAt: -1 });

export const Comment = mongoose.model('Comment', commentSchema);
