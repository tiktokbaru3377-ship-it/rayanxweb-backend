const express = require('express');
const router = express.Router();
const { z } = require('zod');

// Middleware & Controllers
const { authGuard, roleGuard } = require('../middlewares/auth');
const logger = require('../utils/logger');
const deviceController = require('../controllers/device.controller');
const mdmController = require('../controllers/mdm.controller');
const enrollmentController = require('../controllers/enrollment.controller');
const locationController = require('../controllers/location.controller');
const enterpriseController = require('../controllers/enterprise.controller');
const systemController = require('../controllers/system.controller');
const appController = require('../controllers/app.controller');
const fileController = require('../controllers/file.controller');
const networkController = require('../controllers/network.controller');
const analyticsController = require('../controllers/analytics.controller');

/**
 * Zod Validation Middleware: Enterprise Grade
 */
const validate = (schema) => (req, res, next) => {
  try {
    schema.parse({ body: req.body, query: req.query, params: req.params });
    next();
  } catch (error) {
    logger.warn(`[Validation Alert] IP:${req.ip} Path:${req.originalUrl} - ${error.message}`);
    return res.status(422).json({
      success: false,
      message: 'Unprocessable Entity: Schema Validation Failed',
      details: error.errors.map(e => ({ field: e.path.join('.'), issue: e.message }))
    });
  }
};

// ==========================================
// SCHEMAS (Modular & Typed)
// ==========================================
const Schemas = {
  // Device Enrollment
  adbVerify: z.object({
    body: z.object({
      pairingCode: z.string().length(6, 'Kode pairing harus 6 digit'),
      deviceId: z.string().min(3),
      deviceName: z.string().min(2),
    })
  }),
  // MDM Action
  mdmAction: z.object({
    body: z.object({
      deviceId: z.string(),
      actionType: z.enum(['OPEN_URL', 'TEXT_TO_SPEECH', 'DISPLAY_MESSAGE', 'PLAY_AUDIO', 'WIPE']),
      payload: z.any().optional()
    })
  })
};

// ==========================================
// ROUTE REGISTRY (Versioned: /v1)
// ==========================================

// 1. HEALTH & ANALYTICS (Public & Protected)
router.get('/health', systemController.getHealthMetrics);
router.get('/analytics/overview', authGuard, analyticsController.getGlobalDashboardMetrics);

// 2. DEVICE ENROLLMENT & AUTH (Gateway)
router.post('/enrollment/adb/verify', validate(Schemas.adbVerify), enrollmentController.verifyADBCode);
router.post('/enrollment/adb/generate', authGuard, roleGuard(['Admin']), enrollmentController.generateADBCode);

// 3. DEVICE MANAGEMENT (CRUD & Inventory)
router.route('/devices')
  .get(authGuard, deviceController.getDevices)
  .post(authGuard, roleGuard(['Admin', 'Operator']), validate(Schemas.deviceRegister), deviceController.registerDevice);

// 4. MDM CONTROL PLANE (Action Pipeline)
router.post('/mdm/action', authGuard, roleGuard(['Admin', 'Operator']), validate(Schemas.mdmAction), mdmController.executeDeviceAction);

// 5. TELEMETRY & INGESTION (High Frequency)
router.post('/location/ingest', validate(Schemas.locationIngest), locationController.ingestLocation);
router.post('/telemetry/network', validate(Schemas.networkIngest), networkController.ingestNetworkMetrics);
router.post('/apps/sync', validate(Schemas.appSync), appController.syncInstalledApps);

// 6. FILE OPS & CONSENT (Callbacks)
router.post('/files/initiate', authGuard, roleGuard(['Admin']), validate(Schemas.fileInitiate), fileController.initiateFileAction);
router.post('/files/consent-callback', validate(Schemas.fileCallback), fileController.handleDeviceConsentResponse);

// 7. ENTERPRISE COMPLIANCE (Admin Only)
router.post('/enterprise/policy', authGuard, roleGuard(['Admin']), validate(Schemas.enterprisePolicy), enterpriseController.createPolicy);
router.post('/enterprise/remote-wipe', authGuard, roleGuard(['Admin']), validate(Schemas.remoteWipe), enterpriseController.remoteWipe);

module.exports = router;
