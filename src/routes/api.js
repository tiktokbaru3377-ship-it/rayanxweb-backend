const express = require('express');
const router = express.Router();
const { z } = require('zod');

// ==========================================
// 1. MIDDLEWARE SYSTEM INTEGRATION
// ==========================================
const { authGuard, roleGuard } = require('../middlewares/auth');
const logger = require('../utils/logger');

/**
 * Generic Request Validation Middleware (Zod Schema Interceptor)
 * Memvalidasi request body, query, atau params sebelum menyentuh layer controller.
 */
const validateRequest = (schema) => (req, res, next) => {
  try {
    schema.parse({
      body: req.body,
      query: req.query,
      params: req.params,
    });
    next();
  } catch (error) {
    logger.warn(`[Validation Failed] Path: ${req.originalUrl} - Error: ${JSON.stringify(error.errors)}`);
    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      errors: error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }))
    });
  }
};

// ==========================================
// 2. CONTROLLER REF REGISTRY
// ==========================================
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

// ==========================================
// 3. CRYPTOGRAPHIC & VALIDATION SCHEMAS (ZOD)
// ==========================================
const Schemas = {
  deviceRegister: z.object({
    body: z.object({
      deviceId: z.string().min(5, 'Device ID minimal 5 karakter'),
      deviceName: z.string().min(2, 'Device Name wajib diisi'),
      brand: z.string().optional(),
      model: z.string().optional(),
      androidVersion: z.string().optional(),
      apiLevel: z.number().optional(),
    })
  }),
  
  mdmAction: z.object({
    body: z.object({
      deviceId: z.string(),
      actionType: z.enum([
        'OPEN_URL', 'TEXT_TO_SPEECH', 'DISPLAY_MESSAGE', 
        'PLAY_AUDIO', 'UPDATE_WALLPAPER', 'FLASHLIGHT_TOGGLE', 'VIBRATE'
      ]),
      payload: z.any().optional()
    })
  }),

  locationIngest: z.object({
    body: z.object({
      deviceId: z.string(),
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      accuracy: z.number().optional(),
      speed: z.number().optional(),
      altitude: z.number().optional()
    })
  }),

  locationHistory: z.object({
    query: z.object({
      deviceId: z.string(),
      startTime: z.string().datetime().optional(),
      endTime: z.string().datetime().optional()
    })
  }),

  enterprisePolicy: z.object({
    body: z.object({
      name: z.string().min(3),
      rules: z.object({
        allowCamera: z.boolean(),
        allowScreenCapture: z.boolean(),
        passwordMinimumLength: z.number().nonnegative(),
        disallowedApps: z.array(z.string())
      })
    })
  }),

  policyEnforce: z.object({
    body: z.object({
      deviceId: z.string(),
      policyId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Format Object ID MongoDB tidak valid')
    })
  }),

  remoteWipe: z.object({
    body: z.object({
      deviceId: z.string(),
      confirmWipe: z.literal(true, { errorMap: () => ({ message: 'Konfirmasi wipe wajib bernilai true' }) })
    })
  }),

  adbVerify: z.object({
    body: z.object({
      pairingCode: z.string().length(6, 'Kode pairing wajib 6 digit'),
      deviceId: z.string(),
      deviceName: z.string(),
      brand: z.string().optional(),
      model: z.string().optional()
    })
  }),

  appSync: z.object({
    body: z.object({
      deviceId: z.string(),
      apps: z.array(z.object({
        appName: z.string(),
        packageName: z.string(),
        versionName: z.string().optional(),
        versionCode: z.number().optional(),
        isSystemApp: z.boolean().optional()
      }))
    })
  }),

  fileInitiate: z.object({
    body: z.object({
      deviceId: z.string(),
      actionType: z.enum(['UPLOAD', 'DOWNLOAD', 'DELETE']),
      filePath: z.string()
    })
  }),

  fileCallback: z.object({
    body: z.object({
      sessionId: z.string().regex(/^[0-9a-fA-F]{24}$/),
      status: z.enum(['GRANTED', 'DENIED', 'EXPIRED']),
      downloadUrl: z.string().url().optional(),
      fileSize: z.number().optional()
    })
  }),

  networkIngest: z.object({
    body: z.object({
      deviceId: z.string(),
      connectionType: z.enum(['WIFI', 'CELLULAR', 'NONE']),
      signalStrengthDbm: z.number(),
      linkSpeedMbps: z.number().optional(),
      carrierName: z.string().optional(),
      ipAddress: z.string().ip().optional(),
      latencyMs: z.number().optional()
    })
  })
};

// ==========================================
// 4. ROUTE DEFINITIONS & SECURITY PIPELINE
// ==========================================

// --- SYSTEM TELEMETRY & HEALTH ---
router.get('/health', systemController.getHealthMetrics);
router.get('/analytics/overview', authGuard, analyticsController.getGlobalDashboardMetrics);

// --- DEVICE AUDIT & MANAGEMENT ---
router.post(
  '/devices', 
  authGuard, 
  roleGuard(['Admin', 'Operator']), 
  validateRequest(Schemas.deviceRegister), 
  deviceController.registerDevice
);

router.get(
  '/devices', 
  authGuard, 
  deviceController.getDevices
);

// --- MDM COMMAND CORE (CONSENT-BASED) ---
router.post(
  '/mdm/action', 
  authGuard, 
  roleGuard(['Admin', 'Operator']), 
  validateRequest(Schemas.mdmAction), 
  mdmController.executeDeviceAction
);

// --- FILE MANAGEMENT LAYER (CONSENT-BASED) ---
router.post(
  '/files/initiate', 
  authGuard, 
  roleGuard(['Admin', 'Operator']), 
  validateRequest(Schemas.fileInitiate), 
  fileController.initiateFileAction
);

router.post(
  '/files/consent-callback', 
  validateRequest(Schemas.fileCallback), 
  fileController.handleDeviceConsentResponse
);

// --- APPLICATION INVENTORY MANAGEMENT ---
router.post(
  '/apps/sync', 
  validateRequest(Schemas.appSync), 
  appController.syncInstalledApps
);

// --- GEOLOCATION TELEMETRY ---
router.post(
  '/location/ingest', 
  validateRequest(Schemas.locationIngest), 
  locationController.ingestLocation
);

router.get(
  '/location/history', 
  authGuard, 
  validateRequest(Schemas.locationHistory), 
  locationController.getDeviceHistory
);

// --- NETWORK DIAGNOSTICS TELEMETRY ---
router.post(
  '/telemetry/network', 
  validateRequest(Schemas.networkIngest), 
  networkController.ingestNetworkMetrics
);

// --- ENTERPRISE PROFILE & COMPLIANCE MANAGEMENT ---
router.post(
  '/enterprise/policy', 
  authGuard, 
  roleGuard(['Admin']), 
  validateRequest(Schemas.enterprisePolicy), 
  enterpriseController.createPolicy
);

router.post(
  '/enterprise/policy/enforce', 
  authGuard, 
  roleGuard(['Admin', 'Operator']), 
  validateRequest(Schemas.policyEnforce), 
  enterpriseController.enforceDevicePolicy
);

router.post(
  '/enterprise/remote-wipe', 
  authGuard, 
  roleGuard(['Admin']), 
  validateRequest(Schemas.remoteWipe), 
  enterpriseController.remoteWipe
);

// --- ADB PAIRING ENROLLMENT ---
router.post(
  '/enrollment/adb/generate', 
  authGuard, 
  roleGuard(['Admin']), 
  enrollmentController.generateADBCode
);

router.post(
  '/enrollment/adb/verify', 
  validateRequest(Schemas.adbVerify), 
  enrollmentController.verifyADBCode
);

module.exports = router;
