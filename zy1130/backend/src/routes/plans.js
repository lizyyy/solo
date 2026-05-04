const express = require('express');
const router = express.Router();
const planRepository = require('../repositories/PlanRepository');

router.get('/', async (req, res) => {
  try {
    const { date, isActive, limit, offset } = req.query;
    const options = {};
    
    if (date) options.date = date;
    if (isActive !== undefined) options.isActive = isActive === 'true';
    if (limit) options.limit = parseInt(limit, 10);
    if (offset) options.offset = parseInt(offset, 10);
    
    const plans = await planRepository.findAll(options);
    const total = await planRepository.count(options);
    
    res.json({
      success: true,
      data: plans,
      pagination: {
        total,
        limit: options.limit || total,
        offset: options.offset || 0
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/active', async (req, res) => {
  try {
    const plan = await planRepository.getActive();
    if (!plan) {
      return res.status(404).json({
        success: false,
        error: '没有激活的方案'
      });
    }
    res.json({
      success: true,
      data: plan
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const plan = await planRepository.findById(req.params.id);
    if (!plan) {
      return res.status(404).json({
        success: false,
        error: '方案不存在'
      });
    }
    res.json({
      success: true,
      data: plan
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/', async (req, res) => {
  try {
    const plan = await planRepository.create(req.body);
    res.status(201).json({
      success: true,
      data: plan
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const plan = await planRepository.update(req.params.id, req.body);
    res.json({
      success: true,
      data: plan
    });
  } catch (error) {
    if (error.message.includes('不存在')) {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const deleted = await planRepository.delete(req.params.id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: '方案不存在'
      });
    }
    res.json({
      success: true,
      message: '方案已删除'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.put('/:id/activate', async (req, res) => {
  try {
    const result = await planRepository.setActive(req.params.id);
    if (!result) {
      return res.status(404).json({
        success: false,
        error: '方案不存在'
      });
    }
    res.json({
      success: true,
      message: '方案已激活'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/:id/versions', async (req, res) => {
  try {
    const versions = await planRepository.getVersions(req.params.id);
    res.json({
      success: true,
      data: versions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/:id/versions/:versionNumber', async (req, res) => {
  try {
    const version = await planRepository.getVersion(
      req.params.id,
      parseInt(req.params.versionNumber, 10)
    );
    if (!version) {
      return res.status(404).json({
        success: false,
        error: '版本不存在'
      });
    }
    res.json({
      success: true,
      data: version
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/compare', async (req, res) => {
  try {
    const { planIds } = req.body;
    
    if (!Array.isArray(planIds) || planIds.length < 2) {
      return res.status(400).json({
        success: false,
        error: '需要至少两个方案进行对比'
      });
    }
    
    const plans = [];
    for (const planId of planIds) {
      const plan = await planRepository.findById(planId);
      if (plan) {
        plans.push(plan);
      }
    }
    
    if (plans.length < 2) {
      return res.status(404).json({
        success: false,
        error: '找不到足够的有效方案进行对比'
      });
    }
    
    const comparison = {
      plans: plans.map(p => ({
        id: p.id,
        name: p.name,
        date: p.date,
        createdAt: p.createdAt,
        summary: p.planData?.summary
      })),
      metrics: {
        totalJobs: plans.map(p => p.planData?.summary?.totalJobs || 0),
        assignedJobs: plans.map(p => p.planData?.summary?.assignedJobs || 0),
        unassignedJobs: plans.map(p => p.planData?.summary?.unassignedJobs || 0),
        totalDistanceKm: plans.map(p => p.planData?.summary?.totalDistanceKm || 0),
        totalDurationMinutes: plans.map(p => p.planData?.summary?.totalDurationMinutes || 0),
        overallRiskScore: plans.map(p => p.planData?.summary?.overallRiskScore || 0),
        issueCount: plans.map(p => (p.planData?.summary?.issues?.length || 0)),
        warningCount: plans.map(p => (p.planData?.summary?.warnings?.length || 0))
      },
      workerBreakdown: {}
    };
    
    const allWorkerIds = new Set();
    plans.forEach(p => {
      if (p.planData?.routes) {
        Object.keys(p.planData.routes).forEach(wid => allWorkerIds.add(wid));
      }
    });
    
    allWorkerIds.forEach(workerId => {
      comparison.workerBreakdown[workerId] = plans.map(p => {
        const route = p.planData?.routes?.[workerId];
        return {
          planId: p.id,
          jobCount: route?.jobCount || 0,
          totalDistanceKm: route?.totalDistanceKm || 0,
          totalDurationMinutes: route?.totalDurationMinutes || 0,
          riskScore: route?.riskScore || 0
        };
      });
    });
    
    res.json({
      success: true,
      data: comparison
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
