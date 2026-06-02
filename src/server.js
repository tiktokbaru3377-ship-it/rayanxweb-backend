const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const mongoSanitize = require('express-mongo-sanitize');

// Import Komponen Manajemen Internal Engine
const config = require('./config');
const logger = require('./utils/logger');
const apiRouter = require('./routes/api');
const socketHandler = require('./socket/socket.handler');
const { initWatchdog } = require('./utils/watchdog');
const { initScheduler } = require('./queues/scheduler');

// Inisialisasi Instance Aplikasi & HTTP Server Core
const app = express();
const server = http.createServer(app);

// Variabel Global untuk Manajemen Lifecycle Instance
let ioInstance = null;
let pubClient = null;
let subClient = null;

// ==========================================
// 1. SECURITY & DATA SANITIZATION LAYER
// ==========================================

// Proteksi Header HTTP menggunakan Helmet dengan aturan CSP Ketat
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", config.frontendUrl],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"]
    }
  },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: true
}));

// Cross-Origin Resource Sharing (CORS) Configuration
app.use(cors({ 
  origin: config.frontendUrl, 
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']
}));

// Parser Payload JSON dengan Batasan Kapasitas Maksimal (Anti-DoS Buffer Payload)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Anti-NoSQL Injection Middleware (Membersihkan karakter ilegal seperti $ dan .)
app.use(mongoSanitize());

// HTTP Request Rate Limiter (Menggunakan konfigurasi dari berkas .env)
const apiLimiter = rateLimit({
  windowMs: parseInt(process.env.API_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, 
  max: parseInt(process.env.API_RATE_LIMIT_MAX_REQUESTS) || 100,
  standardHeaders: true, // Kembalikan info rate limit di header RateLimit-*
  legacyHeaders: false,  // Matikan header X-RateLimit-*
  message: {
    success: false,
    message: 'Too many requests from this IP address network. Connection throttled.'
  }
});
app.use('/api/', apiLimiter);

// ==========================================
// 2. MIDDLEWARE ROUTING MATRIX
// ==========================================

// Pipa Rute API Utama
app.use('/api', apiRouter);

// Fallback Route untuk Request yang Tidak Terdaftar (404 Handler)
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Resource path [${req.method} ${req.url}] not found.` });
});

// Global Centralized Error Handling Middleware (Production-Safe)
app.use((err, req, res, next) => {
  logger.error(`[Unhandled Exception] System Error Trace: ${err.stack}`);
  
  const response = {
    success: false,
    message: 'Internal Server Error Monitoring System Node Fault.'
  };

  // Hanya tampilkan tumpukan error asli di lingkungan pengembangan (Development)
  if (config.env === 'development') {
    response.debugError = err.message;
  }

  res.status(err.status || 500).json(response);
});

// ==========================================
// 3. LIFECYCLE INITIALIZATION BOOTSTRAP
// ==========================================

const startServer = async () => {
  try {
    // A. Hubungkan ke Database Kluster MongoDB Atlas
    mongoose.set('strictQuery', true);
    await mongoose.connect(config.mongoUri, {
      maxPoolSize: 50, // Optimasi koneksi kolam data untuk konkurensi tinggi
      minPoolSize: 10
    });
    logger.info('Connected to MongoDB Atlas Successfully.');

    // B. Inisialisasi Jaringan Redundan Redis Pub/Sub Adapter
    pubClient = createClient({ 
      url: config.redisUrl,
      socket: { reconnectStrategy: (retries) => Math.min(retries * 100, 3000) }
    });
    subClient = pubClient.duplicate();

    await Promise.all([pubClient.connect(), subClient.connect()]);
    logger.info('Redis Server High-Availability Adapter Connection Established.');

    // C. Inisialisasi Broker Realtime Socket.IO Engine
    ioInstance = new Server(server, {
      cors: { 
        origin: config.frontendUrl, 
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,  // Toleransi 60 detik sebelum memutus koneksi
      pingInterval: 25000  // Kirim heartbeat setiap 25 detik
    });
    
    // Sambungkan Socket ke Kluster Redis Adapter agar horizontal scaling bekerja aman
    ioInstance.adapter(createAdapter(pubClient, subClient));

    // Daftarkan Handler Interseptor Event Socket
    socketHandler(ioInstance);

    // D. Jalankan Watchdog RAM & BullMQ Cron Schedulers
    initWatchdog();
    await initScheduler();
    logger.info('System Micro-Schedulers & Memory Watchdog Engine Activated.');

    // E. Dengarkan Port Produksi
    server.listen(config.port, () => {
      logger.info(`=== RAYANXWEB ENGINE ONLINE ===`);
      logger.info(`Port Listening: ${config.port} | Runtime Mode: ${config.env}`);
    });

  } catch (error) {
    logger.error(`[Critical Core Failure] Initialization Aborted: ${error.message}`);
    process.exit(1);
  }
};

// Eksekusi Pemicu Server Bootstrap
startServer();

// ==========================================
// 4. GRACEFUL SHUTDOWN INTERCEPTOR (ZOMBIE PROCESS PREVENTION)
// ==========================================

const initiateGracefulShutdown = (signal) => {
  logger.warn(`[Shutdown Signal Received] Initiating termination via ${signal}...`);

  // Berikan toleransi waktu maksimal 20 detik bagi proses untuk merapikan koneksi data
  const forceKillTimeout = setTimeout(() => {
    logger.error('Could not close secure connections in time, forcing application kill.');
    process.exit(1);
  }, 20000);

  // 1. Tutup Port HTTP & Socket Listener Baru
  server.close(async () => {
    logger.info('HTTP Server network entry shut down successfully.');

    try {
      // 2. Putus Hubungan Kluster Kriptografi Redis Adapter
      if (ioInstance) {
        ioInstance.close();
        logger.info('Active Realtime WebSockets channels closed.');
      }
      if (pubClient && subClient) {
        await Promise.all([pubClient.disconnect(), subClient.disconnect()]);
        logger.info('Redis Cluster connection safely unlinked.');
      }

      // 3. Putus Pool Driver MongoDB Mongoose
      await mongoose.connection.close();
      logger.info('MongoDB Atlas Database Session smoothly terminated.');

      clearTimeout(forceKillTimeout);
      logger.info('=== GRACEFUL SHUTDOWN SUCCESSFUL [CLEAN EXIT] ===');
      process.exit(0);
    } catch (err) {
      logger.error(`Error encountered during component unlinking: ${err.message}`);
      process.exit(1);
    }
  });
};

// Dengarkan sinyal pembunuhan proses dari Docker Engine / Linux Kernel OS
process.on('SIGTERM', () => initiateGracefulShutdown('SIGTERM'));
process.on('SIGINT', () => initiateGracefulShutdown('SIGINT'));

// Uncaught Exceptions Catching (Sistem Pengaman Terakhir dari Crash Tak Terduga)
process.on('uncaughtException', (err) => {
  logger.error(`[CRITICAL UNCAUGHT EXCEPTION] Object: ${err.message} | Stack: ${err.stack}`);
  // Lakukan shutdown aman jika terjadi kegagalan fatal pada memori
  initiateGracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error(`[UNHANDLED PROMISE REJECTION] Reason Location: ${promise} | Context: ${reason}`);
});

// ==========================================
// 5. SECURE MODULE EXPORTS ARTIFACTS
// ==========================================

// Fungsi getter dinamis untuk menghindari circular dependency pada arsitektur monorepo
module.exports = {
  app,
  server,
  getIO: () => {
    if (!ioInstance) {
      throw new Error("Cannot fetch Socket.IO Instance because the core server initialization has not completed yet.");
    }
    return ioInstance;
  }
};
