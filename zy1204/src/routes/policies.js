const express = require('express');
const router = express.Router();
const { Policy } = require('../models');

router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, type, isActive } = req.query;
    const offset = (page - 1) * limit;
    
    const where = {};
    if (type) {
      where.type = type;
    }
    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }
    
    const { count, rows } = await Policy.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
    res.json({
      success: true,
      data: rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('获取策略列表失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const policy = await Policy.findByPk(req.params.id);
    
    if (!policy) {
      return res.status(404).json({ success: false, message: '策略不存在' });
    }
    
    res.json({ success: true, data: policy });
  } catch (error) {
    console.error('获取策略详情失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, description, type, rateLimitType, config, isActive } = req.body;
    
    if (!name) {
      return res.status(400).json({ success: false, message: '策略名称不能为空' });
    }
    
    if (!type) {
      return res.status(400).json({ success: false, message: '策略类型不能为空' });
    }
    
    const validTypes = ['rate_limit', 'circuit_breaker', 'fallback', 'overload_protection'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ success: false, message: '无效的策略类型' });
    }
    
    if (type === 'rate_limit' && !rateLimitType) {
      return res.status(400).json({ success: false, message: '限流策略需要指定限流类型' });
    }
    
    const policy = await Policy.create({
      name,
      description,
      type,
      rateLimitType: type === 'rate_limit' ? rateLimitType : null,
      config: config || {},
      isActive: isActive !== undefined ? isActive : true
    });
    
    res.status(201).json({ success: true, data: policy });
  } catch (error) {
    console.error('创建策略失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const policy = await Policy.findByPk(req.params.id);
    
    if (!policy) {
      return res.status(404).json({ success: false, message: '策略不存在' });
    }
    
    const { name, description, type, rateLimitType, config, isActive } = req.body;
    
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (config !== undefined) updateData.config = config;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (type !== undefined) {
      const validTypes = ['rate_limit', 'circuit_breaker', 'fallback', 'overload_protection'];
      if (!validTypes.includes(type)) {
        return res.status(400).json({ success: false, message: '无效的策略类型' });
      }
      updateData.type = type;
      if (type === 'rate_limit') {
        updateData.rateLimitType = rateLimitType || policy.rateLimitType;
      } else {
        updateData.rateLimitType = null;
      }
    }
    
    await policy.update(updateData);
    
    res.json({ success: true, data: policy });
  } catch (error) {
    console.error('更新策略失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const policy = await Policy.findByPk(req.params.id);
    
    if (!policy) {
      return res.status(404).json({ success: false, message: '策略不存在' });
    }
    
    await policy.destroy();
    
    res.json({ success: true, message: '策略已删除' });
  } catch (error) {
    console.error('删除策略失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/types/list', (req, res) => {
  res.json({
    success: true,
    data: [
      { type: 'rate_limit', name: '限流策略', description: '控制请求速率' },
      { type: 'circuit_breaker', name: '熔断策略', description: '防止级联失败' },
      { type: 'fallback', name: '降级策略', description: '提供备用方案' },
      { type: 'overload_protection', name: '过载保护', description: '控制系统负载' }
    ]
  });
});

router.get('/rate-limit-types/list', (req, res) => {
  res.json({
    success: true,
    data: [
      { type: 'token_bucket', name: '令牌桶', description: '灵活的速率控制' },
      { type: 'leaky_bucket', name: '漏桶', description: '平滑请求流量' },
      { type: 'sliding_window', name: '滑动窗口', description: '精确的时间窗口计数' }
    ]
  });
});

router.get('/templates/defaults', (req, res) => {
  res.json({
    success: true,
    data: {
      token_bucket: {
        name: '默认令牌桶',
        type: 'rate_limit',
        rateLimitType: 'token_bucket',
        config: {
          capacity: 100,
          rate: 10,
          initialTokens: 100,
          queueEnabled: true,
          maxQueueSize: 50
        }
      },
      leaky_bucket: {
        name: '默认漏桶',
        type: 'rate_limit',
        rateLimitType: 'leaky_bucket',
        config: {
          capacity: 100,
          rate: 10,
          queueEnabled: true,
          maxQueueSize: 50
        }
      },
      sliding_window: {
        name: '默认滑动窗口',
        type: 'rate_limit',
        rateLimitType: 'sliding_window',
        config: {
          windowSize: 60,
          maxRequests: 100,
          queueEnabled: true,
          maxQueueSize: 50
        }
      },
      circuit_breaker: {
        name: '默认熔断器',
        type: 'circuit_breaker',
        config: {
          failureThreshold: 0.5,
          minimumRequests: 10,
          halfOpenRequestLimit: 3,
          resetTimeout: 60000,
          fallbackEnabled: true
        }
      },
      overload_protection: {
        name: '默认过载保护',
        type: 'overload_protection',
        config: {
          maxConcurrency: 100,
          maxQueueSize: 50,
          queueTimeout: 5000,
          fallbackEnabled: true,
          adaptiveEnabled: false,
          minConcurrency: 10,
          targetLatency: 500
        }
      }
    }
  });
});

module.exports = router;
