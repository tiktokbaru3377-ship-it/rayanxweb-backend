/**
 * RAYANXWEB CORE ENGINE - PRODUCTION ENTERPRISE BUILD
 * File: server.js
 * Description: High-Performance Stateful Backend with Cluster Support, 
 * Advanced Error Handling, and Graceful Lifecycle.
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
const hpp = require('hpp');

// Internal Modules
const config = require('./config');
const logger = require('./utils/logger');
const apiRouter = require('./routes/api');
const socketHandler = require('./socket/socket.handler');
const { initWatchdog } = require('./utils/watchdog');
const { initScheduler } = require('./queues/scheduler');

// ==========================================
// 1. CLUSTER MODE INITIALIZATION
// ==========================================
if (cluster.isPrimary && config.env === 'production') {
  const numCPUs = os.cpus().length;
  logger.info(`[Master] Forking RayanXWeb Engine for ${numCPUs} CPUs`);
  for (let i = 0; i < numCPUs; i++) cluster.fork();
  
  cluster.on('exit', (worker, code, signal) => {
    logger.error(`Worker ${worker.process.pid} died (Code: ${code}, Signal: ${signal}). Restarting...`);
    cluster.fork();
  });
} else {
  const app = express();
  const server = http.createServer(app);

  let ioInstance = null;
  let pubClient = null;
  let subClient = null;

  // Security Hardening
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(hpp());
  app.use(cors({ origin: config.frontendUrl, credentials: true }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(mongoSanitize());

  // Healthcheck & Rate Limiting
  app.get('/health', (req, res) => res.status(200).json({ status: 'OK', pid: process.pid }));
  app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 500 }));

  // ==========================================
  // 2. CORE LOGIC BOOTSTRAP
  // ==========================================
  const startServer = async () => {
    try {
      // 1. MongoDB Connection
      mongoose.connection.on('error', (err) => logger.error(`MongoDB Error: ${err}`));
      await mongoose.connect(config.mongoUri, { maxPoolSize: 100, serverSelectionTimeoutMS: 5000 });
      logger.info('Connected to MongoDB Cluster.');

      // 2. Redis Connection (Added Error Listeners for Production Stability)
      pubClient = createClient({ url: config.redisUrl });
      subClient = pubClient.duplicate();
      
      pubClient.on('error', (err) => logger.error('Redis PubClient Error:', err));
      subClient.on('error', (err) => logger.error('Redis SubClient Error:', err));
      
      await Promise.all([pubClient.connect(), subClient.connect()]);
      logger.info('Redis Cluster Adapter Initialized.');

      // 3. Socket.IO Setup
      ioInstance = new Server(server, {
        cors: { origin: config.frontendUrl, methods: ["GET", "POST"] },
        adapter: createAdapter(pubClient, subClient),
        transports: ['websocket'],
        pingTimeout: 60000,
        pingInterval: 25000
      });

      // 4. Register Handlers & Middlewares
      socketHandler(ioInstance);
      app.use('/api', apiRouter);

      // 5. Initialize Background Services
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

  // ==========================================
  // 3. GRACEFUL SHUTDOWN & CLEANUP
  // ==========================================
  const shutdown = async (signal) => {
    logger.warn(`Shutdown signal ${signal} received.`);
    
    // Stop accepting new connections
    server.close(async () => {
      try {
        if (ioInstance) ioInstance.close();
        await mongoose.connection.close();
        if (pubClient) await pubClient.disconnect();
        if (subClient) await subClient.disconnect();
        logger.info('Cleanup complete. Exiting process.');
        process.exit(0);
      } catch (err) {
        logger.error('Error during shutdown:', err);
        process.exit(1);
      }
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Trigger Startup
  startServer();

  // Export for testing or external monitoring
  module.exports = { app, server, getIO: () => ioInstance };
  }
