import fs from 'node:fs';
import path from 'node:path';

export const UPLOAD_DIR = path.resolve(import.meta.dirname, '../../uploads');
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

fs.mkdirSync(UPLOAD_DIR, { recursive: true });