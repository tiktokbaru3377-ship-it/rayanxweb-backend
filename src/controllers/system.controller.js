const mongoose = require('mongoose');
const { createClient } = require('redis');
const config = require('../config');

exports.getHealthMetrics = async (req, res) => {
  const health = {
    uptime: process.uptime(),
    message: 'OK',
    timestamp: Date.now(),
    services: {
      database: 'DISCONNECTED',
      redis: 'DISCONNECTED'
    }
  };

  try {
    // 1. Cek Database Mongoose
    if (mongoose.connection.readyState === 1) {
      health.services.database = 'CONNECTED';
    }

    // 2. Cek Redis
    const client = createClient({ url: config.redisUrl });
    await client.connect();
    const ping = await client.ping();
    if (ping === 'PONG') {
      health.services.redis = 'CONNECTED';
    }
    await client.disconnect();

    res.status(200).json(health);
  } catch (error) {
    health.message = error.message;
    res.status(503).json(health);
  }
};
