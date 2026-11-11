import mongoose from 'mongoose';

export const STATUSES = ['borrador', 'publicado'];

const postSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 150 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 160 },
    content: { type: String, required: true, maxlength: 20000 },
    status: { type: String, enum: STATUSES, default: 'borrador' },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    publishedAt: { type: Date, default: null },
    // Papelera: borrado lógico. Se puede restaurar hasta que el índice TTL lo elimine a los 30 días.
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

postSchema.index({ status: 1, publishedAt: -1 });
// Borrado definitivo automático: 30 días después de enviar el post a la papelera
postSchema.index({ deletedAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });
// Búsqueda de texto (sin expresiones regulares, así no hay riesgo de ReDoS)
postSchema.index(
  { title: 'text', content: 'text' },
  { name: 'busqueda', weights: { title: 5, content: 1 }, default_language: 'spanish' }
);

postSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

export const Post = mongoose.model('Post', postSchema);