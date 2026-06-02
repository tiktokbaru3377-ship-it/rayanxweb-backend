const logger = require('../utils/logger');
const Device = require('../models/Device');
const admin = require('../config/firebase');

module.exports = (io) => {
  
  // Middleware Otentikasi untuk Koneksi Socket
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers['authorization'];
      if (!token) {
        return next(new Error('Authentication failed: Missing token configuration.'));
      }

      const cleanToken = token.startsWith('Bearer ') ? token.split(' ')[1] : token;
      // Verifikasi Firebase ID Token untuk Dashboard atau Android Client
      const decodedToken = await admin.auth().verifyIdToken(cleanToken);
      socket.user = decodedToken;
      
      next();
    } catch (err) {
      logger.error(`Socket Auth Denied: ${err.message}`);
      next(new Error('Authentication failed: Token is invalid.'));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`Secure Socket Client Bound: ${socket.id} (User: ${socket.user.email || 'Android_Agent'})`);

    // Registrasi Perangkat ke Kamar Spesifik (Device Isolation Room)
    socket.on('register_device_session', async ({ deviceId }) => {
      socket.join(`room_${deviceId}`);
      socket.deviceId = deviceId;
      
      // Update status di database menjadi ONLINE secara instan
      await Device.findOneAndUpdate({ deviceId }, { statusOnline: true, lastSeen: new Date() });
      io.emit('dashboard_stats_refresh'); // Memicu update statistik global di dashboard frontend
      logger.info(`Device [${deviceId}] successfully bound to secure channel.`);
    });

    // Sinkronisasi Status Hardware secara Live
    socket.on('telemetry_stream', async (payload) => {
      const { deviceId, battery, network, memoryUsage } = payload;
      
      // Broadcast data ke dashboard yang sedang memantau perangkat ini tanpa membebani database utama setiap detik
      socket.to(`room_${deviceId}`).emit('live_dashboard_render', payload);

      // Gunakan throttling atau update berkala ke DB (misal 1 menit sekali via worker)
    });

    // Menangani Pemutusan Koneksi (Graceful Degradation)
    socket.on('disconnect', async (reason) => {
      logger.warn(`Socket Disconnected: ${socket.id}, Reason: ${reason}`);
      
      if (socket.deviceId) {
        // Jangan langsung set offline jika putus sekejap (Auto-reconnect tolerance)
        setTimeout(async () => {
          const currentSocket = await io.in(`room_${socket.deviceId}`).fetchSockets();
          if (currentSocket.length === 0) {
            await Device.findOneAndUpdate({ deviceId: socket.deviceId }, { statusOnline: false });
            io.emit('dashboard_stats_refresh');
            logger.info(`Device [${socket.deviceId}] marked offline after reconnection timeout.`);
          }
        }, 15000); // Toleransi 15 detik untuk auto-reconnect
      }
    });
  });
};
