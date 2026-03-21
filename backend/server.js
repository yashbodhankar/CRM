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
const notificationRoutes = require('./src/routes/notificationRoutes');
const analyticsRoutes = require('./src/routes/analyticsRoutes');
const { errorHandler, notFound } = require('./src/middleware/errorMiddleware');
const seedAdmin = require('./src/utils/seedAdmin');
const { startAutomationScheduler } = require('./src/utils/automationScheduler');

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

const uploadRoot = path.join(process.cwd(), 'uploads');
const customerUploadDir = path.join(uploadRoot, 'customers');
if (!fs.existsSync(uploadRoot)) fs.mkdirSync(uploadRoot);
if (!fs.existsSync(customerUploadDir)) fs.mkdirSync(customerUploadDir, { recursive: true });

app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/analytics', analyticsRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

async function start() {
  try {
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
