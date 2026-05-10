const express = require('express');
const router = express.Router();
const medicationPlanService = require('../services/medicationPlanService');
const store = require('../data/store');

router.post('/', (req, res) => {
  const requestId = req.headers['x-request-id'];
  
  if (requestId) {
    const idempotentResponse = store.checkIdempotency(requestId);
    if (idempotentResponse) {
      return res.status(idempotentResponse.status).json(idempotentResponse.body);
    }
  }

  try {
    if (!req.body.petId) {
      throw new Error('缺少必填字段：宠物ID');
    }

    const plan = medicationPlanService.createMedicationPlan(req.body);
    
    const response = {
      status: 201,
      body: {
        message: '喂药计划创建成功',
        plan
      }
    };

    if (requestId) {
      store.recordIdempotency(requestId, response);
    }

    res.status(201).json(response.body);
  } catch (error) {
    const response = {
      status: 400,
      body: {
        error: '创建喂药计划失败',
        message: error.message
      }
    };

    if (requestId) {
      store.recordIdempotency(requestId, response);
    }

    res.status(400).json(response.body);
  }
});

router.get('/:planId', (req, res) => {
  try {
    const plan = medicationPlanService.getMedicationPlanById(req.params.planId);
    if (!plan) {
      return res.status(404).json({
        error: '未找到喂药计划',
        message: `找不到 ID 为 "${req.params.planId}" 的喂药计划`
      });
    }
    res.json(plan);
  } catch (error) {
    res.status(400).json({
      error: '查询喂药计划失败',
      message: error.message
    });
  }
});

router.get('/pet/:petId', (req, res) => {
  try {
    const plans = medicationPlanService.getMedicationPlansByPetId(req.params.petId);
    res.json({
      count: plans.length,
      plans
    });
  } catch (error) {
    res.status(400).json({
      error: '查询宠物喂药计划失败',
      message: error.message
    });
  }
});

router.post('/:planId/advance', (req, res) => {
  const requestId = req.headers['x-request-id'];
  
  if (requestId) {
    const idempotentResponse = store.checkIdempotency(requestId);
    if (idempotentResponse) {
      return res.status(idempotentResponse.status).json(idempotentResponse.body);
    }
  }

  try {
    if (!req.body.executedBy) {
      throw new Error('缺少必填字段：执行人');
    }

    const plan = medicationPlanService.advancePlan(req.params.planId, req.body);
    
    const response = {
      status: 200,
      body: {
        message: '喂药计划推进成功',
        plan
      }
    };

    if (requestId) {
      store.recordIdempotency(requestId, response);
    }

    res.json(response.body);
  } catch (error) {
    const response = {
      status: 400,
      body: {
        error: '推进喂药计划失败',
        message: error.message
      }
    };

    if (requestId) {
      store.recordIdempotency(requestId, response);
    }

    res.status(400).json(response.body);
  }
});

router.post('/:planId/withdraw', (req, res) => {
  const requestId = req.headers['x-request-id'];
  
  if (requestId) {
    const idempotentResponse = store.checkIdempotency(requestId);
    if (idempotentResponse) {
      return res.status(idempotentResponse.status).json(idempotentResponse.body);
    }
  }

  try {
    if (!req.body.reason) {
      throw new Error('缺少必填字段：撤回原因');
    }

    const plan = medicationPlanService.withdrawPlan(req.params.planId, req.body.reason);
    
    const response = {
      status: 200,
      body: {
        message: '喂药计划撤回成功',
        plan
      }
    };

    if (requestId) {
      store.recordIdempotency(requestId, response);
    }

    res.json(response.body);
  } catch (error) {
    const response = {
      status: 400,
      body: {
        error: '撤回喂药计划失败',
        message: error.message
      }
    };

    if (requestId) {
      store.recordIdempotency(requestId, response);
    }

    res.status(400).json(response.body);
  }
});

router.post('/:planId/correct', (req, res) => {
  const requestId = req.headers['x-request-id'];
  
  if (requestId) {
    const idempotentResponse = store.checkIdempotency(requestId);
    if (idempotentResponse) {
      return res.status(idempotentResponse.status).json(idempotentResponse.body);
    }
  }

  try {
    if (!req.body.correctedBy) {
      throw new Error('缺少必填字段：修正人');
    }
    if (!req.body.reason) {
      throw new Error('缺少必填字段：修正原因');
    }

    const plan = medicationPlanService.correctPlan(req.params.planId, req.body);
    
    const response = {
      status: 200,
      body: {
        message: '喂药计划修正成功',
        plan
      }
    };

    if (requestId) {
      store.recordIdempotency(requestId, response);
    }

    res.json(response.body);
  } catch (error) {
    const response = {
      status: 400,
      body: {
        error: '修正喂药计划失败',
        message: error.message
      }
    };

    if (requestId) {
      store.recordIdempotency(requestId, response);
    }

    res.status(400).json(response.body);
  }
});

module.exports = router;
