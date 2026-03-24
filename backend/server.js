const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

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
const aiRoutes = require('./src/routes/aiRoutes');
const notificationRoutes = require('./src/routes/notificationRoutes');
const analyticsRoutes = require('./src/routes/analyticsRoutes');
const { errorHandler, notFound } = require('./src/middleware/errorMiddleware');
const seedAdmin = require('./src/utils/seedAdmin');
const { startAutomationScheduler } = require('./src/utils/automationScheduler');

const app = express();
app.get("/", (req, res) => {
  res.send("CRM Backend is Running 🚀");
});

function parseCorsOrigins(raw) {
  return String(raw || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

const allowedOrigins = parseCorsOrigins(process.env.CORS_ORIGIN);
app.use(cors({
  origin(origin, callback) {
    // Allow server-to-server requests and local tools without Origin header.
    if (!origin) return callback(null, true);
    if (allowedOrigins.length === 0) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('CORS policy: Origin not allowed'));
  }
}));
app.use(express.json());
app.use(morgan('dev'));

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
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/deals', dealRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/analytics', analyticsRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

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
    app.listen(PORT, () => {
      console.log(`CRM Pro backend listening on http://localhost:${PORT}`);
    });
    startAutomationScheduler();
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
