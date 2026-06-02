const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');

const config = require('./config');
const logger = require('./utils/logger');
const apiRouter = require('./routes/api');
const socketHandler = require('./socket/socket.handler');

const app = express();
const server = http.createServer(app);

// Security Middlewares
app.use(helmet());
app.use(cors({ origin: config.frontendUrl, credentials: true }));
app.use(express.json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 100,
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// API Routes
app.use('/api', apiRouter);

// Global Error Handler
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(500).json({ success: false, message: 'Internal Server Error' });
});

// Database and Live Engine Initialization
mongoose.connect(config.mongoUri)
  .then(async () => {
    logger.info('Connected to MongoDB Atlas Successfully.');

    const pubClient = createClient({ url: config.redisUrl });
    const subClient = pubClient.duplicate();

    await Promise.all([pubClient.connect(), subClient.connect()]);
    logger.info('Redis Server Connection Established.');

    const io = new Server(server, {
      cors: { origin: config.frontendUrl, methods: ["GET", "POST"] }
    });
    io.adapter(createAdapter(pubClient, subClient));

    socketHandler(io);
    module.exports.io = io;

    server.listen(config.port, () => {
      logger.info(`Server Production-Ready on Port ${config.port} [ENV: ${config.env}]`);
    });
  })
  .catch((err) => {
    logger.error('Database connection failed:', err);
    process.exit(1);
  });
