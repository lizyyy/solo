const { v4: uuidv4 } = require('uuid');
const { validateTemplate, validateReleaseRules, simulateSending, getSampleTestData } = require('./validationService');

async function createVersion(templateId, versionData, { Template, TemplateVersion, VariableDictionary, sequelize }) {
  return sequelize.transaction(async (t) => {
    const template = await Template.findByPk(templateId, { transaction: t });
    if (!template) {
      throw new Error('模板不存在');
    }

    const existingVersions = await TemplateVersion.findAll({
      where: { templateId },
      order: [['versionNumber', 'DESC']],
      limit: 1,
      transaction: t
    });

    const latestVersion = existingVersions[0];
    const newVersionNumber = (latestVersion?.versionNumber || 0) + 1;
    const newVersion = `v${newVersionNumber}`;

    const variables = await VariableDictionary.findAll({
      where: { templateId },
      transaction: t
    });

    const variableSnapshot = JSON.stringify(variables.map(v => ({
      variableName: v.variableName,
      displayName: v.displayName,
      isRequired: v.isRequired,
      dataType: v.dataType,
      defaultValue: v.defaultValue,
      description: v.description
    })));

    const channelLimits = versionData.channelLimits || {
      sms: { maxLength: 67 },
      email: { subjectMaxLength: 100 },
      inApp: { titleMaxLength: 50 }
    };

    const version = await TemplateVersion.create({
      id: uuidv4(),
      templateId,
      version: newVersion,
      versionNumber: newVersionNumber,
      smsContent: versionData.smsContent,
      emailSubject: versionData.emailSubject,
      emailContent: versionData.emailContent,
      inAppTitle: versionData.inAppTitle,
      inAppContent: versionData.inAppContent,
      variableDictionary: variableSnapshot,
      channelLimits: JSON.stringify(channelLimits),
      status: 'draft',
      previousVersionId: latestVersion?.id || null,
      createdBy: versionData.operator || 'system'
    }, { transaction: t });

    return version;
  });
}

async function validateVersionBeforeRelease(versionId, { TemplateVersion, VariableDictionary, sequelize }) {
  const version = await TemplateVersion.findByPk(versionId);
  if (!version) {
    throw new Error('版本不存在');
  }

  const variables = JSON.parse(version.variableDictionary || '[]');
  const channelLimits = JSON.parse(version.channelLimits || '{}');

  const validation = validateTemplate(
    {
      smsContent: version.smsContent,
      emailSubject: version.emailSubject,
      emailContent: version.emailContent,
      inAppTitle: version.inAppTitle,
      inAppContent: version.inAppContent
    },
    variables,
    channelLimits
  );

  return {
    version,
    validation,
    variables,
    channelLimits
  };
}

async function gradualRelease(templateId, versionId, releaseData, models) {
  const { Template, TemplateVersion, ReleaseRecord, AuditLog, VariableDictionary, sequelize } = models;
  const operator = releaseData.operator || 'system';

  return sequelize.transaction(async (t) => {
    const template = await Template.findByPk(templateId, { transaction: t });
    if (!template) {
      throw new Error('模板不存在');
    }

    const version = await TemplateVersion.findByPk(versionId, { transaction: t });
    if (!version) {
      throw new Error('版本不存在');
    }

    const releaseRules = await validateReleaseRules(version, template, models);
    if (!releaseRules.valid) {
      return {
        success: false,
        errors: releaseRules.errors
      };
    }

    const validationResult = await validateVersionBeforeRelease(versionId, models);
    if (!validationResult.validation.valid) {
      return {
        success: false,
        errors: validationResult.validation.errors,
        validationDetails: validationResult.validation.details
      };
    }

    const sampleData = getSampleTestData(template.category);
    const simulationResult = simulateSending(version, validationResult.variables, sampleData);

    const gradualStrategy = releaseData.strategy || {
      type: 'percentage',
      value: 10
    };

    const hitUsers = [];
    if (releaseData.targetUsers && releaseData.targetUsers.length > 0) {
      hitUsers.push(...releaseData.targetUsers);
    } else if (gradualStrategy.type === 'user_list') {
      hitUsers.push(...(gradualStrategy.users || []));
    }

    const releaseRecord = await ReleaseRecord.create({
      id: uuidv4(),
      templateId,
      versionId,
      releaseType: 'gradual',
      status: 'running',
      gradualStrategy: JSON.stringify(gradualStrategy),
      targetUsers: JSON.stringify(releaseData.targetUsers || []),
      hitUsers: JSON.stringify(hitUsers),
      validationResult: JSON.stringify(validationResult.validation),
      simulationResult: JSON.stringify(simulationResult),
      operator,
      startedAt: new Date()
    }, { transaction: t });

    await TemplateVersion.update(
      { status: 'gradual', updatedAt: new Date() },
      { where: { id: versionId }, transaction: t }
    );

    await AuditLog.create({
      id: uuidv4(),
      templateId,
      versionId,
      releaseRecordId: releaseRecord.id,
      action: 'release_gradual',
      details: JSON.stringify({
        version: version.version,
        strategy: gradualStrategy,
        hitUsersCount: hitUsers.length
      }),
      operator,
      createdAt: new Date()
    }, { transaction: t });

    await ReleaseRecord.update(
      { status: 'success', completedAt: new Date() },
      { where: { id: releaseRecord.id }, transaction: t }
    );

    return {
      success: true,
      releaseRecord: {
        id: releaseRecord.id,
        type: 'gradual',
        version: version.version,
        strategy: gradualStrategy,
        hitUsers,
        validation: validationResult.validation,
        simulation: simulationResult
      }
    };
  });
}

async function fullRelease(templateId, versionId, releaseData, models) {
  const { Template, TemplateVersion, ReleaseRecord, AuditLog, sequelize } = models;
  const operator = releaseData.operator || 'system';

  return sequelize.transaction(async (t) => {
    const template = await Template.findByPk(templateId, { transaction: t });
    if (!template) {
      throw new Error('模板不存在');
    }

    const version = await TemplateVersion.findByPk(versionId, { transaction: t });
    if (!version) {
      throw new Error('版本不存在');
    }

    if (version.status !== 'gradual') {
      return {
        success: false,
        errors: ['该版本未通过灰度发布，不能直接全量发布。请先进行灰度发布并确认通过。']
      };
    }

    const releaseRules = await validateReleaseRules(version, template, models);
    if (!releaseRules.valid) {
      return {
        success: false,
        errors: releaseRules.errors
      };
    }

    const validationResult = await validateVersionBeforeRelease(versionId, models);

    const releaseRecord = await ReleaseRecord.create({
      id: uuidv4(),
      templateId,
      versionId,
      releaseType: 'full',
      status: 'running',
      validationResult: JSON.stringify(validationResult.validation),
      operator,
      startedAt: new Date()
    }, { transaction: t });

    await TemplateVersion.update(
      { status: 'full', updatedAt: new Date() },
      { where: { id: versionId }, transaction: t }
    );

    await Template.update(
      { currentVersionId: versionId, updatedAt: new Date() },
      { where: { id: templateId }, transaction: t }
    );

    await AuditLog.create({
      id: uuidv4(),
      templateId,
      versionId,
      releaseRecordId: releaseRecord.id,
      action: 'release_full',
      details: JSON.stringify({
        version: version.version,
        previousCurrentVersion: template.currentVersionId
      }),
      operator,
      createdAt: new Date()
    }, { transaction: t });

    await ReleaseRecord.update(
      { status: 'success', completedAt: new Date() },
      { where: { id: releaseRecord.id }, transaction: t }
    );

    return {
      success: true,
      releaseRecord: {
        id: releaseRecord.id,
        type: 'full',
        version: version.version
      }
    };
  });
}

async function rollback(templateId, versionId, releaseData, models) {
  const { Template, TemplateVersion, ReleaseRecord, AuditLog, sequelize } = models;
  const operator = releaseData.operator || 'system';

  return sequelize.transaction(async (t) => {
    const template = await Template.findByPk(templateId, { transaction: t });
    if (!template) {
      throw new Error('模板不存在');
    }

    const version = await TemplateVersion.findByPk(versionId, { transaction: t });
    if (!version) {
      throw new Error('版本不存在');
    }

    if (!['gradual', 'full'].includes(version.status)) {
      return {
        success: false,
        errors: ['该版本当前不处于可回滚状态（需为灰度或全量状态）']
      };
    }

    const previousVersion = version.previousVersionId 
      ? await TemplateVersion.findByPk(version.previousVersionId, { transaction: t })
      : null;

    const releaseRecord = await ReleaseRecord.create({
      id: uuidv4(),
      templateId,
      versionId,
      releaseType: 'rollback',
      status: 'running',
      operator,
      startedAt: new Date()
    }, { transaction: t });

    await TemplateVersion.update(
      { status: 'rolled_back', updatedAt: new Date() },
      { where: { id: versionId }, transaction: t }
    );

    if (previousVersion && template.currentVersionId === versionId) {
      await Template.update(
        { currentVersionId: previousVersion.id, updatedAt: new Date() },
        { where: { id: templateId }, transaction: t }
      );
    } else if (!previousVersion && template.currentVersionId === versionId) {
      await Template.update(
        { currentVersionId: null, updatedAt: new Date() },
        { where: { id: templateId }, transaction: t }
      );
    }

    await AuditLog.create({
      id: uuidv4(),
      templateId,
      versionId,
      releaseRecordId: releaseRecord.id,
      action: 'rollback',
      details: JSON.stringify({
        version: version.version,
        rollbackToVersion: previousVersion?.version || null,
        previousStatus: version.status
      }),
      operator,
      createdAt: new Date()
    }, { transaction: t });

    await ReleaseRecord.update(
      { status: 'success', completedAt: new Date() },
      { where: { id: releaseRecord.id }, transaction: t }
    );

    return {
      success: true,
      releaseRecord: {
        id: releaseRecord.id,
        type: 'rollback',
        version: version.version,
        rollbackToVersion: previousVersion?.version || null
      }
    };
  });
}

async function failGradualAndRollback(templateId, versionId, releaseData, models) {
  const { Template, TemplateVersion, ReleaseRecord, AuditLog, sequelize } = models;
  const operator = releaseData.operator || 'system';
  const failureReason = releaseData.failureReason || '灰度发布未通过';

  return sequelize.transaction(async (t) => {
    const template = await Template.findByPk(templateId, { transaction: t });
    if (!template) {
      throw new Error('模板不存在');
    }

    const version = await TemplateVersion.findByPk(versionId, { transaction: t });
    if (!version) {
      throw new Error('版本不存在');
    }

    if (version.status !== 'gradual') {
      return {
        success: false,
        errors: ['该版本不处于灰度发布状态']
      };
    }

    const previousVersion = version.previousVersionId 
      ? await TemplateVersion.findByPk(version.previousVersionId, { transaction: t })
      : null;

    const releaseRecord = await ReleaseRecord.create({
      id: uuidv4(),
      templateId,
      versionId,
      releaseType: 'gradual',
      status: 'failed',
      failureReason,
      operator,
      startedAt: new Date(),
      completedAt: new Date()
    }, { transaction: t });

    await TemplateVersion.update(
      { status: 'rolled_back', updatedAt: new Date() },
      { where: { id: versionId }, transaction: t }
    );

    if (previousVersion) {
      await AuditLog.create({
        id: uuidv4(),
        templateId,
        versionId,
        releaseRecordId: releaseRecord.id,
        action: 'rollback',
        details: JSON.stringify({
          version: version.version,
          rollbackToVersion: previousVersion.version,
          previousStatus: 'gradual',
          rollbackReason: failureReason
        }),
        operator,
        createdAt: new Date()
      }, { transaction: t });
    }

    return {
      success: true,
      releaseRecord: {
        id: releaseRecord.id,
        type: 'gradual_failed',
        version: version.version,
        rollbackToVersion: previousVersion?.version || null,
        failureReason
      }
    };
  });
}

async function getReleaseHistory(templateId, models) {
  const { ReleaseRecord, TemplateVersion, sequelize } = models;

  const releases = await ReleaseRecord.findAll({
    where: { templateId },
    include: [
      {
        model: TemplateVersion,
        as: 'version',
        attributes: ['id', 'version', 'status']
      }
    ],
    order: [['createdAt', 'DESC']]
  });

  return releases.map(r => ({
    id: r.id,
    type: r.releaseType,
    status: r.status,
    version: r.version?.version,
    versionId: r.versionId,
    strategy: r.gradualStrategy ? JSON.parse(r.gradualStrategy) : null,
    hitUsers: r.hitUsers ? JSON.parse(r.hitUsers) : [],
    validationResult: r.validationResult ? JSON.parse(r.validationResult) : null,
    simulationResult: r.simulationResult ? JSON.parse(r.simulationResult) : null,
    failureReason: r.failureReason,
    operator: r.operator,
    startedAt: r.startedAt,
    completedAt: r.completedAt,
    createdAt: r.createdAt
  }));
}

async function getVersionDiff(versionId1, versionId2, models) {
  const { TemplateVersion } = models;

  const [v1, v2] = await Promise.all([
    TemplateVersion.findByPk(versionId1),
    TemplateVersion.findByPk(versionId2)
  ]);

  if (!v1 || !v2) {
    return null;
  }

  const diff = {
    version1: {
      id: v1.id,
      version: v1.version,
      status: v1.status
    },
    version2: {
      id: v2.id,
      version: v2.version,
      status: v2.status
    },
    changes: []
  };

  const fields = ['smsContent', 'emailSubject', 'emailContent', 'inAppTitle', 'inAppContent'];
  
  fields.forEach(field => {
    const v1Val = v1[field] || '';
    const v2Val = v2[field] || '';
    
    if (v1Val !== v2Val) {
      diff.changes.push({
        field,
        version1Value: v1Val,
        version2Value: v2Val
      });
    }
  });

  const vars1 = JSON.parse(v1.variableDictionary || '[]');
  const vars2 = JSON.parse(v2.variableDictionary || '[]');
  
  if (JSON.stringify(vars1) !== JSON.stringify(vars2)) {
    diff.changes.push({
      field: 'variableDictionary',
      version1Value: vars1,
      version2Value: vars2
    });
  }

  return diff;
}

module.exports = {
  createVersion,
  validateVersionBeforeRelease,
  gradualRelease,
  fullRelease,
  rollback,
  failGradualAndRollback,
  getReleaseHistory,
  getVersionDiff
};