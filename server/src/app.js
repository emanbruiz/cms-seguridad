import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import mongoose from 'mongoose';
import { config } from './config/env.js';
import { logger } from './config/logger.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import postRoutes from './routes/posts.js';
import mediaRoutes from './routes/media.js';

const app = express();

app.disable('x-powered-by');
app.use(pinoHttp({ logger }));
app.use(helmet());
app.use(cors({ origin: config.clientOrigin, credentials: true }));
app.use('/api/posts', express.json({ limit: '100kb' }));
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    db: mongoose.connection.readyState === 1 ? 'up' : 'down',
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/media', mediaRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

app.use((err, req, res, next) => {
  req.log.error(err);
  const status = err.status || 500;
  res.status(status).json({
    error: status === 500 ? 'Error interno del servidor' : err.message,
  });
});

export default app;