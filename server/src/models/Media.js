import mongoose from 'mongoose';

const mediaSchema = new mongoose.Schema(
  {
    filename: { type: String, required: true, unique: true },
    mime: { type: String, required: true, enum: ['image/png', 'image/jpeg', 'image/webp'] },
    size: { type: Number, required: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: true }
);

mediaSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

export const Media = mongoose.model('Media', mediaSchema);