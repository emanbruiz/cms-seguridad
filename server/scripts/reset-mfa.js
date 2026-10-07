import mongoose from 'mongoose';
import { User } from '../src/models/User.js';

const email = process.argv[2]?.trim().toLowerCase();
const unlockOnly = process.argv.includes('--unlock');

if (!email) {
  console.error('Uso: node --env-file=.env scripts/reset-mfa.js correo@ejemplo.com [--unlock]');
  process.exit(1);
}

const update = unlockOnly
  ? { $set: { mfaFailCount: 0 }, $unset: { mfaLockUntil: '' } }
  : {
      $set: { mfaEnabled: false, mfaFailCount: 0 },
      $unset: { mfaSecretEnc: '', mfaLastCode: '', mfaLastCodeAt: '', mfaLockUntil: '' },
    };

await mongoose.connect(process.env.MONGO_URI);
const result = await User.updateOne({ email }, update);
console.log(
  result.matchedCount
    ? `${unlockOnly ? 'Bloqueo levantado' : 'MFA reiniciado'} para ${email}`
    : 'Usuario no encontrado'
);
await mongoose.disconnect();