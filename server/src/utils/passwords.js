// Rechazo de contraseñas comunes o fáciles de adivinar (recomendación de NIST SP 800-63B:
// comparar contra una lista de contraseñas conocidas en lugar de exigir composición).
const COMUNES = new Set([
  '1234567890',
  '0123456789',
  '0987654321',
  '1234567891',
  '12345678910',
  '123456789012',
  '1111111111',
  '0000000000',
  '1q2w3e4r5t',
  '1qaz2wsx3edc',
  'qazwsxedcrfv',
  'qwertyuiop',
  'asdfghjkl1',
  'zxcvbnm123',
  'abcdefghij',
  'abc1234567',
  'abcd123456',
  'password12',
  'passw0rd12',
  'passw0rd123',
  'contrasena1',
  'contraseña1',
  'iloveyou12',
  'welcome123',
  'letmein123',
  'administrador',
  'administrator',
  'admin12345',
  'guatemala123',
  'guatemala2024',
  'guatemala2025',
  'guatemala2026',
]);

// Si la contraseña contiene alguno de estos fragmentos se considera débil.
const FRAGMENTOS = [
  'password',
  'contrasena',
  'contraseña',
  'qwerty',
  '123456',
  '654321',
  'abcdef',
  'letmein',
  'iloveyou',
  'admin123',
];

export function isWeakPassword(password, { email = '', name = '' } = {}) {
  const p = String(password).toLowerCase();

  if (COMUNES.has(p)) return true;
  if (/^(.)\1+$/u.test(p)) return true; // un solo carácter repetido
  if (FRAGMENTOS.some((f) => p.includes(f))) return true;

  const local = String(email).toLowerCase().split('@')[0];
  if (local.length >= 4 && p.includes(local)) return true;

  const nombre = String(name).toLowerCase().replace(/\s+/g, '');
  if (nombre.length >= 4 && p.includes(nombre)) return true;

  return false;
}
