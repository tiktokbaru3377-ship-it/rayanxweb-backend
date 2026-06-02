const { createClient } = require('redis');
const config = require('../config');
const logger = require('../utils/logger');

const redisClient = createClient({ url: config.redisUrl });
redisClient.connect().catch(err => logger.error('Socket Rate Limiter Redis Error', err));

const WINDOW_SIZE_IN_SECONDS = 10;
const MAX_EVENTS_PER_WINDOW = 30; // Maksimal 30 event per 10 detik per device

module.exports = async (socket, packet, next) => {
  const eventName = packet[0];
  const deviceId = socket.deviceId || socket.id;
  const redisKey = `socket_limit:${deviceId}`;

  try {
    const currentRequests = await redisClient.incr(redisKey);

    if (currentRequests === 1) {
      await redisClient.expire(redisKey, WINDOW_SIZE_IN_SECONDS);
    }

    if (currentRequests > MAX_EVENTS_PER_WINDOW) {
      logger.warn(`[Socket Flood Detected] Device/Client ${deviceId} blocked on event: ${eventName}`);
      
      // Kirim balik sinyal error throttling ke client
      socket.emit('exception', {
        status: 429,
        message: 'Too many real-time packets transmitted. Connection throttled.'
      });
      
      return; // Batalkan eksekusi event handler berikutnya (Drop packet)
    }
    
    next();
  } catch (error) {
    logger.error(`Socket Rate Limiter System Failure: ${error.message}`);
    next(); // Fallback passthrough agar sistem tidak crash jika Redis bermasalah
  }
};
