const admin = require('../config/firebase');
const User = require('../models/User');
const logger = require('../utils/logger');

const authGuard = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Unauthenticated: Missing Bearer Token' });
  }

  const idToken = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    let user = await User.findOne({ firebaseUid: decodedToken.uid });
    
    if (!user) {
      user = await User.create({
        firebaseUid: decodedToken.uid,
        email: decodedToken.email,
        name: decodedToken.name || 'MDM User',
        role: 'Viewer' // Default role
      });
    }

    req.user = user;
    next();
  } catch (error) {
    logger.error('Authentication Error:', error);
    return res.status(403).json({ success: false, message: 'Invalid or Expired Token' });
  }
};

const roleGuard = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Forbidden: Insufficient privileges' });
    }
    next();
  };
};

module.exports = { authGuard, roleGuard };
