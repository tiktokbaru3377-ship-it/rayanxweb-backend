const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
  deviceId: { type: String, required: true, unique: true, index: true },
  deviceName: { type: String, required: true },
  brand: String,
  model: String,
  androidVersion: String,
  apiLevel: Number,
  batteryStatus: {
    level: Number,
    isCharging: Boolean
  },
  networkInfo: {
    connectionType: String,
    signalStrength: String,
    ipAddress: String
  },
  statusOnline: { type: Boolean, default: false },
  lastSeen: { type: Date, default: Date.now },
  groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'DeviceGroup', default: null },
  isApproved: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Device', deviceSchema);
