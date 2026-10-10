import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import pino from 'pino';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { migrate } from './db/migrate.js';
import { seedDatabase } from './db/seed.js';
import { initClock } from './engines/clock.js';
import { checkAndProcessEscalations } from './engines/escalation.js';
import { updateAllGroupSeverities } from './engines/severity.js';
import { sendEarlyWarningNotifications } from './engines/analytics.js';
import authRoutes from './routes/auth.js';
import projectRoutes from './routes/projects.js';
import reportRoutes from './routes/reports.js';
import groupRoutes from './routes/groups.js';
import workOrderRoutes from './routes/workorders.js';
import verifyRoutes from './routes/verify.js';
import subscriptionRoutes from './routes/subscriptions.js';
import notificationRoutes from './routes/notifications.js';
import analyticsRoutes from './routes/analytics.js';
import adminRoutes from './routes/admin.js';
import conflictRoutes from './routes/conflicts.js';
import { apiRateLimit } from './middleware/rateLimit.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 5000;
// Force production mode when using npm start
const NODE_ENV = process.argv[1]?.includes('dist') ? 'production' : (process.env.NODE_ENV || 'development');

// Logger
const logger = pino.default({ level: NODE_ENV === 'production' ? 'info' : 'debug' });

// Trust proxy for rate limiting behind reverse proxy
app.set('trust proxy', 1);

// Middleware
app.use(helmet({
  contentSecurityPolicy: NODE_ENV === 'production' ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://accounts.google.com/gsi/client"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://accounts.google.com/gsi/style"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: [
        "'self'",
        "data:",
        "blob:",
        "https://*.tile.openstreetmap.org",
        "https://*.basemaps.cartocdn.com",
        "https://server.arcgisonline.com",
        "https://lh3.googleusercontent.com",
        "https://*.googleusercontent.com",
        "http://localhost:5000/uploads"
      ],
      connectSrc: ["'self'", "https://accounts.google.com/gsi/"],
      frameSrc: ["'none'", "https://accounts.google.com/gsi/"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  } : false,
  crossOriginEmbedderPolicy: false,
}));
app.use(cors({
  origin: NODE_ENV === 'production' ? false : ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(apiRateLimit);

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    logger.info({ method: req.method, url: req.url, status: res.statusCode, duration: Date.now() - start }, 'Request');
  });
  next();
});

// Serve uploaded files
app.use('/uploads', express.static(join(__dirname, '..', 'uploads')));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), uptime: process.uptime() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/workorders', workOrderRoutes);
app.use('/api', verifyRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/conflicts', conflictRoutes);

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error({ err, url: req.url, method: req.method }, 'Unhandled error');
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
});

// 404 for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'API endpoint not found' } });
});

// Serve React app in production
if (NODE_ENV === 'production') {
  const clientDist = join(__dirname, '..', '..', 'client', 'dist');
  app.use(express.static(clientDist));
  
  app.get('*', (req, res) => {
    res.sendFile(join(clientDist, 'index.html'));
  });
}

// Initialize database and start server
async function start() {
  try {
    // Run migrations
    logger.info('Running database migrations...');
    migrate();
    
    // Initialize clock
    initClock();
    logger.info('Clock initialized');
    
    // Seed database if empty
    logger.info('Checking seed data...');
    await seedDatabase();
    
    // Start scheduler (every 30 seconds)
    setInterval(async () => {
      try {
        checkAndProcessEscalations();
        updateAllGroupSeverities();
        sendEarlyWarningNotifications();
      } catch (error) {
        logger.error({ err: error }, 'Scheduler error');
      }
    }, 30000);
    logger.info('Scheduler started (30s interval)');
    
    const server = app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT} (${NODE_ENV})`);
    });
    
    server.on('error', (err) => {
      logger.fatal({ err }, 'Server error');
    });
    
    server.on('listening', () => {
      const addr = server.address();
      logger.info({ addr }, 'Server listening');
    });
  } catch (error) {
    logger.fatal({ err: error }, 'Failed to start server');
    process.exit(1);
  }
}

start();

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

export default app;