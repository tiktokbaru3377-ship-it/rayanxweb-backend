const logger = require('../utils/logger');
const Device = require('../models/Device');

module.exports = (io) => {
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error("Authentication error"));
    }
    return next();
  });

  io.on('connection', (socket) => {
    logger.info(`Socket Client Connected: ${socket.id}`);

    socket.on('join_room', (roomId) => {
      socket.join(roomId);
      logger.info(`Socket ${socket.id} joined room: ${roomId}`);
    });

    socket.on('device_heartbeat', async (data) => {
      const { deviceId, batteryLevel, isCharging } = data;
      try {
        await Device.findOneAndUpdate(
          { deviceId },
          { 
            statusOnline: true, 
            lastSeen: new Date(), 
            'batteryStatus.level': batteryLevel, 
            'batteryStatus.isCharging': isCharging 
          }
        );
        io.to(`room_${deviceId}`).emit('device_status_update', { deviceId, statusOnline: true, batteryLevel });
      } catch (err) {
        logger.error(`Error processing heartbeat: ${err.message}`);
      }
    });

    socket.on('disconnect', () => {
      logger.info(`Socket Client Disconnected: ${socket.id}`);
    });
  });
};
