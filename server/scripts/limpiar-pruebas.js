import mongoose from 'mongoose';
import { User } from '../src/models/User.js';

// Borra las cuentas que crea el script de caja gris (cuenta12345@test.com, mfa12345@test.com, etc.).
// Sin --confirmar solo muestra cuántas encontró. Nunca toca cuentas admin ni otros correos.
// Uso: docker compose exec api node scripts/limpiar-pruebas.js [--confirmar]
const PATRON = /^(cuenta|mfa|susp|bloqueo|debil|catorce|corta|rol)\d{5}@test\.com$/;
const confirmar = process.argv.includes('--confirmar');

await mongoose.connect(process.env.MONGO_URI);
const filtro = { email: PATRON, role: { $ne: 'admin' } };
const total = await User.countDocuments(filtro);

if (!confirmar) {
  console.log(`Cuentas de prueba encontradas: ${total}. Para borrarlas, agregá --confirmar`);
} else {
  const { deletedCount } = await User.deleteMany(filtro);
  console.log(`Cuentas de prueba borradas: ${deletedCount}`);
}
await mongoose.disconnect();
