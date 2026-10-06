import crypto from 'node:crypto';

export function slugify(text) {
  const base = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return base || 'post';
}

export function randomSuffix() {
  return crypto.randomBytes(3).toString('hex');
}