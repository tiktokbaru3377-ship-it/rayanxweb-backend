const admin = require('firebase-admin');
const config = require('./index');
const logger = require('../utils/logger');

try {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: config.firebase.projectId,
      clientEmail: config.firebase.clientEmail,
      privateKey: config.firebase.privateKey,
    }),
  });
  logger.info('Firebase Admin SDK initialized successfully');
} catch (error) {
  logger.error('Firebase Admin initialization error:', error);
}

module.exports = admin;
