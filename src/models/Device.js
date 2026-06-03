import mongoose from 'mongoose';

const DeviceSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  type: { type: String, required: true },
  ip: { type: String, required: true },
  load: { type: String, default: '0%' },
  status: { type: String, enum: ['Active', 'Offline', 'Restricted'], default: 'Active' },
  enrolledAt: { type: Date, default: Date.now }
}, { timestamps: true });

export const Device = mongoose.model('Device', DeviceSchema);
