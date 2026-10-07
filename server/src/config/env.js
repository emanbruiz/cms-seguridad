const required = ['MONGO_URI', 'JWT_SECRET', 'MFA_ENC_KEY'];
const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error(`Faltan variables de entorno: ${missing.join(', ')}`);
  process.exit(1);
}

if (process.env.JWT_SECRET.length < 32) {
  console.error('JWT_SECRET es demasiado corto (mínimo 32 caracteres)');
  process.exit(1);
}

if (!/^[a-f0-9]{64}$/i.test(process.env.MFA_ENC_KEY)) {
  console.error('MFA_ENC_KEY debe ser hexadecimal de 64 caracteres (32 bytes)');
  process.exit(1);
}

export const config = {
  port: Number(process.env.PORT) || 4000,
  host: process.env.HOST || '127.0.0.1',
  mongoUri: process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET,
  mfaKey: Buffer.from(process.env.MFA_ENC_KEY, 'hex'),
  nodeEnv: process.env.NODE_ENV || 'development',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
};