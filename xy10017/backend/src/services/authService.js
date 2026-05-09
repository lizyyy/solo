const jwt = require('jsonwebtoken');
const User = require('../models/User');
const config = require('../config');
const auditService = require('./auditService');

async function register(username, password, role = 'operator') {
  const existingUser = await User.findOne({ username });
  
  if (existingUser) {
    const error = new Error('Username already exists');
    error.statusCode = 409;
    throw error;
  }
  
  const user = new User({
    username,
    password,
    role,
  });
  
  await user.save();
  
  return {
    id: user._id,
    username: user.username,
    role: user.role,
  };
}

async function login(username, password, req) {
  const user = await User.findOne({ username }).select('+password');
  
  if (!user) {
    const error = new Error('Invalid credentials');
    error.statusCode = 401;
    throw error;
  }
  
  if (user.status !== 'active') {
    const error = new Error('User account is inactive');
    error.statusCode = 403;
    throw error;
  }
  
  const isMatch = await user.comparePassword(password);
  
  if (!isMatch) {
    const error = new Error('Invalid credentials');
    error.statusCode = 401;
    throw error;
  }
  
  const token = jwt.sign(
    { userId: user._id.toString(), username: user.username, role: user.role },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
  
  await User.findByIdAndUpdate(user._id, { lastLoginAt: new Date() });
  
  await auditService.logAction({
    action: 'user_login',
    resourceType: 'user',
    resourceId: user._id,
    userId: user._id,
    username: user.username,
    req,
    description: `User logged in: ${username}`,
  });
  
  return {
    token,
    user: {
      id: user._id,
      username: user.username,
      role: user.role,
    },
  };
}

async function getProfile(userId) {
  const user = await User.findById(userId).select('-password');
  
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }
  
  return user;
}

async function changePassword(userId, oldPassword, newPassword) {
  const user = await User.findById(userId).select('+password');
  
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }
  
  const isMatch = await user.comparePassword(oldPassword);
  
  if (!isMatch) {
    const error = new Error('Invalid old password');
    error.statusCode = 401;
    throw error;
  }
  
  user.password = newPassword;
  await user.save();
  
  return true;
}

async function listUsers(role = null) {
  const query = role ? { role } : {};
  return User.find(query).select('-password').lean();
}

async function seedAdminUser() {
  const existingAdmin = await User.findOne({ username: 'admin' });
  
  if (!existingAdmin) {
    await register('admin', 'admin123', 'admin');
    console.log('Default admin user created: admin / admin123');
  }
}

module.exports = {
  register,
  login,
  getProfile,
  changePassword,
  listUsers,
  seedAdminUser,
};
