import mongoose from 'mongoose';
import { User, ROLES } from '../src/models/User.js';

const email = process.argv[2]?.trim().toLowerCase();
const role = process.argv[3];

if (!email || !ROLES.includes(role)) {
  console.error(`Uso: node --env-file=.env scripts/set-role.js correo@ejemplo.com <${ROLES.join('|')}>`);
  process.exit(1);
}

await mongoose.connect(process.env.MONGO_URI);
const user = await User.findOneAndUpdate({ email }, { role }, { returnDocument: 'after' });
console.log(user ? `${user.email} ahora es ${user.role}` : 'Usuario no encontrado');
await mongoose.disconnect();