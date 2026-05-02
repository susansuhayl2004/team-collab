'use strict';

/**
 * @fileoverview TeamCollab — Express application entry point.
 *
 * Bootstraps all middleware in the correct order:
 *   1. Security (helmet, cors, rate-limiting)
 *   2. Performance (compression, response-time header)
 *   3. Observability (morgan request logging)
 *   4. Parsing (json, urlencoded)
 *   5. Static file serving
 *   6. API routes
 *   7. SPA fallback
 *   8. Centralised error handler
 *
 * Designed for deployment on Google Cloud Run via Docker.
 * @module server
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
const { AppError } = require('./utils/errors');

const app = express();
const PORT = process.env.PORT || 8080;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Trust Cloud Run / GCP load-balancer's reverse proxy so
// express-rate-limit can read the real client IP from X-Forwarded-For.
app.set('trust proxy', 1);


app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'", "'unsafe-inline'",
        'https://www.gstatic.com', 'https://apis.google.com',
        'https://cdn.jsdelivr.net', 'https://cdnjs.cloudflare.com',
        'https://*.firebaseapp.com',
      ],
      styleSrc: [
        "'self'", "'unsafe-inline'",
        'https://fonts.googleapis.com', 'https://cdnjs.cloudflare.com',
      ],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://cdnjs.cloudflare.com'],
      connectSrc: [
        "'self'",
        'https://*.firebaseio.com', 'wss://*.firebaseio.com',
        'https://*.googleapis.com', 'https://identitytoolkit.googleapis.com',
        'https://securetoken.googleapis.com', 'https://firestore.googleapis.com',
        'https://*.firebaseapp.com',
      ],
      imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
      frameSrc: [
        "'self'",
        'https://accounts.google.com',
        'https://*.firebaseapp.com',
        'https://teamcollab-8c854.firebaseapp.com',
      ],
    },
  },
}));


// ── CORS ───────────────────────────────────────────────────────────────────────

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : '*';

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// ── Rate Limiting ──────────────────────────────────────────────────────────────

/** Global limiter — protects all endpoints from abuse. */
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1_000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later.' },
});

/** Tighter limit for mutation and AI endpoints. */
const apiWriteLimiter = rateLimit({
  windowMs: 60 * 1_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'API rate limit exceeded.' },
});

app.use(globalLimiter);
app.use('/api/', apiWriteLimiter);

// ── Performance Middleware ─────────────────────────────────────────────────────

/** Compress all responses > 1 KB. */
app.use(compression({ threshold: 1024 }));

/** Adds X-Response-Time header to every response for observability. */
app.use((req, res, next) => {
  const start = process.hrtime.bigint();
  res.on('header', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    if (!res.headersSent) {
      res.setHeader('X-Response-Time', `${durationMs.toFixed(2)}ms`);
    }
  });
  next();
});

// ── Observability ──────────────────────────────────────────────────────────────

app.use(morgan(IS_PRODUCTION ? 'combined' : 'dev'));

// ── Body Parsing ───────────────────────────────────────────────────────────────

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Static Files ───────────────────────────────────────────────────────────────

app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: IS_PRODUCTION ? '1d' : 0,
  etag: true,
  lastModified: true,
}));

// ── Health & Readiness ─────────────────────────────────────────────────────────

/**
 * @route GET /health
 * @description Liveness probe for Cloud Run and load balancers.
 * @returns {{ status: string, timestamp: string, uptime: number, version: string }}
 */
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
    version: process.env.npm_package_version || '1.0.0',
    service: 'TeamCollab',
    environment: process.env.NODE_ENV || 'development',
  });
});

/**
 * @route GET /ready
 * @description Readiness probe — can be extended to check DB connectivity.
 */
app.get('/ready', (req, res) => {
  res.status(200).json({ ready: true, timestamp: new Date().toISOString() });
});

// ── API Routes ─────────────────────────────────────────────────────────────────

const teamsRouter = require('./routes/teams');
const tasksRouter = require('./routes/tasks');
const messagesRouter = require('./routes/messages');
const usersRouter = require('./routes/users');
const aiRouter = require('./routes/ai');

app.use('/api/teams', teamsRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/users', usersRouter);
app.use('/api/ai', aiRouter);

/**
 * @route GET /api
 * @description Returns API metadata and available endpoint listing.
 */
app.get('/api', (req, res) => {
  res.json({
    name: 'TeamCollab API',
    version: '2.0.0',
    description: 'AI-powered team coordination platform API',
    endpoints: {
      health: '/health',
      readiness: '/ready',
      teams: '/api/teams',
      tasks: '/api/tasks',
      messages: '/api/messages',
      users: '/api/users',
      ai: '/api/ai',
    },
  });
});

// ── SPA Fallback ───────────────────────────────────────────────────────────────

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Centralised Error Handler ──────────────────────────────────────────────────

/**
 * Express error-handling middleware. Must have 4 parameters.
 * Differentiates between operational errors (AppError) and
 * unexpected programmer errors to avoid leaking stack traces in production.
 *
 * @param {Error} err
 * @param {express.Request} req
 * @param {express.Response} res
 * @param {express.NextFunction} _next - Required by Express signature
 */
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  if (err instanceof AppError && err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
    });
  }

  // Unexpected error — log in full, respond with generic message
  console.error('Unexpected error:', err);
  res.status(500).json({
    success: false,
    error: IS_PRODUCTION ? 'An unexpected error occurred' : err.message,
    code: 'INTERNAL_ERROR',
  });
});

// ── Server Start ───────────────────────────────────────────────────────────────

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 TeamCollab v2.0 running on port ${PORT}`);
    console.log(`📡 Environment : ${process.env.NODE_ENV || 'development'}`);
    console.log(`🌐 Health check: http://localhost:${PORT}/health`);
  });
}

module.exports = app;
