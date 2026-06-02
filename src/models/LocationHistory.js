const mongoose = require('mongoose');

const locationHistorySchema = new mongoose.Schema({
  deviceId: { type: String, required: true, index: true },
  coordinates: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true } // [longitude, latitude]
  },
  accuracy: Number,
  altitude: Number,
  speed: Number,
  timestamp: { type: Date, default: Date.now }
}, { timestamps: true });

// GeoSpatial Index untuk query berbasis radius wilayah
locationHistorySchema.index({ coordinates: '2dsphere' });

module.exports = mongoose.model('LocationHistory', locationHistorySchema);
