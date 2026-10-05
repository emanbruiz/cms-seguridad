import { z } from 'zod';

const email = z.string().trim().toLowerCase().email().max(254);

export const registerSchema = z.strictObject({
  name: z.string().trim().min(2).max(60),
  email,
  password: z.string().min(10, 'Mínimo 10 caracteres').max(128),
});

export const loginSchema = z.strictObject({
  email,
  password: z.string().min(1).max(128),
});