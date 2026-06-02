const Device = require('../models/Device');
const { auditQueue } = require('../queues/bull.queue');
const { io } = require('../server');
const { z } = require('zod');

const deviceRegisterSchema = z.object({
  deviceId: z.string().min(5),
  deviceName: z.string(),
  brand: z.string().optional(),
  model: z.string().optional(),
});

exports.registerDevice = async (req, res, next) => {
  try {
    const validatedData = deviceRegisterSchema.parse(req.body);
    let device = await Device.findOne({ deviceId: validatedData.deviceId });

    if (device) {
      device = await Device.findOneAndUpdate({ deviceId: validatedData.deviceId }, validatedData, { new: true });
    } else {
      device = new Device(validatedData);
      await device.save();
    }

    await auditQueue.add('logAudit', {
      userId: req.user._id,
      action: 'DEVICE_REGISTER',
      targetId: device.deviceId,
      details: { deviceName: device.deviceName }
    });

    res.status(200).json({ success: true, data: device });
  } catch (error) {
    next(error);
  }
};

exports.getDevices = async (req, res, next) => {
  try {
    const devices = await Device.find();
    res.status(200).json({ success: true, data: devices });
  } catch (error) {
    next(error);
  }
};
