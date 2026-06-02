const mongoose = require('mongoose');

const fileSessionSchema = new mongoose.Schema({
  deviceId: { type: String, required: true, index: true },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  actionType: { type: String, enum: ['UPLOAD', 'DOWNLOAD', 'DELETE'], required: true },
  filePath: { type: String, required: true }, // Target path di internal storage Android
  consentStatus: { type: String, enum: ['PENDING', 'GRANTED', 'DENIED', 'EXPIRED'], default: 'PENDING' },
  downloadUrl: String, // Cloud Storage / Presigned S3 URL jika di-upload dari device
  fileSize: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true }
}, { timestamps: true });

module.exports = mongoose.model('FileSession', fileSessionSchema);
