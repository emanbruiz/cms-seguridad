import { z } from 'zod';

const title = z.string().trim().min(3).max(150);
const content = z.string().min(1).max(20000);
const status = z.enum(['borrador', 'publicado']);

export const createPostSchema = z.strictObject({
  title,
  content,
  status: status.default('borrador'),
});

export const updatePostSchema = z
  .strictObject({
    title: title.optional(),
    content: content.optional(),
    status: status.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'Enviá al menos un campo' });