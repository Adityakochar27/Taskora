/**
 * server.js — TaskFlow API entry point.
 * Wires up Express, security middleware, routers, error handler, and cron jobs.
 */
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');

const connectDB = require('./config/db');
const logger = require('./utils/logger');
const { errorHandler, notFound } = require('./middlewares/errorHandler');
const startCronJobs = require('./services/cronService');

// Routers
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const taskRoutes = require('./routes/taskRoutes');
const teamRoutes = require('./routes/teamRoutes');
const departmentRoutes = require('./routes/departmentRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const whatsappRoutes = require('./routes/whatsappRoutes');

const app = express();

// --- Security & basics ---
app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN?.split(',') || '*',
    credentials: true,
  })
);
app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// Static for uploaded attachments
const uploadDir = process.env.UPLOAD_DIR || './uploads';
app.use('/uploads', express.static(path.resolve(uploadDir)));

// Lightweight global rate limit
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// Health check
app.get('/api/health', (_req, res) =>
  res.json({ status: 'ok', uptime: process.uptime(), ts: Date.now() })
);

// --- Routes ---
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/whatsapp', whatsappRoutes);

// 404 + error handler
app.use(notFound);
app.use(errorHandler);

// --- Boot ---
const PORT = process.env.PORT || 5000;

(async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      logger.info(`API listening on :${PORT} (${process.env.NODE_ENV || 'development'})`);
      startCronJobs(); // deadline reminders etc.
    });
  } catch (err) {
    logger.error('Fatal boot error', err);
    process.exit(1);
  }
})();

module.exports = app;
