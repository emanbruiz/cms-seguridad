import app from './app.js';
import { config } from './config/env.js';
import { logger } from './config/logger.js';
import { connectDB, disconnectDB } from './config/db.js';

try {
  await connectDB();
} catch (err) {
  logger.error(`No se pudo conectar a MongoDB: ${err.message}`);
  process.exit(1);
}

const server = app.listen(config.port, config.host, () => {
  logger.info(`API escuchando en http://${config.host}:${config.port}`);
});

async function shutdown(signal) {
  logger.info(`${signal} recibido, cerrando...`);
  server.close(async () => {
    await disconnectDB();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));