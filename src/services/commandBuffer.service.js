const { createClient } = require('redis');
const config = require('../config');
const logger = require('../utils/logger');

const redisClient = createClient({ url: config.redisUrl });
redisClient.connect().catch(err => logger.error('Redis Buffer Connection Error', err));

// Menyimpan perintah MDM jika perangkat offline saat eksekusi
exports.bufferOfflineCommand = async (deviceId, commandPayload) => {
  const key = `offline_cmds:${deviceId}`;
  // Simpan ke Redis List dengan masa berlaku 24 jam
  await redisClient.rPush(key, JSON.stringify(commandPayload));
  await redisClient.expire(key, 86400);
  logger.info(`Command buffered for offline device: ${deviceId}`);
};

// Mengirimkan seluruh antrean perintah yang tertunda ketika perangkat online kembali
exports.flushBufferedCommands = async (deviceId, socketInstance) => {
  const key = `offline_cmds:${deviceId}`;
  let command = await redisClient.lPop(key);
  
  while (command) {
    const payload = JSON.parse(command);
    socketInstance.emit('mdm_command', payload);
    logger.info(`Flushed buffered command to reconnected device ${deviceId}`);
    command = await redisClient.lPop(key);
  }
};
