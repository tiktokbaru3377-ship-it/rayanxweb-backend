const LocationHistory = require('../models/LocationHistory');
const { syncQueue } = require('../queues/bull.queue');

exports.ingestLocation = async (req, res, next) => {
  try {
    const { deviceId, latitude, longitude, accuracy, speed, altitude } = req.body;

    const locationRecord = new LocationHistory({
      deviceId,
      coordinates: {
        type: 'Point',
        coordinates: [longitude, latitude] // MongoDB menggunakan urutan [Lng, Lat]
      },
      accuracy,
      speed,
      altitude
    });

    await locationRecord.save();

    // Lempar ke BullMQ untuk mengecek aturan Geofence secara asinkronus (tidak membebani request API)
    await syncQueue.add('evaluateGeofence', {
      deviceId,
      latitude,
      longitude
    });

    res.status(201).json({ success: true, message: 'Location matrix ingested successfully.' });
  } catch (error) {
    next(error);
  }
};

exports.getDeviceHistory = async (req, res, next) => {
  try {
    const { deviceId, startTime, endTime } = req.query;

    const query = { deviceId };
    if (startTime && endTime) {
      query.timestamp = { $gte: new Date(startTime), $lte: new Date(endTime) };
    }

    const history = await LocationHistory.find(query).sort({ timestamp: -1 }).limit(500);
    res.status(200).json({ success: true, data: history });
  } catch (error) {
    next(error);
  }
};
