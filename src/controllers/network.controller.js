const NetworkTelemetry = require('../models/NetworkTelemetry');

exports.ingestNetworkMetrics = async (req, res, next) => {
  try {
    const { deviceId, connectionType, signalStrengthDbm, linkSpeedMbps, carrierName, ipAddress, latencyMs } = req.body;

    const telemetry = new NetworkTelemetry({
      deviceId,
      connectionType,
      signalStrengthDbm,
      linkSpeedMbps,
      carrierName,
      ipAddress,
      latencyMs
    });
    await telemetry.save();

    // Trigger alert otomatis via Socket jika kualitas sinyal drop parah (< -110 dBm pada seluler)
    if (connectionType === 'CELLULAR' && signalStrengthDbm < -110) {
      const { io } = require('../server');
      io.emit('dashboard_network_alert', {
        deviceId,
        message: `Critical signal drop detected: ${signalStrengthDbm} dBm`
      });
    }

    res.status(201).json({ success: true });
  } catch (error) {
    next(error);
  }
};
