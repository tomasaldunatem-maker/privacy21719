import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { env, isProd } from './config/env.js';
import { loadSession, originGuard, requireAuth } from './middleware/auth.js';
import { errorHandler, notFoundApi } from './middleware/error.js';
import { pool } from './db/index.js';
import { router as auth } from './modules/auth.js';
import { router as users } from './modules/users.js';
import { router as organization } from './modules/organization.js';
import { router as dashboard } from './modules/dashboard.js';
import { router as diagnostic } from './modules/diagnostic.js';
import { router as tasks } from './modules/tasks.js';
import { router as processing } from './modules/processing.js';
import { router as requests, publicRouter } from './modules/requests.js';
import { router as incidents } from './modules/incidents.js';
import { router as vendors } from './modules/vendors.js';
import { router as documents } from './modules/documents.js';
import { router as auditLog } from './modules/audit-log.js';
import { router as integration } from './modules/integration.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  // Detrás de un proxy HTTPS (Render, Railway, Nginx…) para conocer la IP real del cliente
  if (isProd) app.set('trust proxy', env.TRUST_PROXY === 'true' ? true : Number(env.TRUST_PROXY) || 1);

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        frameAncestors: ["'none'"],
        ...(isProd ? {} : { upgradeInsecureRequests: null }),
      },
    },
    hsts: isProd,
    referrerPolicy: { policy: 'same-origin' },
  }));
  app.use(express.json({ limit: '200kb' }));
  app.use(cookieParser());

  const api = express.Router();
  api.use(rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: 'draft-8', legacyHeaders: false }));
  api.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  api.get('/health', async (_req, res) => {
    await pool.query('select 1');
    res.json({ ok: true });
  });
  api.use(originGuard);
  api.use('/public', publicRouter);
  api.use(loadSession);
  api.use('/auth', auth);
  api.use(requireAuth);
  api.use('/users', users);
  api.use('/organization', organization);
  api.use('/dashboard', dashboard);
  api.use('/diagnostic', diagnostic);
  api.use('/tasks', tasks);
  api.use('/processing', processing);
  api.use('/requests', requests);
  api.use('/incidents', incidents);
  api.use('/vendors', vendors);
  api.use('/documents', documents);
  api.use('/audit', auditLog);
  api.use('/integration', integration);
  api.use(notFoundApi);
  app.use('/api', api);

  // En producción el mismo servidor entrega la aplicación web compilada
  const here = path.dirname(fileURLToPath(import.meta.url));
  const webDist = path.resolve(here, here.includes(`${path.sep}dist${path.sep}`) ? '../../../web/dist' : '../../web/dist');
  if (fs.existsSync(webDist)) {
    app.use(express.static(webDist, { index: false, maxAge: isProd ? '1h' : 0 }));
    app.get('/{*splat}', (_req, res) => res.sendFile(path.join(webDist, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}
