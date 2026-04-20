const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const helmet = require('helmet');
const compression = require('compression');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');

dotenv.config();

const connectDb = require('./src/config/db');
const authRoutes = require('./src/routes/authRoutes');
const employeeRoutes = require('./src/routes/employeeRoutes');
const leadRoutes = require('./src/routes/leadRoutes');
const projectRoutes = require('./src/routes/projectRoutes');
const taskRoutes = require('./src/routes/taskRoutes');
const customerRoutes = require('./src/routes/customerRoutes');
const chatRoutes = require('./src/routes/chatRoutes');
const dealRoutes = require('./src/routes/dealRoutes');
const notificationRoutes = require('./src/routes/notificationRoutes');
const analyticsRoutes = require('./src/routes/analyticsRoutes');
const { errorHandler, notFound } = require('./src/middleware/errorMiddleware');
const { apiLimiter } = require('./src/middleware/rateLimitMiddleware');
const seedAdmin = require('./src/utils/seedAdmin');
const { startAutomationScheduler } = require('./src/utils/automationScheduler');

const app = express();
app.get("/", (req, res) => {
  res.send("CRM Backend is Running 🚀");
});

function parseCorsOrigins(raw) {
  return String(raw || '')
    .split(',')
    .map((item) => item.trim().replace(/\/$/, '').toLowerCase())
    .filter(Boolean);
}

const allowedOrigins = parseCorsOrigins(process.env.CORS_ORIGIN);
const defaultAllowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://crm-f9ju.vercel.app'
];
const effectiveAllowedOrigins = allowedOrigins.length > 0 ? allowedOrigins : defaultAllowedOrigins;

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use((req, res, next) => {
  req.requestId = crypto.randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  next();
});

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    const normalized = String(origin).replace(/\/$/, '').toLowerCase();
    if (effectiveAllowedOrigins.includes(normalized)) {
      return callback(null, true);
    }
    return callback(new Error('Origin not allowed by CORS'));
  },
  credentials: true
}));

app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(morgan('dev'));
app.use(apiLimiter);
app.use(mongoSanitize());
app.use(hpp());

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

const uploadRoot = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(process.cwd(), 'uploads');
const customerUploadDir = path.join(uploadRoot, 'customers');
if (!fs.existsSync(uploadRoot)) fs.mkdirSync(uploadRoot);
if (!fs.existsSync(customerUploadDir)) fs.mkdirSync(customerUploadDir, { recursive: true });

app.use('/uploads', express.static(uploadRoot));

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    environment: process.env.NODE_ENV || 'development',
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/deals', dealRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/analytics', analyticsRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
let server;

async function start() {
  try {
    if (process.env.NODE_ENV === 'production' && process.env.DISABLE_AUTH !== 'true') {
      const secret = String(process.env.JWT_SECRET || '');
      if (!secret || secret === 'change_this_in_production' || secret.length < 32) {
        throw new Error('JWT_SECRET must be set to a strong value (>= 32 chars) in production');
      }
    }

    if (process.env.DISABLE_AUTH === 'true') {
      console.log('⚠️ DISABLE_AUTH=true — skipping DB connect and seeding (dev mode)');
    } else {
      await connectDb();
      await seedAdmin();
    }
    server = app.listen(PORT, () => {
      console.log(`CRM Pro backend listening on http://localhost:${PORT}`);
    });
    startAutomationScheduler();
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

function shutdown(signal) {
  console.log(`${signal} received. Starting graceful shutdown...`);
  if (!server) {
    process.exit(0);
    return;
  }

  server.close(() => {
    console.log('HTTP server closed. Exiting process.');
    process.exit(0);
  });

  setTimeout(() => {
    console.error('Forced shutdown after timeout.');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  shutdown('uncaughtException');
});

start();
