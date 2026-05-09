const express = require('express');
const Joi = require('joi');
const authService = require('../services/authService');
const { authenticate } = require('../middleware/auth');
const { success, error: errorResponse } = require('../utils/response');

const router = express.Router();

const loginSchema = Joi.object({
  username: Joi.string().required().min(3).max(50),
  password: Joi.string().required().min(6),
});

const registerSchema = Joi.object({
  username: Joi.string().required().min(3).max(50),
  password: Joi.string().required().min(6),
  role: Joi.string().valid('admin', 'operator', 'viewer').default('operator'),
});

const changePasswordSchema = Joi.object({
  oldPassword: Joi.string().required(),
  newPassword: Joi.string().required().min(6),
});

router.post('/login', async (req, res, next) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json(errorResponse(error.details[0].message, 400));
    }
    
    const result = await authService.login(value.username, value.password, req);
    res.json(success(result, 'Login successful'));
  } catch (err) {
    next(err);
  }
});

router.post('/register', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json(errorResponse('Only admin can register users', 403));
    }
    
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      return res.status(400).json(errorResponse(error.details[0].message, 400));
    }
    
    const user = await authService.register(value.username, value.password, value.role);
    res.status(201).json(success(user, 'User created successfully'));
  } catch (err) {
    next(err);
  }
});

router.get('/profile', authenticate, async (req, res, next) => {
  try {
    const user = await authService.getProfile(req.user._id);
    res.json(success(user));
  } catch (err) {
    next(err);
  }
});

router.post('/change-password', authenticate, async (req, res, next) => {
  try {
    const { error, value } = changePasswordSchema.validate(req.body);
    if (error) {
      return res.status(400).json(errorResponse(error.details[0].message, 400));
    }
    
    await authService.changePassword(
      req.user._id,
      value.oldPassword,
      value.newPassword
    );
    res.json(success(null, 'Password changed successfully'));
  } catch (err) {
    next(err);
  }
});

router.get('/users', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json(errorResponse('Only admin can list users', 403));
    }
    
    const users = await authService.listUsers(req.query.role);
    res.json(success(users));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
