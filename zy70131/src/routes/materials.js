const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const { Material, MaterialStatus } = require('../models/Material');
const { Authorization, AuthorizationStatus } = require('../models/Authorization');
const { RegionRule } = require('../models/RegionRule');
const RuleEngine = require('../services/RuleEngine');

router.get('/', async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;
    const where = {};
    
    if (status) {
      where.status = status;
    }

    const materials = await Material.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: materials
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
    const { materialCode, materialName, materialType, copyrightOwner, description } = req.body;

    if (!materialCode || !materialName || !materialType || !copyrightOwner) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数'
      });
    }

    const material = await Material.create({
      id: uuidv4(),
      materialCode,
      materialName,
      materialType,
      copyrightOwner,
      description,
      status: MaterialStatus.DRAFT,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    res.status(201).json({
      success: true,
      data: material
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
    const material = await Material.findByPk(req.params.id);
    if (!material) {
      return res.status(404).json({
        success: false,
        error: '素材不存在'
      });
    }

    const authorizations = await Authorization.findAll({
      where: { materialId: material.id },
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: {
        material,
        authorizations
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
    const material = await Material.findByPk(req.params.id);
    if (!material) {
      return res.status(404).json({
        success: false,
        error: '素材不存在'
      });
    }

    const { materialName, materialType, copyrightOwner, description, status } = req.body;
    
    const updates = { updatedAt: new Date() };
    if (materialName !== undefined) updates.materialName = materialName;
    if (materialType !== undefined) updates.materialType = materialType;
    if (copyrightOwner !== undefined) updates.copyrightOwner = copyrightOwner;
    if (description !== undefined) updates.description = description;
    if (status !== undefined) updates.status = status;

    await material.update(updates);

    res.json({
      success: true,
      data: material
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/:id/authorizations', async (req, res) => {
  try {
    const material = await Material.findByPk(req.params.id);
    if (!material) {
      return res.status(404).json({
        success: false,
        error: '素材不存在'
      });
    }

    const authorizations = await Authorization.findAll({
      where: { materialId: material.id },
      order: [['createdAt', 'DESC']]
    });

    const results = [];
    for (const auth of authorizations) {
      const regionRules = await RegionRule.findAll({
        where: { authorizationId: auth.id },
        order: [['priority', 'DESC']]
      });
      results.push({
        authorization: auth,
        regionRules
      });
    }

    res.json({
      success: true,
      data: {
        material,
        authorizations: results
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/:id/authorizations', async (req, res) => {
  try {
    const material = await Material.findByPk(req.params.id);
    if (!material) {
      return res.status(404).json({
        success: false,
        error: '素材不存在'
      });
    }

    const {
      authorizationCode,
      channelId,
      channelName,
      scope,
      scopeDescription,
      effectiveDate,
      expirationDate,
      regionRules
    } = req.body;

    if (!authorizationCode || !channelId || !channelName || !effectiveDate || !expirationDate) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数'
      });
    }

    const authorization = await Authorization.create({
      id: uuidv4(),
      authorizationCode,
      materialId: material.id,
      channelId,
      channelName,
      scope: scope || 'full',
      scopeDescription,
      effectiveDate: new Date(effectiveDate),
      expirationDate: new Date(expirationDate),
      status: AuthorizationStatus.ACTIVE,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    if (regionRules && Array.isArray(regionRules)) {
      for (const rule of regionRules) {
        await RegionRule.create({
          id: uuidv4(),
          authorizationId: authorization.id,
          ruleType: rule.ruleType,
          regionCode: rule.regionCode,
          regionName: rule.regionName,
          priority: rule.priority || 0,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    }

    res.status(201).json({
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

router.post('/:id/evaluate', async (req, res) => {
  try {
    const material = await Material.findByPk(req.params.id);
    if (!material) {
      return res.status(404).json({
        success: false,
        error: '素材不存在'
      });
    }

    const { regionCode, authorizationId } = req.body;
    const ruleEngine = new RuleEngine();

    const authorizations = await Authorization.findAll({
      where: {
        materialId: material.id,
        ...(authorizationId ? { id: authorizationId } : {}),
        status: AuthorizationStatus.ACTIVE
      }
    });

    const results = [];
    for (const auth of authorizations) {
      const evaluation = await ruleEngine.evaluateAuthorizationValidity(auth, regionCode);
      results.push({
        authorizationId: auth.id,
        authorizationCode: auth.authorizationCode,
        channelName: auth.channelName,
        evaluation
      });
    }

    res.json({
      success: true,
      data: {
        material,
        evaluations: results
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
