/**
 * RAYANXWEB CORE ENGINE - PRODUCTION ENTERPRISE BUILD
 * File: server.js
 * Description: High-Performance Stateful Backend with Cluster Support & Graceful Lifecycle
 */

const express = require('express');
const http = require('http');
const cluster = require('cluster');
const os = require('os');
const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp'); // Protection against HTTP Parameter Pollution

// Internal Modules
const config = require('./config');
const logger = require('./utils/logger');
const apiRouter = require('./routes/api');
const socketHandler = require('./socket/socket.handler');
const { initWatchdog } = require('./utils/watchdog');
const { initScheduler } = require('./queues/scheduler');

// ==========================================
// 1. CLUSTER MODE INITIALIZATION (SCALING)
// ==========================================
if (cluster.isPrimary && config.env === 'production') {
  const numCPUs = os.cpus().length;
  logger.info(`[Master] Forking RayanXWeb Engine for ${numCPUs} CPUs`);
  
  for (let i = 0; i < numCPUs; i++) cluster.fork();
  
  cluster.on('exit', (worker) => {
    logger.error(`Worker ${worker.process.pid} died. Restarting...`);
    cluster.fork();
  });
} else {
  // ==========================================
  // 2. EXPRESS APP & SECURITY CONFIGURATION
  // ==========================================
  const app = express();
  const server = http.createServer(app);

  let ioInstance = null;
  let pubClient = null;
  let subClient = null;

  app.set('trust proxy', 1); // Diperlukan jika di belakang Nginx/Load Balancer

  app.use(helmet());
  app.use(hpp()); // Prevent HPP attacks
  app.use(cors({ origin: config.frontendUrl, credentials: true }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(mongoSanitize());

  // Healthcheck Route (Kebutuhan wajib untuk Docker/K8s Liveness Probe)
  app.get('/health', (req, res) => res.status(200).json({ status: 'OK', uptime: process.uptime() }));

  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    message: { success: false, message: 'Too many requests. Cooldown required.' }
  });
  app.use('/api/', apiLimiter);

  // ==========================================
  // 3. CORE LOGIC BOOTSTRAP
  // ==========================================
  const startServer = async () => {
    try {
      // Database Connection with Retry Logic
      await mongoose.connect(config.mongoUri, { 
        maxPoolSize: 100, 
        serverSelectionTimeoutMS: 5000 
      });
      logger.info('Connected to MongoDB Cluster.');

      // Redis Setup
      pubClient = createClient({ url: config.redisUrl });
      subClient = pubClient.duplicate();
      await Promise.all([pubClient.connect(), subClient.connect()]);

      // Socket.IO with Redis Adapter
      ioInstance = new Server(server, {
        cors: { origin: config.frontendUrl, methods: ["GET", "POST"] },
        adapter: createAdapter(pubClient, subClient),
        transports: ['websocket'], // Force WebSocket for better performance
        pingTimeout: 60000,
        pingInterval: 25000
      });

      socketHandler(ioInstance);
      app.use('/api', apiRouter);

      // Startup Background Services
      initWatchdog();
      await initScheduler();

      server.listen(config.port, () => {
        logger.info(`=== RAYANXWEB WORKER ONLINE [PID: ${process.pid}] ===`);
      });

    } catch (error) {
      logger.error(`Critical Startup Failure: ${error.message}`);
      process.exit(1);
    }
  };

  startServer();

  // ==========================================
  // 4. GRACEFUL SHUTDOWN LOGIC
  // ==========================================
  const shutdown = async (signal) => {
    logger.warn(`Shutdown signal ${signal} received.`);
    server.close(async () => {
      await mongoose.connection.close();
      if (pubClient) await pubClient.disconnect();
      if (subClient) await subClient.disconnect();
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  module.exports = { app, server, getIO: () => ioInstance };
      }
