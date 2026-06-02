const { Worker } = require('bullmq');
const config = require('../config');
const logger = require('../utils/logger');
const mongoose = require('mongoose');
const AuditLog = require('../models/AuditLog');

mongoose.connect(config.mongoUri)
  .then(() => logger.info('Workers Database Connected'))
  .catch(err => logger.error(err));

const auditWorker = new Worker('AuditQueue', async (job) => {
  if (job.name === 'logAudit') {
    const { userId, action, targetId, details } = job.data;
    const log = new AuditLog({ userId, action, targetId, details });
    await log.save();
    logger.info(`[Audit Worker] Processed log for action: ${action}`);
  }
}, { connection: { url: config.redisUrl } });

auditWorker.on('failed', (job, err) => {
  logger.error(`Audit Job ${job.id} failed with error: ${err.message}`);
});
