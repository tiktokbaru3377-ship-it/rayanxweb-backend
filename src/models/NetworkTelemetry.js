const mongoose = require('mongoose');

const networkTelemetrySchema = new mongoose.Schema({
  deviceId: { type: String, required: true, index: true },
  connectionType: { type: String, enum: ['WIFI', 'CELLULAR', 'NONE'], required: true },
  signalStrengthDbm: { type: Number, required: true }, // RSSI / RSRP dalam satuan dBm
  linkSpeedMbps: Number,
  carrierName: String, // Contoh: "Telkomsel", "Indosat"
  ipAddress: String,
  latencyMs: Number, // Hasil ping periodik dari device ke core server
  timestamp: { type: Date, default: Date.now, index: true }
}, { timestamps: true });

module.exports = mongoose.model('NetworkTelemetry', networkTelemetrySchema);
