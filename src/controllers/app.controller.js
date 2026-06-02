const AppInventory = require('../models/AppInventory');
const CompliancePolicy = require('../models/CompliancePolicy');
const Device = require('../models/Device');
const { syncQueue } = require('../queues/bull.queue');
const { z } = require('zod');

const syncAppsSchema = z.object({
  deviceId: z.string(),
  apps: z.array(z.object({
    appName: z.string(),
    packageName: z.string(),
    versionName: z.string().optional(),
    versionCode: z.number().optional(),
    isSystemApp: z.boolean().optional(),
  }))
});

exports.syncInstalledApps = async (req, res, next) => {
  try {
    const { deviceId, apps } = syncAppsSchema.parse(req.body);

    // 1. Ambil data perangkat & policy aktif dari grup perangkat tersebut
    const device = await Device.findOne({ deviceId }).populate('groupId');
    let complianceStatus = 'COMPLIANT';
    let violationDetails = [];

    const activePolicy = await CompliancePolicy.findOne({ isDefault: true }); // Fallback ke default policy

    if (activePolicy && activePolicy.rules && activePolicy.rules.disallowedApps) {
      const blacklisted = activePolicy.rules.disallowedApps;
      
      // Deteksi jika ada aplikasi terlarang yang terinstal
      apps.forEach(app => {
        if (blacklisted.includes(app.packageName)) {
          complianceStatus = 'NON_COMPLIANT';
          violationDetails.push(`Blacklisted app detected: ${app.appName} (${app.packageName})`);
        }
      });
    }

    // 2. Simpan atau Update Inventaris Aplikasi di Database
    const inventory = await AppInventory.findOneAndUpdate(
      { deviceId },
      { 
        installedApps: apps,
        complianceStatus,
        violationDetails,
        updatedAt: new Date()
      },
      { upsert: true, new: true }
    );

    // 3. Masukkan ke background worker untuk memicu alert jika terjadi pelanggaran (Non-Compliant)
    if (complianceStatus === 'NON_COMPLIANT') {
      await syncQueue.add('handleComplianceViolation', {
        deviceId,
        violationDetails
      });
    }

    res.status(200).json({ 
      success: true, 
      complianceStatus, 
      message: 'Application inventory synchronized successfully.' 
    });
  } catch (error) {
    next(error);
  }
};
