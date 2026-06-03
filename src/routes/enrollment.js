import { Router } from 'express';
import { Device } from '../models/Device.js';
import { adbCommandQueue } from '../queues/mdmQueue.js';

const router = Router();

router.get('/stats', async (req, res) => {
  try {
    const activeCount = await Device.countDocuments({ status: 'Active' });
    const totalCount = await Device.countDocuments();
    res.status(200).json({
      bandwidth: '5.2 Gbps',
      cpuLoad: `${Math.floor(Math.random() * (45 - 15) + 15)}%`,
      storage: '16.4 / 30 TB',
      activeRelays: `${activeCount} / ${totalCount}`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/devices', async (req, res) => {
  try {
    const devices = await Device.find().sort({ enrolledAt: -1 });
    res.status(200).json(devices);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/enrollment/client-app', async (req, res) => {
  try {
    const { deviceId, model, osVersion, status } = req.body;
    const id = deviceId || `MDM-GEN-${Math.floor(1000 + Math.random() * 9000)}`;
    const payload = {
      id,
      name: `${model || 'Generic Client'} (Enrolled)`,
      type: osVersion || 'Android 15.0',
      ip: `192.168.10.${Math.floor(100 + Math.random() * 100)}`,
      load: '1%',
      status: status || 'Active'
    };

    const updatedDevice = await Device.findOneAndUpdate({ id }, payload, { new: true, upsert: true });
    const io = req.app.get('socketio');
    if (io) {
      io.emit('node-status-change', updatedDevice);
      io.emit('adb-terminal-output', `[CLIENT REGISTERED] Device ${id} linked into database core.`);
    }
    res.status(200).json({ success: true, device: updatedDevice });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/enrollment/adb-pair', async (req, res) => {
  try {
    const { ipAddress, port, pairingMethod } = req.body;
    const targetId = `ADB-X18-${Math.floor(100 + Math.random() * 900)}`;
    const payload = {
      id: targetId,
      name: `ADB Node (${pairingMethod || 'OTA'})`,
      type: 'ADB Shell Debug Cluster',
      ip: ipAddress || '192.168.10.199',
      load: '0%',
      status: 'Active'
    };

    const newAdbDevice = await Device.create(payload);
    const io = req.app.get('socketio');
    if (io) {
      io.emit('node-status-change', newAdbDevice);
      io.emit('adb-terminal-output', `[ADB SYSTEM] Firing secure handshake via ${pairingMethod}.`);
    }
    res.status(200).json({ success: true, nodeCreated: targetId });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/enrollment/wizard', async (req, res) => {
  try {
    const { deviceName, serialNumber } = req.body;
    const id = serialNumber || `SN-${Math.floor(100000 + Math.random() * 900000)}`;
    const payload = {
      id,
      name: deviceName || 'Wizard Automation',
      type: 'Android (Wizard)',
      ip: '192.168.10.220',
      load: '0%',
      status: 'Active'
    };

    const wizardDevice = await Device.findOneAndUpdate({ id }, payload, { new: true, upsert: true });
    const io = req.app.get('socketio');
    if (io) {
      io.emit('node-status-change', wizardDevice);
    }
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/adb/execute', async (req, res) => {
  try {
    const { deviceId, command } = req.body;
    await adbCommandQueue.add(`Execute-${deviceId}`, { deviceId, command });
    const io = req.app.get('socketio');
    if (io) {
      io.emit('adb-terminal-output', `[PIPELINE QUEUED] Dispatched command payload to Background Worker Queue.`);
      io.emit('adb-terminal-output', `$ ${deviceId}: ${command}`);
    }
    res.status(200).json({ status: 'Dispatched to BullMQ Worker Pipeline' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
