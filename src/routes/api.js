const express = require('express');
const router = express.Router();
const { authGuard, roleGuard } = require('../middlewares/auth');
const deviceController = require('../controllers/device.controller');
const mdmController = require('../controllers/mdm.controller');
const enrollmentController = require('../controllers/enrollment.controller');
const fileController = require('../controllers/file.controller');

// Devices Management
router.post('/devices', authGuard, roleGuard(['Admin', 'Operator']), deviceController.registerDevice);
router.get('/devices', authGuard, deviceController.getDevices);

// MDM Commands (Consent-Based)
router.post('/mdm/action', authGuard, roleGuard(['Admin', 'Operator']), mdmController.executeDeviceAction);
router.get('/mdm/files', authGuard, roleGuard(['Admin', 'Operator']), fileController.requestFileList);

// ADB Enrollment
router.post('/enrollment/adb/generate', authGuard, roleGuard(['Admin']), enrollmentController.generateADBCode);
router.post('/enrollment/adb/verify', enrollmentController.verifyADBCode); // Diakses oleh device client app tanpa auth token header

module.exports = router;
