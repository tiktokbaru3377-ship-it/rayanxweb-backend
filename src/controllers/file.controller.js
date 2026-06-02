const FileSession = require('../models/FileSession');
const Device = require('../models/Device');
const { io } = require('../server');
const { z } = require('zod');

const initiateFileSchema = z.object({
  deviceId: z.string(),
  actionType: z.enum(['UPLOAD', 'DOWNLOAD', 'DELETE']),
  filePath: z.string()
});

exports.initiateFileAction = async (req, res, next) => {
  try {
    const { deviceId, actionType, filePath } = initiateFileSchema.parse(req.body);

    const device = await Device.findOne({ deviceId });
    if (!device || !device.statusOnline) {
      return res.status(400).json({ success: false, message: 'Device is offline or not found.' });
    }

    // Buat Sesi File dengan status PENDING
    const fileSession = new FileSession({
      deviceId,
      requestedBy: req.user._id,
      actionType,
      filePath,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000) // Valid dalam 5 menit
    });
    await fileSession.save();

    // Kirim pop-up dialog permintaan izin ke Agen Android via Socket.IO
    io.to(`room_${deviceId}`).emit('mdm_file_consent_request', {
      sessionId: fileSession._id,
      actionType,
      filePath,
      requestedBy: req.user.name
    });

    res.status(202).json({ 
      success: true, 
      sessionId: fileSession._id, 
      message: 'Consent request pushed to device. Awaiting user response.' 
    });
  } catch (error) {
    next(error);
  }
};

// Callback Endpoint yang dipanggil oleh Agen Android setelah user menekan 'Allow' atau 'Deny'
exports.handleDeviceConsentResponse = async (req, res, next) => {
  try {
    const { sessionId, status, downloadUrl, fileSize } = req.body;

    const session = await FileSession.findById(sessionId);
    if (!session || session.expiresAt < new Date()) {
      return res.status(400).json({ success: false, message: 'Session expired or not found.' });
    }

    session.consentStatus = status; // 'GRANTED' or 'DENIED'
    if (downloadUrl) session.downloadUrl = downloadUrl;
    if (fileSize) session.fileSize = fileSize;
    await session.save();

    // Beritahu Dashboard Frontend secara realtime bahwa status izin berubah
    io.emit(`dashboard_file_update_${sessionId}`, { 
      status, 
      downloadUrl, 
      fileSize 
    });

    res.status(200).json({ success: true, message: 'Consent state captured successfully.' });
  } catch (error) {
    next(error);
  }
};
