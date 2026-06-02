const { createClient } = require('redis');
const logger = require('../utils/logger');
const config = require('./index');

let isRedisConnected = false;

const getRedisClient = () => {
  const client = createClient({
    url: config.redisUrl,
    socket: {
      reconnectStrategy: (retries) => {
        if (retries > 10) {
          logger.error(`[Circuit Breaker Triggered] Redis Connection failed after ${retries} attempts. Activating Offline Standalone Cache Fallback.`);
          isRedisConnected = false;
          return new Error('Redis Node Terminated'); // Hentikan upaya koneksi berkali-kali untuk menghemat CPU
        }
        const delay = Math.min(retries * 500, 5000);
        logger.warn(`Redis connection disconnected. Retrying in ${delay}ms...`);
        return delay;
      }
    }
  });

  client.on('connect', () => {
    isRedisConnected = true;
    logger.info('High-Availability Redis Node Online.');
  });

  client.on('error', (err) => {
    logger.error(`Redis Engine Fault Detected: ${err.message}`);
  });

  return client;
};

module.exports = { getRedisClient, isRedisConnected: () => isRedisConnected };
