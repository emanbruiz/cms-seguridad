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

export const mfaCodeSchema = z.strictObject({
  code: z.string().trim().min(6).max(6),
});

export const changePasswordSchema = z.strictObject({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(10, 'Mínimo 10 caracteres').max(128),
});

// Para rutas sin cuerpo: acepta que no haya cuerpo y rechaza cualquier campo
export const emptyBodySchema = z.strictObject({}).optional();

// Activar el MFA exige la contraseña actual: una sesión robada no basta para enrolar otro autenticador
export const mfaSetupSchema = z.strictObject({
  password: z.string().min(1).max(128),
});

// Desactivar el MFA exige la contraseña y un código vigente de la app
export const mfaDisableSchema = z.strictObject({
  password: z.string().min(1).max(128),
  code: z.string().trim().min(6).max(6),
});
