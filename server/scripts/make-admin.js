import mongoose from 'mongoose';
import { User } from '../src/models/User.js';

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error('Uso: node --env-file=.env scripts/make-admin.js correo@ejemplo.com');
  process.exit(1);
}

await mongoose.connect(process.env.MONGO_URI);
const user = await User.findOneAndUpdate({ email }, { role: 'admin' }, { returnDocument: 'after' });
console.log(user ? `${user.email} ahora es admin` : 'Usuario no encontrado');
await mongoose.disconnect();