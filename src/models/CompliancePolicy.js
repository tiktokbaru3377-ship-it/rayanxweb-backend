const mongoose = require('mongoose');

const compliancePolicySchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  rules: {
    allowCamera: { type: Boolean, default: true },
    allowScreenCapture: { type: Boolean, default: true },
    passwordMinimumLength: { type: Number, default: 4 },
    disallowedApps: [{ type: String }], // Array of package names (e.g., ["com.tiktok.app"])
  },
  isDefault: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('CompliancePolicy', compliancePolicySchema);
