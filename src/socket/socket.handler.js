const logger = require('../utils/logger');
const Device = require('../models/Device');
const admin = require('../config/firebase');
const socketRateLimiter = require('../middlewares/socketRateLimiter');
const { flushBufferedCommands } = require('../services/commandBuffer.service');

module.exports = (io) => {
  
  // ==========================================
  // 1. SECURE AUTHENTICATION INTERCEPTOR
  // ==========================================
  io.use(async (socket, next) => {
    try {
      // Ekstrak token dari jabat tangan autentikasi (Handshake Auth / Header fallback)
      const token = socket.handshake.auth?.token || socket.handshake.headers['authorization'];
      
      if (!token) {
        logger.error(`[Socket Auth Refused] Missing token signature from IP: ${socket.conn.remoteAddress}`);
        return next(new Error('Authentication failed: Secure token payload is missing.'));
      }

      // Bersihkan format Bearer prefix jika dikirim dari web dashboard
      const cleanToken = token.startsWith('Bearer ') ? token.split(' ')[1] : token;
      
      // Verifikasi token kriptografi menggunakan Firebase Admin SDK Core
      const decodedToken = await admin.auth().verifyIdToken(cleanToken);
      
      // Sematkan data user/device hasil dekripsi ke dalam instance socket session
      socket.user = decodedToken;
      
      logger.info(`[Socket Authenticated] Connection allowed for: ${decodedToken.email || 'Android_Agent_Node'}`);
      next();
    } catch (err) {
      logger.error(`[Socket Auth Cryptography Error] Token validation rejected: ${err.message}`);
      return next(new Error('Authentication failed: Transmitted token signature is invalid or expired.'));
    }
  });

  // ==========================================
  // 2. CONNECTION LIFECYCLE ROUTING MATRIX
  // ==========================================
  io.on('connection', (socket) => {
    logger.info(`[Socket Connected] New persistent pipe established. ID: ${socket.id}`);

    // Pasang Traffic Rate Limiter untuk menangani mitigasi serangan packet flooding/DDoS
    socket.use((packet, next) => {
      socketRateLimiter(socket, packet, next);
    });

    // ==========================================
    // A. DEVICE REGISTRATION & SESSION BINDING
    // ==========================================
    socket.on('register_device_session', async (payload, callback) => {
      try {
        const { deviceId } = payload;
        
        if (!deviceId) {
          if (callback) callback({ success: false, message: 'Device ID parameters are required.' });
          return;
        }

        // Ikat socket ke dalam kamar khusus berbasis Device ID (Device Isolation Room)
        socket.join(`room_${deviceId}`);
        socket.deviceId = deviceId;
        socket.isAndroidAgent = true;

        // Ubah bendera status jaringan di database MongoDB menjadi ONLINE secara instan
        const updatedDevice = await Device.findOneAndUpdate(
          { deviceId },
          { 
            statusOnline: true, 
            lastSeen: new Date(),
            socketId: socket.id
          },
          { new: true }
        );

        if (!updatedDevice) {
          logger.warn(`[Socket Registration Warning] Agent connected with unregistered Device ID: ${deviceId}`);
        } else {
          logger.info(`[Device Engine Sync] Device [${deviceId}] successfully linked to room_${deviceId}.`);
        }

        // Tarik dan eksekusi semua perintah tertunda (offline buffer commands) yang sempat tersimpan di Redis
        await flushBufferedCommands(deviceId, socket);

        // Pemicu siaran langsung (Live Broadcast) agar Dashboard Frontend melakukan re-render KPI komponen global
        io.emit('dashboard_stats_refresh', { triggeredBy: deviceId, event: 'ONLINE' });

        if (callback) callback({ success: true, message: 'Session registration completed. Buffer flushed.' });

      } catch (error) {
        logger.error(`[Device Registration Runtime Error] Fail: ${error.message}`);
        if (callback) callback({ success: false, error: error.message });
      }
    });

    // ==========================================
    // B. REALTIME HARDWARE TELEMETRY STREAMING
    // ==========================================
    socket.on('telemetry_stream', async (payload) => {
      try {
        const { deviceId, batteryLevel, isCharging, memoryUsage, cpuLoad, storageAvailableBytes } = payload;
        
        if (!deviceId || !socket.deviceId) return;

        const telemetryData = {
          deviceId,
          battery: { level: batteryLevel, charging: isCharging },
          metrics: { RAM: memoryUsage, CPU: cpuLoad, Storage: storageAvailableBytes },
          timestamp: new Date()
        };

        // Pancarkan langsung data metrik ke dashboard room pemantau tanpa membebani I/O database utama
        socket.to(`room_${deviceId}`).emit('live_dashboard_render', telemetryData);

        // Lakukan pembaruan berkala (Throttled Update) ke skema Device DB untuk parameter esensial
        if (Math.random() < 0.1) { // Lakukan sampling 10% dari total transmisi masuk untuk optimasi I/O
          await Device.updateOne(
            { deviceId },
            { 
              $set: { 
                batteryLevel, 
                lastSeen: new Date() 
              } 
            }
          );
        }

      } catch (error) {
        logger.error(`[Telemetry Ingestion Failure] Data frame dropped: ${error.message}`);
      }
    });

    // ==========================================
    // C. FRONTEND MONITORING HUB JOIN HANDSHAKE
    // ==========================================
    socket.on('join_dashboard_monitor', (payload, callback) => {
      const { targetDeviceId } = payload;
      
      if (!targetDeviceId) {
        if (callback) callback({ success: false, message: 'Target Device ID is missing.' });
        return;
      }

      // Hubungkan Admin/Operator dashboard ke kamar monitor perangkat target
      socket.join(`room_${targetDeviceId}`);
      logger.info(`[Dashboard Viewer Bound] Session ${socket.id} is now tracking Device [${targetDeviceId}]`);

      if (callback) callback({ success: true, message: `Subscribed to real-time events of device ${targetDeviceId}` });
    });

    // ==========================================
    // D. GLOBAL ERROR CATCHER EXCEPTION
    // ==========================================
    socket.on('error', (err) => {
      logger.error(`[Socket Channel Internal Error] Core ID: ${socket.id} | Track: ${err.message}`);
    });

    // ==========================================
    // E. DISCONNECT & AUTONOMOUS RECOVERY POLICY
    // ==========================================
    socket.on('disconnect', async (reason) => {
      logger.warn(`[Socket Pipe Severed] Connection ID: ${socket.id} lost. Reason: ${reason}`);

      const boundDeviceId = socket.deviceId;

      if (boundDeviceId && socket.isAndroidAgent) {
        // MEKANISME AUTOMATIC RECOVERY TOLERANCE
        // Jangan langsung mengubah status menjadi offline untuk menghindari fluktuasi sinyal internet seluler (reconnection storm)
        setTimeout(async () => {
          try {
            // Ambil total sisa koneksi aktif yang berada di dalam kamar perangkat tersebut
            const activeSocketsInRoom = await io.in(`room_${boundDeviceId}`).fetchSockets();
            
            // Jika kamar benar-benar kosong, konfirmasikan status perangkat sebagai OFFLINE
            if (activeSocketsInRoom.length === 0) {
              await Device.findOneAndUpdate(
                { deviceId: boundDeviceId },
                { statusOnline: false }
              );
              
              // Perbarui visualisasi statistik total armada dashboard secara global
              io.emit('dashboard_stats_refresh', { triggeredBy: boundDeviceId, event: 'OFFLINE' });
              logger.info(`[Device Lifecycle Offline] Device [${boundDeviceId}] confirmed offline after graceful grace period.`);
            } else {
              logger.info(`[Device Reconnection Saved] Device [${boundDeviceId}] re-established a tunnel session prior to timeout.`);
            }
          } catch (err) {
            logger.error(`[Graceful Recovery Failure] Execution failed: ${err.message}`);
          }
        }, 15000); // Batas toleransi pemutusan koneksi sekejap adalah 15 detik
      }
    });
  });
};
