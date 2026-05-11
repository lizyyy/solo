const crypto = require('crypto');
const {
  BillImport,
  BillRecord,
  SharedAllocation,
  Project,
  TagRule,
  SharedService,
  AllocationRatio,
  Anomaly,
  ManualAssignment,
} = require('../db/models');

function calculateFileHash(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function parseTags(tagString) {
  if (!tagString) return null;
  
  try {
    if (typeof tagString === 'object') return tagString;
    const parsed = JSON.parse(tagString);
    return parsed;
  } catch {
    const tags = {};
    const pairs = tagString.split(/[,;]/);
    pairs.forEach((pair) => {
      const [key, value] = pair.split(/[:=]/).map((s) => s.trim());
      if (key && value) {
        tags[key] = value;
      }
    });
    return Object.keys(tags).length > 0 ? tags : null;
  }
}

function matchTagRule(tags, rule) {
  if (!tags || !tags[rule.tagKey]) return false;
  
  const tagValue = String(tags[rule.tagKey]).toLowerCase();
  const ruleValue = String(rule.tagValue).toLowerCase();
  
  switch (rule.matchType) {
    case 'exact':
      return tagValue === ruleValue;
    case 'contains':
      return tagValue.includes(ruleValue);
    case 'starts_with':
      return tagValue.startsWith(ruleValue);
    case 'regex':
      try {
        const regex = new RegExp(ruleValue, 'i');
        return regex.test(tagValue);
      } catch {
        return false;
      }
    default:
      return tagValue === ruleValue;
  }
}

async function identifyProjectByTags(tags) {
  if (!tags || Object.keys(tags).length === 0) return null;

  const rules = await TagRule.findAll({
    where: { isActive: true },
    include: [{ model: Project, as: 'project', where: { isActive: true } }],
    order: [['priority', 'DESC']],
  });

  const matches = [];
  for (const rule of rules) {
    if (matchTagRule(tags, rule)) {
      matches.push({
        projectId: rule.projectId,
        projectName: rule.project?.name,
        rulePriority: rule.priority,
        matchedRule: rule,
      });
    }
  }

  if (matches.length === 0) return null;
  
  if (matches.length === 1) {
    return { type: 'single', projectId: matches[0].projectId, candidates: matches };
  }

  const uniqueProjects = [...new Set(matches.map((m) => m.projectId))];
  if (uniqueProjects.length === 1) {
    return { type: 'single', projectId: uniqueProjects[0], candidates: matches };
  }

  return { type: 'conflict', projectId: null, candidates: matches };
}

async function identifySharedService(tags) {
  if (!tags || Object.keys(tags).length === 0) return null;

  const services = await SharedService.findAll({ where: { isActive: true } });

  for (const service of services) {
    const tagValue = tags[service.tagKey];
    if (tagValue && String(tagValue).toLowerCase() === String(service.tagValue).toLowerCase()) {
      return service;
    }
  }

  return null;
}

function suggestCandidates(tags, resourceName, resourceType) {
  const candidates = [];
  const keywords = [];

  if (resourceName) {
    keywords.push(...resourceName.toLowerCase().split(/[-_\s]+/));
  }
  if (resourceType) {
    keywords.push(resourceType.toLowerCase());
  }
  if (tags) {
    Object.values(tags).forEach((v) => {
      if (typeof v === 'string') {
        keywords.push(...v.toLowerCase().split(/[-_\s,]+/));
      }
    });
  }

  const commonKeywords = {
    ecommerce: ['电商', 'ecom', 'ecommerce', 'shop', '商城', '交易'],
    dataplatform: ['数据', 'data', '分析', 'analysis', 'platform', '平台'],
    crm: ['客户', 'crm', '销售', 'sale', '关系'],
    gateway: ['网关', 'gateway', 'api', '入口'],
    monitor: ['监控', 'monitor', '告警', 'alert', 'prometheus'],
  };

  for (const [key, words] of Object.entries(commonKeywords)) {
    const score = keywords.filter((k) => words.some((w) => k.includes(w) || w.includes(k))).length;
    if (score > 0) {
      candidates.push({ key, score, reason: `匹配关键词: ${words.join(', ')}` });
    }
  }

  if (candidates.length === 0) {
    candidates.push({ key: 'unknown', score: 0, reason: '无法匹配已知项目' });
  }

  return candidates.sort((a, b) => b.score - a.score);
}

async function processBillRecord(recordData, billImportId, billMonth) {
  const tags = parseTags(recordData.tags);
  
  const result = {
    record: null,
    anomalies: [],
    allocations: [],
  };

  const sharedService = await identifySharedService(tags);
  const projectMatch = await identifyProjectByTags(tags);

  const record = {
    billImportId,
    billMonth,
    resourceId: recordData.resourceId || recordData.ResourceId || recordData.InstanceId,
    resourceName: recordData.resourceName || recordData.ResourceName || recordData.InstanceName,
    resourceType: recordData.resourceType || recordData.ResourceType,
    productCode: recordData.productCode || recordData.ProductCode,
    productName: recordData.productName || recordData.ProductName,
    region: recordData.region || recordData.Region,
    usageAmount: parseFloat(recordData.usageAmount || recordData.UsageAmount || 0),
    usageUnit: recordData.usageUnit || recordData.UsageUnit,
    costAmount: parseFloat(recordData.costAmount || recordData.CostAmount || recordData.Amount || 0),
    tags,
    allocationMethod: 'unallocated',
    environment: tags?.Environment || tags?.environment,
  };

  if (!tags || Object.keys(tags).length === 0) {
    result.anomalies.push({
      anomalyType: 'no_tags',
      billMonth,
      severity: 'high',
      description: `资源 ${record.resourceName || record.resourceId} 没有任何标签`,
      details: {
        resourceId: record.resourceId,
        resourceName: record.resourceName,
        costAmount: record.costAmount,
        suggestedCandidates: suggestCandidates(tags, record.resourceName, record.resourceType),
      },
    });
  } else if (projectMatch?.type === 'conflict') {
    result.anomalies.push({
      anomalyType: 'tag_conflict',
      billMonth,
      severity: 'medium',
      description: `资源 ${record.resourceName || record.resourceId} 存在标签冲突`,
      details: {
        resourceId: record.resourceId,
        resourceName: record.resourceName,
        tags,
        conflictingProjects: projectMatch.candidates.map((c) => c.projectId),
        suggestedCandidates: projectMatch.candidates,
      },
    });
  }

  if (sharedService) {
    record.allocationMethod = 'shared_service';
    record.sharedServiceId = sharedService.id;

    const ratios = await AllocationRatio.findAll({
      where: {
        sharedServiceId: sharedService.id,
        effectiveMonth: billMonth,
        isActive: true,
      },
      include: [{ model: Project, as: 'project' }],
    });

    const totalRatio = ratios.reduce((sum, r) => sum + parseFloat(r.ratio), 0);
    if (Math.abs(totalRatio - 1) > 0.001) {
      result.anomalies.push({
        anomalyType: 'allocation_ratio_invalid',
        sharedServiceId: sharedService.id,
        billMonth,
        severity: 'medium',
        description: `共享服务 ${sharedService.name} 分摊比例总和不为100%`,
        details: {
          totalRatio: parseFloat(totalRatio.toFixed(4)),
          ratios: ratios.map((r) => ({
            projectName: r.project?.name,
            ratio: parseFloat(r.ratio),
          })),
        },
      });
    }

    result.allocations = ratios.map((r) => ({
      sharedServiceId: sharedService.id,
      projectId: r.projectId,
      ratio: parseFloat(r.ratio),
      allocatedAmount: parseFloat((record.costAmount * r.ratio).toFixed(2)),
      billMonth,
    }));

    if (totalRatio > 1.0001) {
      result.anomalies.push({
        anomalyType: 'allocation_over_total',
        sharedServiceId: sharedService.id,
        billMonth,
        severity: 'high',
        description: `共享服务 ${sharedService.name} 分摊比例超过100%`,
        details: {
          totalRatio: parseFloat(totalRatio.toFixed(4)),
          overAmount: parseFloat(((totalRatio - 1) * record.costAmount).toFixed(2)),
        },
      });
    }
  } else if (projectMatch?.type === 'single') {
    record.allocationMethod = 'auto_tag';
    record.projectId = projectMatch.projectId;
  } else {
    result.anomalies.push({
      anomalyType: 'no_tags',
      billMonth,
      severity: 'medium',
      description: `资源 ${record.resourceName || record.resourceId} 无法通过标签匹配项目`,
      details: {
        resourceId: record.resourceId,
        resourceName: record.resourceName,
        tags,
        suggestedCandidates: suggestCandidates(tags, record.resourceName, record.resourceType),
      },
    });
  }

  result.record = record;
  return result;
}

async function importBillRecords(records, importInfo, userId) {
  const { fileName, fileBuffer, billMonth, cloudProvider } = importInfo;
  const fileHash = calculateFileHash(fileBuffer);

  const existingImport = await BillImport.findOne({
    where: { fileHash, status: { $ne: 'duplicate' } },
  });

  if (existingImport) {
    return {
      success: false,
      isDuplicate: true,
      message: '该账单文件已导入过',
      existingImport: {
        id: existingImport.id,
        fileName: existingImport.fileName,
        billMonth: existingImport.billMonth,
        importedAt: existingImport.createdAt,
      },
    };
  }

  const billImport = await BillImport.create({
    fileName,
    fileHash,
    billMonth,
    cloudProvider: cloudProvider || 'other',
    totalRecords: records.length,
    totalAmount: records.reduce((sum, r) => sum + parseFloat(r.costAmount || r.CostAmount || r.Amount || 0), 0),
    status: 'processing',
    importedBy: userId,
  });

  const allAnomalies = [];
  const allAllocations = [];
  const processedRecords = [];

  for (const recordData of records) {
    const result = await processBillRecord(recordData, billImport.id, billMonth);
    if (result.record) {
      processedRecords.push(result.record);
    }
    if (result.anomalies.length > 0) {
      allAnomalies.push(...result.anomalies.map((a) => ({ ...a, billImportId: billImport.id })));
    }
    if (result.allocations.length > 0) {
      allAllocations.push(...result.allocations);
    }
  }

  const createdRecords = await BillRecord.bulkCreate(processedRecords, { returning: true });

  const allocationMap = new Map();
  allAllocations.forEach((alloc, index) => {
    allocationMap.set(index, alloc);
  });

  const finalAllocations = [];
  let allocIndex = 0;
  
  for (let i = 0; i < createdRecords.length; i++) {
    const record = createdRecords[i];
    if (record.allocationMethod === 'shared_service') {
      for (let j = 0; j < 3; j++) {
        const alloc = allAllocations[allocIndex];
        if (alloc) {
          finalAllocations.push({
            ...alloc,
            billRecordId: record.id,
          });
          allocIndex++;
        }
      }
    }
  }

  if (finalAllocations.length > 0) {
    await SharedAllocation.bulkCreate(finalAllocations);
  }

  const anomaliesWithRecordIds = allAnomalies.map((a, index) => {
    const record = createdRecords[index];
    if (record && !a.billRecordId) {
      return { ...a, billRecordId: record.id };
    }
    return a;
  });

  if (anomaliesWithRecordIds.length > 0) {
    await Anomaly.bulkCreate(anomaliesWithRecordIds);
  }

  await billImport.update({ status: 'completed' });

  return {
    success: true,
    billImport,
    totalRecords: createdRecords.length,
    totalAnomalies: anomaliesWithRecordIds.length,
    totalAllocations: finalAllocations.length,
  };
}

async function manualAssignRecord(billRecordId, projectId, userId, reason) {
  const record = await BillRecord.findByPk(billRecordId);
  if (!record) {
    return { success: false, message: '账单记录不存在' };
  }

  const previousProjectId = record.projectId;
  const previousMethod = record.allocationMethod;

  await BillRecord.update(
    {
      projectId,
      allocationMethod: 'manual',
    },
    { where: { id: billRecordId } }
  );

  await ManualAssignment.create({
    billRecordId,
    projectId,
    assignedBy: userId,
    reason,
    previousProjectId,
    previousMethod,
  });

  await Anomaly.update(
    {
      status: 'resolved',
      resolvedBy: userId,
      resolvedAt: new Date(),
      resolutionNote: `已人工分配到项目`,
    },
    { where: { billRecordId, status: 'open' } }
  );

  return { success: true, message: '人工分配成功' };
}

module.exports = {
  calculateFileHash,
  parseTags,
  identifyProjectByTags,
  identifySharedService,
  suggestCandidates,
  processBillRecord,
  importBillRecords,
  manualAssignRecord,
};
