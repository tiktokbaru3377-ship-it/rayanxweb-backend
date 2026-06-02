const mongoose = require('mongoose');

const deviceEnrollmentSchema = new mongoose.Schema({
  pairingCode: { type: String, required: true, unique: true },
  status: { type: String, enum: ['PENDING', 'APPROVED', 'EXPIRED'], default: 'PENDING' },
  generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  expiresAt: { type: Date, required: true },
  enrolledDeviceId: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('DeviceEnrollment', deviceEnrollmentSchema);
