const express = require('express');
const router = express.Router();
const { NetworkNode, Pipe, Community, Hospital, FireHydrant, PriorityUser } = require('../models');
const { asyncHandler, ValidationError } = require('../utils/errorHandler');

router.get('/network-nodes', asyncHandler(async (req, res) => {
  const nodes = await NetworkNode.findAll();
  res.json({ success: true, data: nodes });
}));

router.post('/network-nodes', asyncHandler(async (req, res) => {
  const { id, name, nodeType, longitude, latitude, elevation, zoneId } = req.body;
  
  if (!id || !name || !nodeType || longitude == null || latitude == null) {
    throw new ValidationError('缺少必要参数');
  }
  
  const node = await NetworkNode.create({
    id, name, nodeType, longitude, latitude, elevation, zoneId
  });
  
  res.status(201).json({ success: true, data: node });
}));

router.get('/pipes', asyncHandler(async (req, res) => {
  const pipes = await Pipe.findAll();
  res.json({ success: true, data: pipes });
}));

router.post('/pipes', asyncHandler(async (req, res) => {
  const { id, name, startNodeId, endNodeId, diameter, material, length } = req.body;
  
  if (!id || !name || !startNodeId || !endNodeId || !diameter) {
    throw new ValidationError('缺少必要参数');
  }
  
  const pipe = await Pipe.create({
    id, name, startNodeId, endNodeId, diameter, material, length, status: 'active'
  });
  
  res.status(201).json({ success: true, data: pipe });
}));

router.get('/communities', asyncHandler(async (req, res) => {
  const communities = await Community.findAll();
  res.json({ success: true, data: communities });
}));

router.post('/communities', asyncHandler(async (req, res) => {
  const { id, name, address, households, population, networkNodeId, waterPressure, contactPerson, contactPhone } = req.body;
  
  if (!id || !name || !address || !households || !networkNodeId) {
    throw new ValidationError('缺少必要参数');
  }
  
  const community = await Community.create({
    id, name, address, households, population, networkNodeId, waterPressure, contactPerson, contactPhone
  });
  
  res.status(201).json({ success: true, data: community });
}));

router.get('/hospitals', asyncHandler(async (req, res) => {
  const hospitals = await Hospital.findAll();
  res.json({ success: true, data: hospitals });
}));

router.post('/hospitals', asyncHandler(async (req, res) => {
  const { id, name, address, level, beds, hasIcu, networkNodeId, backupWater, contactPerson, contactPhone } = req.body;
  
  if (!id || !name || !address || !level || !networkNodeId) {
    throw new ValidationError('缺少必要参数');
  }
  
  const hospital = await Hospital.create({
    id, name, address, level, beds, hasIcu, networkNodeId, backupWater, contactPerson, contactPhone
  });
  
  res.status(201).json({ success: true, data: hospital });
}));

router.get('/fire-hydrants', asyncHandler(async (req, res) => {
  const hydrants = await FireHydrant.findAll();
  res.json({ success: true, data: hydrants });
}));

router.post('/fire-hydrants', asyncHandler(async (req, res) => {
  const { id, location, longitude, latitude, type, networkNodeId } = req.body;
  
  if (!id || !location || longitude == null || latitude == null || !networkNodeId) {
    throw new ValidationError('缺少必要参数');
  }
  
  const hydrant = await FireHydrant.create({
    id, location, longitude, latitude, type: type || 'ground', status: 'active', networkNodeId
  });
  
  res.status(201).json({ success: true, data: hydrant });
}));

router.get('/priority-users', asyncHandler(async (req, res) => {
  const users = await PriorityUser.findAll();
  res.json({ success: true, data: users });
}));

router.post('/priority-users', asyncHandler(async (req, res) => {
  const { id, name, type, address, priorityLevel, networkNodeId, waterDemand, contactPerson, contactPhone } = req.body;
  
  if (!id || !name || !type || !address || !networkNodeId) {
    throw new ValidationError('缺少必要参数');
  }
  
  const user = await PriorityUser.create({
    id, name, type, address, priorityLevel: priorityLevel || '3', networkNodeId, waterDemand, contactPerson, contactPhone
  });
  
  res.status(201).json({ success: true, data: user });
}));

module.exports = router;