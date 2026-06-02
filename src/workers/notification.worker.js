const { Worker } = require('bullmq');
const config = require('../config');
const logger = require('../utils/logger');
const NotificationLog = require('../models/NotificationLog');
const admin = require('../config/firebase');

const notificationWorker = new Worker('NotificationQueue', async (job) => {
  if (job.name === 'sendPushNotification') {
    const { notificationId, title, body, fcmToken } = job.data;

    try {
      const message = {
        notification: { title, body },
        token: fcmToken,
      };

      // Kirim via Firebase Cloud Messaging (FCM)
      const response = await admin.messaging().send(message);
      
      await NotificationLog.findByIdAndUpdate(notificationId, {
        status: 'SENT',
        errorDetails: `FCM_ID: ${response}`
      });

      logger.info(`[Notification Worker] Push sent successfully to token: ${fcmToken}`);
    } catch (error) {
      await NotificationLog.findByIdAndUpdate(notificationId, {
        status: 'FAILED',
        errorDetails: error.message
      });
      logger.error(`[Notification Worker] FCM dispatch failed: ${error.message}`);
    }
  }
}, { connection: { url: config.redisUrl } });

module.exports = notificationWorker;
