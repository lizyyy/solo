const express = require('express');
const router = express.Router();
const { Valve } = require('../models');
const { asyncHandler, NotFoundError, ValidationError } = require('../utils/errorHandler');
const TopologyService = require('../services/TopologyService');

router.get('/', asyncHandler(async (req, res) => {
  const { status, type, networkNodeId } = req.query;
  const where = {};
  
  if (status) where.status = status;
  if (type) where.type = type;
  if (networkNodeId) where.networkNodeId = networkNodeId;
  
  const valves = await Valve.findAll({
    where,
    order: [['createdAt', 'DESC']]
  });
  
  res.json({
    success: true,
    data: valves
  });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const valve = await Valve.findByPk(req.params.id);
  
  if (!valve) {
    throw new NotFoundError(`阀门 ${req.params.id} 不存在`);
  }
  
  res.json({
    success: true,
    data: valve
  });
}));

router.post('/', asyncHandler(async (req, res) => {
  const { id, name, location, longitude, latitude, type, diameter, networkNodeId } = req.body;
  
  if (!id || !name || !location || longitude == null || latitude == null || !networkNodeId) {
    throw new ValidationError('缺少必要参数: id, name, location, longitude, latitude, networkNodeId');
  }
  
  const existing = await Valve.findByPk(id);
  if (existing) {
    throw new ValidationError(`阀门 ${id} 已存在`);
  }
  
  const valve = await Valve.create({
    id,
    name,
    location,
    longitude,
    latitude,
    type: type || 'branch',
    status: 'open',
    diameter,
    networkNodeId
  });
  
  res.status(201).json({
    success: true,
    data: valve
  });
}));

router.put('/:id/status', asyncHandler(async (req, res) => {
  const { status } = req.body;
  const valve = await Valve.findByPk(req.params.id);
  
  if (!valve) {
    throw new NotFoundError(`阀门 ${req.params.id} 不存在`);
  }
  
  if (!['open', 'closed', 'maintenance', 'fault'].includes(status)) {
    throw new ValidationError('无效的阀门状态');
  }
  
  await valve.update({ status });
  
  res.json({
    success: true,
    data: valve
  });
}));

router.post('/:id/close', asyncHandler(async (req, res) => {
  const valve = await Valve.findByPk(req.params.id);
  
  if (!valve) {
    throw new NotFoundError(`阀门 ${req.params.id} 不存在`);
  }
  
  if (valve.status === 'closed') {
    throw new ValidationError('阀门已关闭');
  }
  
  await valve.update({ status: 'closed' });
  
  res.json({
    success: true,
    message: `阀门 ${valve.name} 已关闭`,
    data: valve
  });
}));

router.post('/:id/open', asyncHandler(async (req, res) => {
  const valve = await Valve.findByPk(req.params.id);
  
  if (!valve) {
    throw new NotFoundError(`阀门 ${req.params.id} 不存在`);
  }
  
  if (valve.status === 'open') {
    throw new ValidationError('阀门已开启');
  }
  
  await valve.update({ status: 'open' });
  
  res.json({
    success: true,
    message: `阀门 ${valve.name} 已开启`,
    data: valve
  });
}));

router.post('/analyze', asyncHandler(async (req, res) => {
  const { valveIds } = req.body;
  
  if (!Array.isArray(valveIds) || valveIds.length === 0) {
    throw new ValidationError('请提供要分析的阀门ID数组');
  }
  
  for (const valveId of valveIds) {
    const valve = await Valve.findByPk(valveId);
    if (!valve) {
      throw new NotFoundError(`阀门 ${valveId} 不存在`);
    }
  }
  
  const impact = await TopologyService.analyzeImpact(valveIds);
  
  res.json({
    success: true,
    data: {
      affectedNodeCount: impact.affectedNodeIds.length,
      affectedCommunities: impact.communities,
      affectedHospitals: impact.hospitals,
      affectedFireHydrants: impact.fireHydrants,
      affectedPriorityUsers: impact.priorityUsers,
      totalHouseholds: impact.totalHouseholds,
      totalPopulation: impact.totalPopulation
    }
  });
}));

router.post('/recommend', asyncHandler(async (req, res) => {
  const { pipeId } = req.body;
  
  if (!pipeId) {
    throw new ValidationError('请提供管道ID');
  }
  
  const result = await TopologyService.recommendValves(pipeId);
  
  res.json({
    success: true,
    data: result
  });
}));

module.exports = router;