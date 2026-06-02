const express = require('express');
const router = express.Router();
const { authGuard, roleGuard } = require('../middlewares/auth');
const deviceController = require('../controllers/device.controller');

router.post('/devices', authGuard, roleGuard(['Admin', 'Operator']), deviceController.registerDevice);
router.get('/devices', authGuard, deviceController.getDevices);

module.exports = router;
