// Penjadwalan otomatis di src/queues/scheduler.js
const { Queue } = require('bullmq');
const config = require('../config');

const cleanupQueue = new Queue('CleanupQueue', { connection: { url: config.redisUrl } });

const initScheduler = async () => {
  // Jalankan fungsi pembersihan setiap jam 12 malam
  await cleanupQueue.add('purgeOldLogs', {}, {
    repeat: { pattern: '0 0 * * *' }
  });

  // Jalankan fungsi pengecekan status offline setiap 1 menit
  await cleanupQueue.add('markOfflineDevices', {}, {
    repeat: { pattern: '*/1 * * * *' }
  });
};

module.exports = { initScheduler };
