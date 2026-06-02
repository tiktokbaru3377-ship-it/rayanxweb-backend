const mongoose = require('mongoose');

const appInventorySchema = new mongoose.Schema({
  deviceId: { type: String, required: true, index: true },
  installedApps: [{
    appName: { type: String, required: true },
    packageName: { type: String, required: true }, // e.g., "com.whatsapp"
    versionName: String,
    versionCode: Number,
    isSystemApp: { type: Boolean, default: false },
    installedAt: Date
  }],
  complianceStatus: { 
    type: String, 
    enum: ['COMPLIANT', 'NON_COMPLIANT'], 
    default: 'COMPLIANT' 
  },
  violationDetails: [{ type: String }] // List nama package yang melanggar aturan
}, { timestamps: true });

module.exports = mongoose.model('AppInventory', appInventorySchema);
