import mongoose from 'mongoose';

export const ROLES = ['admin', 'editor', 'lector'];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, default: 'lector' },
    // Se incrementa al cerrar sesión: invalida todos los tokens emitidos antes
    tokenVersion: { type: Number, default: 0 },
    mfaEnabled: { type: Boolean, default: false },
    mfaSecretEnc: { type: String, select: false },
    mfaLastCode: { type: String, select: false },
    mfaLastCodeAt: { type: Date, select: false },
    mfaFailCount: { type: Number, default: 0, select: false },
    mfaLockUntil: { type: Date, select: false },
  },
  { timestamps: true }
);

const HIDDEN = [
  'passwordHash',
  'tokenVersion',
  'mfaSecretEnc',
  'mfaLastCode',
  'mfaLastCodeAt',
  'mfaFailCount',
  'mfaLockUntil',
  '__v',
];

userSchema.set('toJSON', {
  transform: (doc, ret) => {
    for (const key of HIDDEN) delete ret[key];
    return ret;
  },
});

export const User = mongoose.model('User', userSchema);
