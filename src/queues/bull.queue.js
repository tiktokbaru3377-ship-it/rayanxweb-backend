const { Queue } = require('bullmq');
const config = require('../config');

const connectionOpts = {
  url: config.redisUrl
};

const notificationQueue = new Queue('NotificationQueue', { connection: connectionOpts });
const syncQueue = new Queue('SyncQueue', { connection: connectionOpts });
const auditQueue = new Queue('AuditQueue', { connection: connectionOpts });

module.exports = { notificationQueue, syncQueue, auditQueue };
