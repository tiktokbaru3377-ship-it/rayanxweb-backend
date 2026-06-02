const DeviceEnrollment = require('../models/DeviceEnrollment');
const Device = require('../models/Device');
const crypto = require('crypto');

// Generate OTP / Pairing Code untuk ADB Dashboard
exports.generateADBCode = async (req, res, next) => {
  try {
    const code = crypto.randomInt(100000, 999999).toString(); // 6 Digit Pairing Code
    
    const enrollment = new DeviceEnrollment({
      pairingCode: code,
      generatedBy: req.user._id,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000) // Berlaku 10 menit
    });

    await enrollment.save();

    res.status(201).json({ 
      success: true, 
      data: { 
        pairingCode: code,
        expiresInSeconds: 600,
        qrPayload: `rayanxweb://enroll/adb?code=${code}`
      } 
    });
  } catch (error) {
    next(error);
  }
};

// Verifikasi dari Device Agent saat melakukan pairing ADB via Wireless Debugging
exports.verifyADBCode = async (req, res, next) => {
  try {
    const { pairingCode, deviceId, deviceName, brand, model } = req.body;

    const enrollment = await DeviceEnrollment.findOne({ pairingCode, status: 'PENDING' });

    if (!enrollment || enrollment.expiresAt < new Date()) {
      return res.status(400).json({ success: false, message: 'Invalid or expired pairing code.' });
    }

    // Buat perangkat baru atau perbarui status menjadi menunggu approval admin
    let device = await Device.findOne({ deviceId });
    if (!device) {
      device = new Device({
        deviceId,
        deviceName,
        brand,
        model,
        isApproved: false // Membutuhkan approval manual oleh Admin di Dashboard
      });
      await device.save();
    }

    enrollment.status = 'APPROVED';
    enrollment.enrolledDeviceId = deviceId;
    await enrollment.save();

    res.status(200).json({ 
      success: true, 
      message: 'Pairing successful. Waiting for Administrator approval on dashboard.' 
    });
  } catch (error) {
    next(error);
  }
};
