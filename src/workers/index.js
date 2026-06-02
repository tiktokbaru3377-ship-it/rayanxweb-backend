const config = require('../config');
const logger = require('../utils/logger');
const mongoose = require('mongoose');

mongoose.connect(config.mongoUri)
  .then(() => logger.info('Database sandbox linked for micro-workers successfully.'))
  .catch(err => logger.error('Worker DB Connection Aborted:', err));

// Memuat semua skrip worker independen
require('./audit.worker');
require('./cleanup.worker');
require('./notification.worker');

logger.info('=== ALL SYSTEM WORKER THREADS ACTIVATED ===');
