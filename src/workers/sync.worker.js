const { Worker } = require('bullmq');
const config = require('../config');
const logger = require('../utils/logger');
const Device = require('../models/Device');
const NotificationLog = require('../models/NotificationLog');
const { io } = require('../server');

const syncWorker = new Worker('SyncQueue', async (job) => {
  if (job.name === 'handleComplianceViolation') {
    const { deviceId, violationDetails } = job.data;
    
    logger.warn(`[Compliance Alert] Device ${deviceId} violated corporate policy!`);

    // 1. Kirim perintah lock otomatis via Socket jika masuk kategori kritis
    io.to(`room_${deviceId}`).emit('mdm_command', {
      action: 'DISPLAY_MESSAGE',
      payload: { message: "PERANGKAT DI-KUNCI. Terdeteksi aplikasi ilegal sesuai kebijakan perusahaan!" }
    });

    // 2. Buat Log Notifikasi Sistem
    const notification = new NotificationLog({
      title: "Pelanggaran Keamanan Perangkat",
      body: `Perangkat ${deviceId} terdeteksi menggunakan aplikasi non-compliant.`,
      targetType: 'SINGLE_DEVICE',
      targetDeviceId: deviceId,
      status: 'SENT'
    });
    await notification.save();
  }
}, { connection: { url: config.redisUrl } });

module.exports = syncWorker;
