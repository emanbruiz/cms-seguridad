import { z } from 'zod';

const objectId = z.string().regex(/^[a-f0-9]{24}$/i, 'Identificador inválido');

// Texto plano: se muestra como texto (nunca como HTML ni Markdown). Pocos enlaces, para frenar el spam.
const content = z
  .string()
  .trim()
  .min(2, 'El comentario debe tener al menos 2 caracteres')
  .max(1000, 'El comentario puede tener como máximo 1000 caracteres')
  .refine((t) => (t.match(/https?:\/\//gi) || []).length <= 2, 'El comentario puede tener como máximo 2 enlaces');

export const createCommentSchema = z.strictObject({ post: objectId, content });

export const moderateSchema = z.strictObject({ status: z.enum(['aprobado', 'rechazado']) });
