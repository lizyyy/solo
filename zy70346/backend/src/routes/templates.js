const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const models = require('../models');
const { validateTemplate, simulateSending, getSampleTestData } = require('../services/validationService');
const releaseService = require('../services/releaseService');

const {
  Template,
  TemplateVersion,
  VariableDictionary,
  ReleaseRecord,
  AuditLog,
  sequelize
} = models;

router.get('/', async (req, res) => {
  try {
    const templates = await Template.findAll({
      include: [
        {
          model: TemplateVersion,
          as: 'versions',
          order: [['versionNumber', 'DESC']],
          limit: 1
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: templates.map(t => ({
        id: t.id,
        name: t.name,
        category: t.category,
        description: t.description,
        status: t.status,
        currentVersionId: t.currentVersionId,
        latestVersion: t.versions?.[0]?.version || null,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const template = await Template.findByPk(req.params.id, {
      include: [
        {
          model: TemplateVersion,
          as: 'versions',
          order: [['versionNumber', 'DESC']]
        },
        {
          model: VariableDictionary,
          as: 'variables'
        }
      ]
    });

    if (!template) {
      return res.status(404).json({ success: false, error: '模板不存在' });
    }

    res.json({
      success: true,
      data: {
        id: template.id,
        name: template.name,
        category: template.category,
        description: template.description,
        status: template.status,
        currentVersionId: template.currentVersionId,
        versions: template.versions.map(v => ({
          id: v.id,
          version: v.version,
          versionNumber: v.versionNumber,
          status: v.status,
          smsContent: v.smsContent,
          emailSubject: v.emailSubject,
          emailContent: v.emailContent,
          inAppTitle: v.inAppTitle,
          inAppContent: v.inAppContent,
          variableDictionary: JSON.parse(v.variableDictionary || '[]'),
          channelLimits: JSON.parse(v.channelLimits || '{}'),
          previousVersionId: v.previousVersionId,
          createdBy: v.createdBy,
          createdAt: v.createdAt
        })),
        variables: template.variables,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { name, category, description, variables, templateContent } = req.body;

    if (!name || !category) {
      return res.status(400).json({ success: false, error: '模板名称和类型为必填' });
    }

    const template = await Template.create({
      id: uuidv4(),
      name,
      category,
      description: description || '',
      status: 'active'
    }, { transaction: t });

    if (variables && variables.length > 0) {
      await VariableDictionary.bulkCreate(
        variables.map(v => ({
          id: uuidv4(),
          templateId: template.id,
          variableName: v.variableName,
          displayName: v.displayName,
          isRequired: v.isRequired !== false,
          dataType: v.dataType || 'string',
          defaultValue: v.defaultValue || '',
          description: v.description || ''
        })),
        { transaction: t }
      );
    }

    await AuditLog.create({
      id: uuidv4(),
      templateId: template.id,
      action: 'create',
      details: JSON.stringify({ name, category }),
      operator: req.body.operator || 'system'
    }, { transaction: t });

    await t.commit();

    res.json({
      success: true,
      data: template
    });
  } catch (error) {
    await t.rollback();
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { name, description, variables } = req.body;
    const template = await Template.findByPk(req.params.id, { transaction: t });

    if (!template) {
      await t.rollback();
      return res.status(404).json({ success: false, error: '模板不存在' });
    }

    if (name) template.name = name;
    if (description !== undefined) template.description = description;
    await template.save({ transaction: t });

    if (variables) {
      await VariableDictionary.destroy({
        where: { templateId: template.id },
        transaction: t
      });

      if (variables.length > 0) {
        await VariableDictionary.bulkCreate(
          variables.map(v => ({
            id: uuidv4(),
            templateId: template.id,
            variableName: v.variableName,
            displayName: v.displayName,
            isRequired: v.isRequired !== false,
            dataType: v.dataType || 'string',
            defaultValue: v.defaultValue || '',
            description: v.description || ''
          })),
          { transaction: t }
        );
      }
    }

    await AuditLog.create({
      id: uuidv4(),
      templateId: template.id,
      action: 'update',
      details: JSON.stringify({ name, description, variablesUpdated: !!variables }),
      operator: req.body.operator || 'system'
    }, { transaction: t });

    await t.commit();

    res.json({ success: true, data: template });
  } catch (error) {
    await t.rollback();
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/versions', async (req, res) => {
  try {
    const version = await releaseService.createVersion(req.params.id, req.body, models);
    res.json({ success: true, data: version });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/validate', async (req, res) => {
  try {
    const { versionData, channelLimits } = req.body;
    const template = await Template.findByPk(req.params.id, {
      include: [{ model: VariableDictionary, as: 'variables' }]
    });

    if (!template) {
      return res.status(404).json({ success: false, error: '模板不存在' });
    }

    const validation = validateTemplate(versionData, template.variables, channelLimits);

    await AuditLog.create({
      id: uuidv4(),
      templateId: template.id,
      action: 'validate',
      details: JSON.stringify({ valid: validation.valid, errors: validation.errors }),
      operator: req.body.operator || 'system'
    });

    res.json({ success: true, data: validation });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/simulate', async (req, res) => {
  try {
    const { versionId, testData } = req.body;
    const template = await Template.findByPk(req.params.id);
    
    if (!template) {
      return res.status(404).json({ success: false, error: '模板不存在' });
    }

    let version;
    let variables;

    if (versionId) {
      version = await TemplateVersion.findByPk(versionId);
      if (!version) {
        return res.status(404).json({ success: false, error: '版本不存在' });
      }
      variables = JSON.parse(version.variableDictionary || '[]');
    } else {
      const vars = await VariableDictionary.findAll({ where: { templateId: template.id } });
      variables = vars;
      version = {
        smsContent: req.body.smsContent,
        emailSubject: req.body.emailSubject,
        emailContent: req.body.emailContent,
        inAppTitle: req.body.inAppTitle,
        inAppContent: req.body.inAppContent
      };
    }

    const sampleData = getSampleTestData(template.category);
    const mergedTestData = { ...sampleData, ...testData };
    const result = simulateSending(version, variables, mergedTestData);

    await AuditLog.create({
      id: uuidv4(),
      templateId: template.id,
      versionId: versionId || null,
      action: 'simulate',
      details: JSON.stringify({ channels: Object.keys(result.channels) }),
      operator: req.body.operator || 'system'
    });

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/release/gradual', async (req, res) => {
  try {
    const { versionId, strategy, targetUsers, operator } = req.body;
    const result = await releaseService.gradualRelease(
      req.params.id,
      versionId,
      { strategy, targetUsers, operator },
      models
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/release/full', async (req, res) => {
  try {
    const { versionId, operator } = req.body;
    const result = await releaseService.fullRelease(
      req.params.id,
      versionId,
      { operator },
      models
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/rollback', async (req, res) => {
  try {
    const { versionId, operator } = req.body;
    const result = await releaseService.rollback(
      req.params.id,
      versionId,
      { operator },
      models
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/release/gradual-fail', async (req, res) => {
  try {
    const { versionId, failureReason, operator } = req.body;
    const result = await releaseService.failGradualAndRollback(
      req.params.id,
      versionId,
      { failureReason, operator },
      models
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id/releases', async (req, res) => {
  try {
    const history = await releaseService.getReleaseHistory(req.params.id, models);
    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id/versions/diff', async (req, res) => {
  try {
    const { versionId1, versionId2 } = req.query;
    if (!versionId1 || !versionId2) {
      return res.status(400).json({ success: false, error: '需要指定两个版本ID' });
    }

    const diff = await releaseService.getVersionDiff(versionId1, versionId2, models);
    if (!diff) {
      return res.status(404).json({ success: false, error: '版本不存在' });
    }

    res.json({ success: true, data: diff });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id/audit', async (req, res) => {
  try {
    const logs = await AuditLog.findAll({
      where: { templateId: req.params.id },
      order: [['createdAt', 'DESC']],
      limit: 100
    });

    res.json({
      success: true,
      data: logs.map(l => ({
        id: l.id,
        action: l.action,
        details: l.details ? JSON.parse(l.details) : null,
        operator: l.operator,
        createdAt: l.createdAt
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;