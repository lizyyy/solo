const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const path = require('path');
const fs = require('fs');
const { Authorization, AuthorizationStatus } = require('../models/Authorization');
const { Material } = require('../models/Material');
const { RegionRule } = require('../models/RegionRule');
const { RemovalRecord, RemovalReason } = require('../models/RemovalRecord');
const RuleEvaluationLog = require('../models/RuleEvaluationLog');

class ExportService {
  constructor() {
    this.exportDir = path.join(process.cwd(), 'exports');
    this.ensureExportDir();
  }

  ensureExportDir() {
    if (!fs.existsSync(this.exportDir)) {
      fs.mkdirSync(this.exportDir, { recursive: true });
    }
  }

  async exportAuthorizationList(materialId = null) {
    const where = {};
    if (materialId) {
      where.materialId = materialId;
    }

    const authorizations = await Authorization.findAll({
      where,
      order: [['createdAt', 'DESC']]
    });

    const records = [];
    for (const auth of authorizations) {
      const material = await Material.findByPk(auth.materialId);
      const regionRules = await RegionRule.findAll({
        where: { authorizationId: auth.id },
        order: [['priority', 'DESC']]
      });

      const includeRegions = regionRules
        .filter(r => r.ruleType === 'include')
        .map(r => `${r.regionCode}(${r.regionName})`)
        .join('; ');
      const excludeRegions = regionRules
        .filter(r => r.ruleType === 'exclude')
        .map(r => `${r.regionCode}(${r.regionName})`)
        .join('; ');

      records.push({
        authorizationCode: auth.authorizationCode,
        materialCode: material ? material.materialCode : '',
        materialName: material ? material.materialName : '',
        copyrightOwner: material ? material.copyrightOwner : '',
        channelName: auth.channelName,
        scope: auth.scope,
        scopeDescription: auth.scopeDescription || '',
        effectiveDate: auth.effectiveDate,
        expirationDate: auth.expirationDate,
        status: auth.status,
        includeRegions: includeRegions || '无限制',
        excludeRegions: excludeRegions || '无',
        revokedAt: auth.revokedAt || '',
        revokedBy: auth.revokedBy || '',
        revocationReason: auth.revocationReason || ''
      });
    }

    const filename = `authorization-list-${Date.now()}.csv`;
    const filepath = path.join(this.exportDir, filename);

    const csvWriter = createCsvWriter({
      path: filepath,
      header: [
        { id: 'authorizationCode', title: '授权编号' },
        { id: 'materialCode', title: '素材编号' },
        { id: 'materialName', title: '素材名称' },
        { id: 'copyrightOwner', title: '版权方' },
        { id: 'channelName', title: '分发渠道' },
        { id: 'scope', title: '授权范围' },
        { id: 'scopeDescription', title: '范围说明' },
        { id: 'effectiveDate', title: '生效日期' },
        { id: 'expirationDate', title: '到期日期' },
        { id: 'status', title: '授权状态' },
        { id: 'includeRegions', title: '允许地区' },
        { id: 'excludeRegions', title: '禁止地区' },
        { id: 'revokedAt', title: '撤销时间' },
        { id: 'revokedBy', title: '撤销人' },
        { id: 'revocationReason', title: '撤销原因' }
      ]
    });

    await csvWriter.writeRecords(records);

    return {
      filename,
      filepath,
      recordCount: records.length,
      description: '授权清单用于业务复查和审计，包含每个授权的完整信息'
    };
  }

  async exportRemovalAudit(materialId = null) {
    const where = {};
    if (materialId) {
      where.materialId = materialId;
    }

    const removals = await RemovalRecord.findAll({
      where,
      order: [['createdAt', 'DESC']]
    });

    const records = [];
    for (const removal of removals) {
      const auth = await Authorization.findByPk(removal.authorizationId);
      const material = auth ? await Material.findByPk(auth.materialId) : null;
      const reasonText = {
        [RemovalReason.EXPIRED]: '到期自动下架',
        [RemovalReason.REVOKED]: '授权撤销下架',
        [RemovalReason.REGION_VIOLATION]: '地域违规下架',
        [RemovalReason.MANUAL]: '手动下架'
      }[removal.reason] || removal.reason;

      let ruleDetails = '';
      if (removal.ruleEvaluationResult) {
        try {
          const evalResult = JSON.parse(removal.ruleEvaluationResult);
          if (evalResult.evaluationSteps) {
            ruleDetails = evalResult.evaluationSteps
              .map(step => `[${step.stepName}] ${step.result ? '通过' : '失败'}: ${JSON.stringify(step.details)}`)
              .join(' | ');
          }
        } catch (e) {
          ruleDetails = removal.ruleEvaluationResult;
        }
      }

      records.push({
        removalCode: removal.removalCode,
        authorizationCode: auth ? auth.authorizationCode : '',
        materialCode: material ? material.materialCode : '',
        materialName: material ? material.materialName : '',
        channelName: auth ? auth.channelName : '',
        reason: reasonText,
        reasonDetail: removal.reasonDetail || '',
        ruleDetails,
        status: removal.status,
        executedAt: removal.executedAt || '',
        executedBy: removal.executedBy || '',
        createdAt: removal.createdAt
      });
    }

    const filename = `removal-audit-${Date.now()}.csv`;
    const filepath = path.join(this.exportDir, filename);

    const csvWriter = createCsvWriter({
      path: filepath,
      header: [
        { id: 'removalCode', title: '下架编号' },
        { id: 'authorizationCode', title: '授权编号' },
        { id: 'materialCode', title: '素材编号' },
        { id: 'materialName', title: '素材名称' },
        { id: 'channelName', title: '渠道' },
        { id: 'reason', title: '下架原因' },
        { id: 'reasonDetail', title: '详细原因' },
        { id: 'ruleDetails', title: '规则执行详情' },
        { id: 'status', title: '执行状态' },
        { id: 'executedAt', title: '执行时间' },
        { id: 'executedBy', title: '执行人' },
        { id: 'createdAt', title: '创建时间' }
      ]
    });

    await csvWriter.writeRecords(records);

    return {
      filename,
      filepath,
      recordCount: records.length,
      description: '下架审计清单用于复查下架原因和规则执行过程'
    };
  }

  async exportRuleEvaluationHistory(authorizationId) {
    const logs = await RuleEvaluationLog.findAll({
      where: { authorizationId },
      order: [['evaluatedAt', 'DESC']]
    });

    const records = [];
    for (const log of logs) {
      let stepsSummary = '';
      try {
        const steps = JSON.parse(log.evaluationSteps);
        stepsSummary = steps
          .map((step, idx) => `${idx + 1}.${step.stepName}:${step.result ? '✓' : '✗'}`)
          .join(' | ');
      } catch (e) {
        stepsSummary = log.evaluationSteps;
      }

      records.push({
        evaluationType: log.evaluationType,
        evaluatedAt: log.evaluatedAt,
        finalResult: log.finalResult,
        triggeredAction: log.triggeredAction || '无',
        stepsSummary
      });
    }

    const filename = `rule-history-${authorizationId}-${Date.now()}.csv`;
    const filepath = path.join(this.exportDir, filename);

    const csvWriter = createCsvWriter({
      path: filepath,
      header: [
        { id: 'evaluationType', title: '评估类型' },
        { id: 'evaluatedAt', title: '评估时间' },
        { id: 'finalResult', title: '最终结果' },
        { id: 'triggeredAction', title: '触发动作' },
        { id: 'stepsSummary', title: '执行步骤摘要' }
      ]
    });

    await csvWriter.writeRecords(records);

    return {
      filename,
      filepath,
      recordCount: records.length,
      description: '规则评估历史用于追溯每次检查的决策过程'
    };
  }
}

module.exports = ExportService;
