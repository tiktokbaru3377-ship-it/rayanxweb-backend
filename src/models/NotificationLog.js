const mongoose = require('mongoose');

const notificationLogSchema = new mongoose.Schema({
  title: { type: String, required: true },
  body: { type: String, required: true },
  targetType: { type: String, enum: ['BROADCAST', 'SINGLE_DEVICE'], required: true },
  targetDeviceId: { type: String, default: null },
  status: { type: String, enum: ['PENDING', 'SENT', 'DELIVERED', 'FAILED'], default: 'PENDING' },
  errorDetails: String
}, { timestamps: true });

module.exports = mongoose.model('NotificationLog', notificationLogSchema);
