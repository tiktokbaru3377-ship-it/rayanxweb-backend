const Device = require('../models/Device');
const CompliancePolicy = require('../models/CompliancePolicy');
const { auditQueue } = require('../queues/bull.queue');
const { io } = require('../server');
const { z } = require('zod');

const policySchema = z.object({
  name: z.string(),
  rules: z.object({
    allowCamera: z.boolean(),
    allowScreenCapture: z.boolean(),
    passwordMinimumLength: z.number().min(0),
    disallowedApps: z.array(z.string())
  })
});

exports.createPolicy = async (req, res, next) => {
  try {
    const validatedData = policySchema.parse(req.body);
    const policy = new CompliancePolicy(validatedData);
    await policy.save();

    res.status(201).json({ success: true, data: policy });
  } catch (error) {
    next(error);
  }
};

exports.enforceDevicePolicy = async (req, res, next) => {
  try {
    const { deviceId, policyId } = req.body;

    const [device, policy] = await Promise.all([
      Device.findOne({ deviceId }),
      CompliancePolicy.findById(policyId)
    ]);

    if (!device) return res.status(404).json({ success: false, message: 'Device not found' });
    if (!policy) return res.status(404).json({ success: false, message: 'Policy not found' });

    // Kirim kebijakan via Socket.IO ke agen Android Enterprise
    io.to(`room_${deviceId}`).emit('mdm_policy_enforce', {
      policy: policy.rules,
      enforcedAt: new Date()
    });

    await auditQueue.add('logAudit', {
      userId: req.user._id,
      action: 'ENTERPRISE_POLICY_ENFORCE',
      targetId: deviceId,
      details: { policyId, policyName: policy.name }
    });

    res.status(200).json({ success: true, message: `Policy ${policy.name} dispatched to device.` });
  } catch (error) {
    next(error);
  }
};

exports.remoteWipe = async (req, res, next) => {
  try {
    const { deviceId, confirmWipe } = req.body;

    if (!confirmWipe) {
      return res.status(400).json({ success: false, message: 'Confirmation required for factory reset.' });
    }

    io.to(`room_${deviceId}`).emit('mdm_enterprise_wipe', {
      wipeType: 'FACTORY_RESET',
      requestedBy: req.user.email
    });

    await auditQueue.add('logAudit', {
      userId: req.user._id,
      action: 'ENTERPRISE_FACTORY_RESET_REQUEST',
      targetId: deviceId,
      details: { securityLevel: 'CRITICAL' }
    });

    res.status(200).json({ success: true, message: 'Factory reset command sent. Device will wipe upon connectivity.' });
  } catch (error) {
    next(error);
  }
};
