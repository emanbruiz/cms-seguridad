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
  },
  { timestamps: true }
);

postSchema.index({ status: 1, publishedAt: -1 });

postSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

export const Post = mongoose.model('Post', postSchema);