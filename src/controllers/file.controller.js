// src/controllers/file.controller.js
const { auditQueue } = require('../queues/bull.queue');
const { io } = require('../server');

exports.requestFileList = async (req, res, next) => {
  try {
    const { deviceId, path } = req.query;

    // Kirim request ke perangkat untuk membaca struktur folder (Memerlukan izin di sisi Android)
    io.to(`room_${deviceId}`).emit('mdm_file_request', {
      command: 'LIST_FILES',
      targetPath: path || '/'
    });

    await auditQueue.add('logAudit', {
      userId: req.user._id,
      action: 'FILE_BROWSE_REQUEST',
      targetId: deviceId,
      details: { path }
    });

    res.status(202).json({ success: true, message: 'File list request dispatched to device agent.' });
  } catch (error) {
    next(error);
  }
};
