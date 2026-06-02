const { Worker } = require('bullmq');
const config = require('../config');
const logger = require('../utils/logger');
const AuditLog = require('../models/AuditLog');
const Device = require('../models/Device');

const cleanupWorker = new Worker('CleanupQueue', async (job) => {
  if (job.name === 'purgeOldLogs') {
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - 30); // Hapus log berumur > 30 hari

    const deleteResult = await AuditLog.deleteMany({ createdAt: { $lt: thresholdDate } });
    logger.info(`[Cleanup Worker] Successfully purged ${deleteResult.deletedCount} old audit logs.`);
  }

  if (job.name === 'markOfflineDevices') {
    const timeoutThreshold = new Date(Date.now() - 5 * 60 * 1000); // 5 menit tidak ada heartbeat
    
    const updateResult = await Device.updateMany(
      { lastSeen: { $lt: timeoutThreshold }, statusOnline: true },
      { $set: { statusOnline: false } }
    );
    logger.info(`[Sync Worker] Marked ${updateResult.modifiedCount} inactive devices as offline.`);
  }
}, { connection: { url: config.redisUrl } });

module.exports = cleanupWorker;
