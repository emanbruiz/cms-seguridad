import { z } from 'zod';
import { CATEGORIES } from '../models/Post.js';

const title = z.string().trim().min(3).max(150);
const content = z.string().min(1).max(20000);
const status = z.enum(['borrador', 'publicado']);
export const category = z.enum(CATEGORIES);
// Etiqueta: minúsculas, letras, números y guiones (sin espacios ni símbolos)
export const tag = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, 'Cada etiqueta debe tener al menos 2 caracteres')
  .max(30, 'Cada etiqueta puede tener como máximo 30 caracteres')
  .regex(/^[a-z0-9áéíóúüñ]+(?:-[a-z0-9áéíóúüñ]+)*$/, 'Las etiquetas solo pueden tener letras, números y guiones');
const tags = z
  .array(tag)
  .max(8, 'Máximo 8 etiquetas')
  .transform((list) => [...new Set(list)]);
const excerpt = z.string().trim().max(300, 'El extracto puede tener como máximo 300 caracteres');
const featuredImage = z.string().regex(/^[a-f0-9]{24}$/i, 'Imagen inválida').nullable();

export const createPostSchema = z.strictObject({
  title,
  content,
  status: status.default('borrador'),
  category: category.default('General'),
  tags: tags.default([]),
  excerpt: excerpt.optional(),
  featuredImage: featuredImage.optional(),
});

export const updatePostSchema = z
  .strictObject({
    title: title.optional(),
    content: content.optional(),
    status: status.optional(),
    category: category.optional(),
    tags: tags.optional(),
    excerpt: excerpt.optional(),
    featuredImage: featuredImage.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'Enviá al menos un campo' });

// Búsqueda pública: texto corto, sin estructura (se usa con el índice de texto, no con regex)
export const searchSchema = z.string().trim().min(2, 'Escribí al menos 2 caracteres').max(100, 'Búsqueda demasiado larga');

// Rutas sin cuerpo
export const emptyBodySchema = z.strictObject({}).optional();
