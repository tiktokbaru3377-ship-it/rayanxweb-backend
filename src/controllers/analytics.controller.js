const Device = require('../models/Device');
const AppInventory = require('../models/AppInventory');

exports.getGlobalDashboardMetrics = async (req, res, next) => {
  try {
    // Pipeline Agregasi Berkecepatan Tinggi menggunakan Mongo Indexes
    const deviceSummary = await Device.aggregate([
      {
        $group: {
          _id: null,
          totalDevices: { $sum: 1 },
          onlineDevices: { $sum: { $cond: [{ $eq: ["$statusOnline", true] }, 1, 0] } },
          approvedDevices: { $sum: { $cond: [{ $eq: ["$isApproved", true] }, 1, 0] } }
        }
      }
    ]);

    const nonCompliantCount = await AppInventory.countDocuments({ complianceStatus: 'NON_COMPLIANT' });

    const stats = deviceSummary[0] || { totalDevices: 0, onlineDevices: 0, approvedDevices: 0 };

    res.status(200).json({
      success: true,
      data: {
        totalDevices: stats.totalDevices,
        onlineDevices: stats.onlineDevices,
        offlineDevices: stats.totalDevices - stats.onlineDevices,
        pendingApproval: stats.totalDevices - stats.approvedDevices,
        nonCompliantDevices: nonCompliantCount,
        healthRatio: stats.totalDevices > 0 ? (stats.onlineDevices / stats.totalDevices) * 100 : 0
      }
    });
  } catch (error) {
    next(error);
  }
};
