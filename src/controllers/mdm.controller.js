const Device = require('../models/Device');
const { auditQueue } = require('../queues/bull.queue');
const { io } = require('../server');
const { z } = require('zod');

// Validasi untuk aksi MDM
const actionSchema = z.object({
  deviceId: z.string(),
  actionType: z.enum([
    'OPEN_URL', 'TEXT_TO_SPEECH', 'DISPLAY_MESSAGE', 
    'PLAY_AUDIO', 'UPDATE_WALLPAPER', 'FLASHLIGHT_TOGGLE', 'VIBRATE'
  ]),
  payload: z.any().optional()
});

exports.executeDeviceAction = async (req, res, next) => {
  try {
    const { deviceId, actionType, payload } = actionSchema.parse(req.body);

    // 1. Cek apakah perangkat terdaftar dan online
    const device = await Device.findOne({ deviceId });
    if (!device) {
      return res.status(404).json({ success: false, message: 'Device not found' });
    }
    if (!device.statusOnline) {
      return res.status(400).json({ success: false, message: 'Device is offline. Action cannot be delivered.' });
    }

    // 2. Kirim instruksi realtime ke perangkat via Socket.IO Room
    // Perangkat Android harus join ke room berbasis deviceId saat terhubung
    io.to(`room_${deviceId}`).emit('mdm_command', {
      action: actionType,
      payload: payload,
      timestamp: new Date(),
      requestedBy: req.user.name
    });

    // 3. Masukkan ke dalam antrean Audit Log (Async via BullMQ)
    await auditQueue.add('logAudit', {
      userId: req.user._id,
      action: `MDM_${actionType}`,
      targetId: deviceId,
      details: { payload, executionStatus: 'SENT_TO_DEVICE' }
    });

    res.status(200).json({ 
      success: true, 
      message: `Command ${actionType} successfully broadcasted to device ${deviceId}` 
    });
  } catch (error) {
    next(error);
  }
};
