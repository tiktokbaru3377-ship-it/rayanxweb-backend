const express = require('express');
const router = express.Router();

// Middleware Guards
const { authGuard, roleGuard } = require('../middlewares/auth');

// Controllers
const deviceController = require('../controllers/device.controller');
const mdmController = require('../controllers/mdm.controller');
const enrollmentController = require('../controllers/enrollment.controller');
const locationController = require('../controllers/location.controller');
const enterpriseController = require('../controllers/enterprise.controller');
const systemController = require('../controllers/system.controller');

// --- SYSTEM TELEMETRY ---
router.get('/health', systemController.getHealthMetrics);

// --- DEVICE AUDIT & MANAGEMENT ---
router.post('/devices', authGuard, roleGuard(['Admin', 'Operator']), deviceController.registerDevice);
router.get('/devices', authGuard, deviceController.getDevices);

// --- MDM COMMAND CORE (CONSENT-BASED) ---
router.post('/mdm/action', authGuard, roleGuard(['Admin', 'Operator']), mdmController.executeDeviceAction);

// --- GEOLOCATION TELEMETRY ---
router.post('/location/ingest', locationController.ingestLocation); // Payload dari device agent
router.get('/location/history', authGuard, locationController.getDeviceHistory); // Dibaca oleh Dashboard

// --- ENTERPRISE PROFILE & COMPLIANCE MANAGEMENT ---
router.post('/enterprise/policy', authGuard, roleGuard(['Admin']), enterpriseController.createPolicy);
router.post('/enterprise/policy/enforce', authGuard, roleGuard(['Admin', 'Operator']), enterpriseController.enforceDevicePolicy);
router.post('/enterprise/remote-wipe', authGuard, roleGuard(['Admin']), enterpriseController.remoteWipe);

// --- ADB PAIRING ENROLLMENT ---
router.post('/enrollment/adb/generate', authGuard, roleGuard(['Admin']), enrollmentController.generateADBCode);
router.post('/enrollment/adb/verify', enrollmentController.verifyADBCode);

module.exports = router;
