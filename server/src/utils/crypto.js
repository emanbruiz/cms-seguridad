import crypto from 'node:crypto';
import { config } from '../config/env.js';

const IV_LENGTH = 12;
const TAG_LENGTH = 16;

export function encrypt(plain) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', config.mfaKey, iv, { authTagLength: TAG_LENGTH });
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, data].map((b) => b.toString('base64')).join('.');
}

export function decrypt(payload) {
  const [iv, tag, data] = payload.split('.').map((s) => Buffer.from(s, 'base64'));
  if (!iv || !tag || !data || iv.length !== IV_LENGTH || tag.length !== TAG_LENGTH) {
    throw new Error('Formato de dato cifrado invalido');
  }
  const decipher = crypto.createDecipheriv('aes-256-gcm', config.mfaKey, iv, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}