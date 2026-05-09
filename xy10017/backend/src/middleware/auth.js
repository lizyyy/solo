const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');
const { error: errorResponse } = require('../utils/response');

async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json(errorResponse('No token provided', 401));
    }
    
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, config.jwtSecret);
    
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) {
      return res.status(401).json(errorResponse('User not found', 401));
    }
    
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json(errorResponse('Invalid token', 401));
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json(errorResponse('Not authenticated', 401));
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json(errorResponse('Insufficient permissions', 403));
    }
    
    next();
  };
}

module.exports = {
  authenticate,
  requireRole,
};
