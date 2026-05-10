const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const { Authorization, AuthorizationStatus } = require('../models/Authorization');
const { RegionRule, RegionRuleType } = require('../models/RegionRule');
const { Material } = require('../models/Material');
const RuleEngine = require('../services/RuleEngine');
const RemovalService = require('../services/RemovalService');
const NotificationService = require('../services/NotificationService');

router.get('/', async (req, res) => {
  try {
    const { status, materialId, channelId, limit = 50, offset = 0 } = req.query;
    const where = {};
    
    if (status) where.status = status;
    if (materialId) where.materialId = materialId;
    if (channelId) where.channelId = channelId;

    const authorizations = await Authorization.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: authorizations
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
    const authorization = await Authorization.findByPk(req.params.id);
    if (!authorization) {
      return res.status(404).json({
        success: false,
        error: '授权不存在'
      });
    }

    const material = await Material.findByPk(authorization.materialId);
    const regionRules = await RegionRule.findAll({
      where: { authorizationId: authorization.id },
      order: [['priority', 'DESC']]
    });

    res.json({
      success: true,
      data: {
        authorization,
        material,
        regionRules
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const authorization = await Authorization.findByPk(req.params.id);
    if (!authorization) {
      return res.status(404).json({
        success: false,
        error: '授权不存在'
      });
    }

    const { scope, scopeDescription, effectiveDate, expirationDate, status } = req.body;
    
    const updates = { updatedAt: new Date() };
    if (scope !== undefined) updates.scope = scope;
    if (scopeDescription !== undefined) updates.scopeDescription = scopeDescription;
    if (effectiveDate !== undefined) updates.effectiveDate = new Date(effectiveDate);
    if (expirationDate !== undefined) updates.expirationDate = new Date(expirationDate);
    if (status !== undefined) updates.status = status;

    await authorization.update(updates);

    res.json({
      success: true,
      data: authorization
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/:id/revoke', async (req, res) => {
  try {
    const { revokedBy, revocationReason, notifyRecipient } = req.body;
    
    if (!revokedBy) {
      return res.status(400).json({
        success: false,
        error: '必须指定撤销人'
      });
    }

    const removalService = new RemovalService();
    const result = await removalService.processRevocation(
      req.params.id,
      revokedBy,
      revocationReason
    );

    if (notifyRecipient) {
      const notificationService = new NotificationService();
      const authorization = await Authorization.findByPk(req.params.id);
      await notificationService.sendRevocationNotification(authorization, notifyRecipient);
    }

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/:id/evaluate', async (req, res) => {
  try {
    const authorization = await Authorization.findByPk(req.params.id);
    if (!authorization) {
      return res.status(404).json({
        success: false,
        error: '授权不存在'
      });
    }

    const { regionCode, checkTime } = req.body;
    const ruleEngine = new RuleEngine();

    const evalTime = checkTime ? new Date(checkTime) : null;
    const result = await ruleEngine.evaluateAuthorizationValidity(authorization, regionCode, evalTime);

    res.json({
      success: true,
      data: {
        authorizationCode: authorization.authorizationCode,
        evaluation: result
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/:id/evaluation-history', async (req, res) => {
  try {
    const authorization = await Authorization.findByPk(req.params.id);
    if (!authorization) {
      return res.status(404).json({
        success: false,
        error: '授权不存在'
      });
    }

    const { limit = 20 } = req.query;
    const ruleEngine = new RuleEngine();
    const history = await ruleEngine.getEvaluationHistory(req.params.id, parseInt(limit));

    res.json({
      success: true,
      data: {
        authorizationCode: authorization.authorizationCode,
        history: history.map(log => ({
          id: log.id,
          evaluationType: log.evaluationType,
          evaluatedAt: log.evaluatedAt,
          inputData: JSON.parse(log.inputData),
          evaluationSteps: JSON.parse(log.evaluationSteps),
          finalResult: JSON.parse(log.finalResult),
          triggeredAction: log.triggeredAction
        }))
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/:id/region-rules', async (req, res) => {
  try {
    const authorization = await Authorization.findByPk(req.params.id);
    if (!authorization) {
      return res.status(404).json({
        success: false,
        error: '授权不存在'
      });
    }

    const rules = await RegionRule.findAll({
      where: { authorizationId: authorization.id },
      order: [['priority', 'DESC']]
    });

    res.json({
      success: true,
      data: rules
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/:id/region-rules', async (req, res) => {
  try {
    const authorization = await Authorization.findByPk(req.params.id);
    if (!authorization) {
      return res.status(404).json({
        success: false,
        error: '授权不存在'
      });
    }

    const { ruleType, regionCode, regionName, priority } = req.body;
    
    if (!ruleType || !regionCode || !regionName) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数'
      });
    }

    const rule = await RegionRule.create({
      id: uuidv4(),
      authorizationId: authorization.id,
      ruleType,
      regionCode,
      regionName,
      priority: priority || 0,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    res.status(201).json({
      success: true,
      data: rule
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.delete('/region-rules/:ruleId', async (req, res) => {
  try {
    const rule = await RegionRule.findByPk(req.params.ruleId);
    if (!rule) {
      return res.status(404).json({
        success: false,
        error: '地域规则不存在'
      });
    }

    await rule.destroy();

    res.json({
      success: true,
      message: '地域规则已删除'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
