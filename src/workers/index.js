const config = require('../config');
const logger = require('../utils/logger');
const mongoose = require('mongoose');

// Koneksi Database untuk Sandbox Worker Thread
mongoose.connect(config.mongoUri)
  .then(() => logger.info('All Independent Background Workers Connected to Cluster Database'))
  .catch(err => logger.error('Worker DB Connection Error:', err));

// Registrasi Seluruh Worker Script
require('./audit.worker'); // Worker audit logs dari bagian 1
require('./cleanup.worker'); // Worker untuk cron-cleanup data terbaru

logger.info('Workers processing threads running successfully.');
