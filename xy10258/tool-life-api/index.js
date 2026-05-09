const http = require('http');
const url = require('url');

const SHIFTS = ['morning', 'afternoon', 'night'];
const MATERIALS = ['steel', 'aluminum', 'titanium', 'cast_iron'];
const TOOL_TYPES = ['mill', 'drill', 'end_mill', 'ball_nose'];

const store = {
  tools: {},
  lifeRules: {},
  records: {},
  breakRecords: {},
  issues: [],
  idempotency: {},
  nextIds: {
    tool: 1,
    rule: 1,
    record: 1,
    break: 1,
    issue: 1
  }
};

function generateId(type) {
  return `${type}_${store.nextIds[type]++}`;
}

function timestamp() {
  return new Date().toISOString();
}

function validateFields(obj, required, source) {
  const missing = required.filter(f => obj[f] === undefined || obj[f] === null || obj[f] === '');
  if (missing.length > 0) {
    return { valid: false, error: `缺少必需字段: ${missing.join(', ')}`, source };
  }
  return { valid: true };
}

function checkIdempotency(requestId, endpoint) {
  if (!requestId) return { exists: false };
  const key = `${endpoint}:${requestId}`;
  if (store.idempotency[key]) {
    return { exists: true, cached: store.idempotency[key] };
  }
  return { exists: false, key };
}

function saveIdempotency(key, result) {
  if (key) store.idempotency[key] = result;
}

function addIssue(type, description, severity, source) {
  const issue = {
    id: generateId('issue'),
    type,
    description,
    severity,
    source: JSON.stringify(source),
    status: 'open',
    createdAt: timestamp()
  };
  store.issues.push(issue);
  return issue;
}

function createTool(toolData, requestId) {
  const idemp = checkIdempotency(requestId, 'createTool');
  if (idemp.exists) return { success: true, data: idemp.cached, fromCache: true };
  
  const v = validateFields(toolData, ['code', 'type', 'baseLife'], toolData);
  if (!v.valid) {
    addIssue('validation', v.error, 'error', toolData);
    return { success: false, error: v.error, code: 'VALIDATION_ERROR' };
  }
  
  if (!TOOL_TYPES.includes(toolData.type)) {
    addIssue('validation', `无效的刀具类型: ${toolData.type}`, 'error', toolData);
    return { success: false, error: `无效的刀具类型，有效值: ${TOOL_TYPES.join(', ')}`, code: 'INVALID_TOOL_TYPE' };
  }
  
  if (typeof toolData.baseLife !== 'number' || toolData.baseLife <= 0) {
    addIssue('validation', `基础寿命必须是正数: ${toolData.baseLife}`, 'error', toolData);
    return { success: false, error: '基础寿命必须是正数', code: 'INVALID_BASE_LIFE' };
  }
  
  const tool = {
    id: generateId('tool'),
    code: toolData.code,
    type: toolData.type,
    baseLife: toolData.baseLife,
    effectiveLife: toolData.baseLife,
    consumed: 0,
    status: 'available',
    warnings: [],
    records: [],
    createdAt: timestamp()
  };
  
  store.tools[tool.id] = tool;
  saveIdempotency(idemp.key, { tool, input: toolData });
  
  return {
    success: true,
    data: {
      tool,
      input: toolData,
      ruleApplication: {
        message: '尚未应用任何寿命规则，有效寿命 = 基础寿命'
      }
    }
  };
}

function createLifeRule(ruleData, requestId) {
  const idemp = checkIdempotency(requestId, 'createLifeRule');
  if (idemp.exists) return { success: true, data: idemp.cached, fromCache: true };
  
  const v = validateFields(ruleData, ['toolType', 'material', 'shift', 'modifier'], ruleData);
  if (!v.valid) {
    addIssue('validation', v.error, 'error', ruleData);
    return { success: false, error: v.error, code: 'VALIDATION_ERROR' };
  }
  
  if (!TOOL_TYPES.includes(ruleData.toolType)) {
    addIssue('validation', `无效的刀具类型: ${ruleData.toolType}`, 'error', ruleData);
    return { success: false, error: `无效的刀具类型`, code: 'INVALID_TOOL_TYPE' };
  }
  
  if (!MATERIALS.includes(ruleData.material)) {
    addIssue('validation', `无效的材料类型: ${ruleData.material}`, 'error', ruleData);
    return { success: false, error: `无效的材料类型，有效值: ${MATERIALS.join(', ')}`, code: 'INVALID_MATERIAL' };
  }
  
  if (!SHIFTS.includes(ruleData.shift)) {
    addIssue('validation', `无效的班次: ${ruleData.shift}`, 'error', ruleData);
    return { success: false, error: `无效的班次，有效值: ${SHIFTS.join(', ')}`, code: 'INVALID_SHIFT' };
  }
  
  if (typeof ruleData.modifier !== 'number' || ruleData.modifier <= 0) {
    addIssue('validation', `修正系数必须是正数: ${ruleData.modifier}`, 'error', ruleData);
    return { success: false, error: '修正系数必须是正数', code: 'INVALID_MODIFIER' };
  }
  
  const ruleKey = `${ruleData.toolType}:${ruleData.material}:${ruleData.shift}`;
  if (store.lifeRules[ruleKey]) {
    addIssue('conflict', `寿命规则已存在: ${ruleKey}`, 'warning', ruleData);
    return { 
      success: false, 
      error: '该组合的寿命规则已存在，可使用修正接口更新', 
      code: 'RULE_EXISTS',
      existingRule: store.lifeRules[ruleKey]
    };
  }
  
  const rule = {
    id: generateId('rule'),
    toolType: ruleData.toolType,
    material: ruleData.material,
    shift: ruleData.shift,
    modifier: ruleData.modifier,
    description: ruleData.description || '',
    createdAt: timestamp()
  };
  
  store.lifeRules[ruleKey] = rule;
  saveIdempotency(idemp.key, { rule, input: ruleData });
  
  return {
    success: true,
    data: {
      rule,
      input: ruleData,
      example: {
        toolType: ruleData.toolType,
        material: ruleData.material,
        shift: ruleData.shift,
        explanation: `若基础寿命为 100 次，则该场景下有效寿命 = 100 ÷ ${ruleData.modifier} = ${(100 / ruleData.modifier).toFixed(1)} 次`
      }
    }
  };
}

function getLifeModifier(toolType, material, shift) {
  const ruleKey = `${toolType}:${material}:${shift}`;
  const rule = store.lifeRules[ruleKey];
  return rule ? rule.modifier : 1.0;
}

function calculateConsumption(toolType, material, shift, usageCount) {
  const modifier = getLifeModifier(toolType, material, shift);
  return {
    rawUsage: usageCount,
    modifier,
    adjustedConsumption: usageCount * modifier,
    formula: `消耗 = 使用次数(${usageCount}) × 修正系数(${modifier}) = ${(usageCount * modifier).toFixed(2)}`
  };
}

function updateToolWarnings(tool) {
  tool.warnings = [];
  const remaining = tool.effectiveLife - tool.consumed;
  const ratio = tool.consumed / tool.effectiveLife;
  
  if (ratio >= 1.0) {
    tool.warnings.push({
      level: 'critical',
      message: '刀具已超过有效寿命，建议立即更换',
      ratio: ratio.toFixed(2)
    });
    tool.status = 'worn_out';
  } else if (ratio >= 0.8) {
    tool.warnings.push({
      level: 'warning',
      message: `刀具已使用 ${(ratio * 100).toFixed(0)}%，接近寿命极限`,
      ratio: ratio.toFixed(2)
    });
    tool.status = 'near_end';
  } else if (ratio >= 0.5) {
    tool.warnings.push({
      level: 'info',
      message: `刀具已使用 ${(ratio * 100).toFixed(0)}%`,
      ratio: ratio.toFixed(2)
    });
  }
  
  return {
    remaining: remaining.toFixed(2),
    ratio: ratio.toFixed(4),
    effectiveLife: tool.effectiveLife,
    consumed: tool.consumed.toFixed(2)
  };
}

function createRecord(recordData, requestId) {
  const idemp = checkIdempotency(requestId, 'createRecord');
  if (idemp.exists) return { success: true, data: idemp.cached, fromCache: true };
  
  const v = validateFields(recordData, ['toolId', 'material', 'shift', 'usageCount'], recordData);
  if (!v.valid) {
    addIssue('validation', v.error, 'error', recordData);
    return { success: false, error: v.error, code: 'VALIDATION_ERROR' };
  }
  
  const tool = store.tools[recordData.toolId];
  if (!tool) {
    addIssue('reference', `刀具不存在: ${recordData.toolId}`, 'error', recordData);
    return { success: false, error: '刀具不存在', code: 'TOOL_NOT_FOUND' };
  }
  
  if (tool.status === 'broken') {
    addIssue('state', `尝试对已断刀 ${tool.id} 创建加工记录`, 'warning', recordData);
    return { success: false, error: '该刀具已断刀，无法创建新加工记录', code: 'TOOL_BROKEN' };
  }
  
  if (!MATERIALS.includes(recordData.material)) {
    addIssue('validation', `无效的材料: ${recordData.material}`, 'error', recordData);
    return { success: false, error: '无效的材料类型', code: 'INVALID_MATERIAL' };
  }
  
  if (!SHIFTS.includes(recordData.shift)) {
    addIssue('validation', `无效的班次: ${recordData.shift}`, 'error', recordData);
    return { success: false, error: '无效的班次', code: 'INVALID_SHIFT' };
  }
  
  if (typeof recordData.usageCount !== 'number' || recordData.usageCount <= 0) {
    addIssue('validation', `使用次数必须是正数: ${recordData.usageCount}`, 'error', recordData);
    return { success: false, error: '使用次数必须是正数', code: 'INVALID_USAGE' };
  }
  
  const consumption = calculateConsumption(tool.type, recordData.material, recordData.shift, recordData.usageCount);
  
  const record = {
    id: generateId('record'),
    toolId: recordData.toolId,
    material: recordData.material,
    shift: recordData.shift,
    usageCount: recordData.usageCount,
    consumption,
    status: 'active',
    createdAt: timestamp(),
    source: 'normal',
    corrections: []
  };
  
  store.records[record.id] = record;
  tool.records.push(record.id);
  tool.consumed += consumption.adjustedConsumption;
  
  const warningResult = updateToolWarnings(tool);
  
  saveIdempotency(idemp.key, {
    record,
    toolSnapshot: {
      id: tool.id,
      status: tool.status,
      consumed: tool.consumed,
      warnings: tool.warnings
    },
    input: recordData
  });
  
  return {
    success: true,
    data: {
      record,
      consumption,
      toolStatus: warningResult,
      warnings: tool.warnings,
      input: recordData
    }
  };
}

function withdrawRecord(recordId, requestId) {
  const idemp = checkIdempotency(requestId, 'withdrawRecord');
  if (idemp.exists) return { success: true, data: idemp.cached, fromCache: true };
  
  const record = store.records[recordId];
  if (!record) {
    addIssue('reference', `撤回的记录不存在: ${recordId}`, 'error', { recordId, action: 'withdraw' });
    return { success: false, error: '记录不存在', code: 'RECORD_NOT_FOUND' };
  }
  
  if (record.status === 'withdrawn') {
    addIssue('state', `记录已被撤回: ${recordId}`, 'warning', { recordId, action: 'withdraw' });
    return { 
      success: false, 
      error: '该记录已被撤回', 
      code: 'ALREADY_WITHDRAWN',
      existingRecord: record
    };
  }
  
  if (record.source === 'break') {
    addIssue('state', `断刀补录记录 ${recordId} 不可撤回`, 'warning', { recordId, action: 'withdraw' });
    return { success: false, error: '断刀补录记录不可撤回', code: 'BREAK_RECORD_NOT_WITHDRAWABLE' };
  }
  
  const tool = store.tools[record.toolId];
  if (tool) {
    tool.consumed -= record.consumption.adjustedConsumption;
    if (tool.consumed < 0) tool.consumed = 0;
    updateToolWarnings(tool);
  }
  
  const previousStatus = record.status;
  record.status = 'withdrawn';
  record.withdrawnAt = timestamp();
  record.withdrawReason = requestId ? `撤回请求: ${requestId}` : '手动撤回';
  
  saveIdempotency(idemp.key, {
    record,
    previousStatus,
    toolSnapshot: tool ? {
      id: tool.id,
      status: tool.status,
      consumed: tool.consumed
    } : null
  });
  
  return {
    success: true,
    data: {
      record,
      previousStatus,
      restoration: {
        returnedConsumption: record.consumption.adjustedConsumption.toFixed(2),
        toolStatus: tool ? updateToolWarnings(tool) : null
      }
    }
  };
}

function correctRecord(recordId, correctionData, requestId) {
  const idemp = checkIdempotency(requestId, 'correctRecord');
  if (idemp.exists) return { success: true, data: idemp.cached, fromCache: true };
  
  const record = store.records[recordId];
  if (!record) {
    addIssue('reference', `修正的记录不存在: ${recordId}`, 'error', { recordId, correctionData });
    return { success: false, error: '记录不存在', code: 'RECORD_NOT_FOUND' };
  }
  
  if (record.status === 'withdrawn') {
    addIssue('state', `已撤回的记录 ${recordId} 不可修正`, 'warning', { recordId, correctionData });
    return { success: false, error: '已撤回的记录不可修正', code: 'RECORD_WITHDRAWN' };
  }
  
  if (record.source === 'break') {
    addIssue('state', `断刀补录记录 ${recordId} 不可修正`, 'warning', { recordId, correctionData });
    return { success: false, error: '断刀补录记录不可修正', code: 'BREAK_RECORD_NOT_CORRECTABLE' };
  }
  
  const tool = store.tools[record.toolId];
  if (!tool) {
    addIssue('reference', `记录关联的刀具已不存在: ${record.toolId}`, 'error', { recordId, correctionData });
    return { success: false, error: '关联刀具不存在', code: 'TOOL_NOT_FOUND' };
  }
  
  const allowedFields = ['material', 'shift', 'usageCount'];
  const changes = {};
  for (const field of allowedFields) {
    if (correctionData[field] !== undefined) {
      if (field === 'usageCount' && (typeof correctionData[field] !== 'number' || correctionData[field] <= 0)) {
        addIssue('validation', `修正的使用次数无效: ${correctionData[field]}`, 'error', correctionData);
        return { success: false, error: '使用次数必须是正数', code: 'INVALID_USAGE' };
      }
      if ((field === 'material' || field === 'shift') && 
          ((field === 'material' && !MATERIALS.includes(correctionData[field])) ||
           (field === 'shift' && !SHIFTS.includes(correctionData[field])))) {
        addIssue('validation', `修正的${field}无效: ${correctionData[field]}`, 'error', correctionData);
        return { success: false, error: `无效的${field}`, code: 'INVALID_VALUE' };
      }
      changes[field] = { before: record[field], after: correctionData[field] };
    }
  }
  
  if (Object.keys(changes).length === 0) {
    addIssue('validation', '修正请求未包含任何有效字段', 'warning', correctionData);
    return { success: false, error: '未指定要修正的字段', code: 'NO_CHANGES' };
  }
  
  const beforeConsumption = record.consumption.adjustedConsumption;
  
  record.corrections.push({
    changes,
    correctedAt: timestamp(),
    requestId: requestId || null
  });
  
  for (const field in changes) {
    record[field] = changes[field].after;
  }
  
  const newConsumption = calculateConsumption(tool.type, record.material, record.shift, record.usageCount);
  record.consumption = newConsumption;
  
  const diff = newConsumption.adjustedConsumption - beforeConsumption;
  tool.consumed += diff;
  if (tool.consumed < 0) tool.consumed = 0;
  
  const warningResult = updateToolWarnings(tool);
  
  saveIdempotency(idemp.key, {
    record,
    diff,
    toolSnapshot: {
      id: tool.id,
      consumed: tool.consumed,
      status: tool.status
    }
  });
  
  return {
    success: true,
    data: {
      record,
      changes,
      consumptionDiff: diff.toFixed(2),
      beforeConsumption: beforeConsumption.toFixed(2),
      afterConsumption: newConsumption.adjustedConsumption.toFixed(2),
      toolStatus: warningResult,
      warnings: tool.warnings
    }
  };
}

function recordBreakAndBackfill(breakData, requestId) {
  const idemp = checkIdempotency(requestId, 'recordBreak');
  if (idemp.exists) return { success: true, data: idemp.cached, fromCache: true };
  
  const v = validateFields(breakData, ['toolId', 'totalUsageAtBreak', 'material', 'shift'], breakData);
  if (!v.valid) {
    addIssue('validation', v.error, 'error', breakData);
    return { success: false, error: v.error, code: 'VALIDATION_ERROR' };
  }
  
  const tool = store.tools[breakData.toolId];
  if (!tool) {
    addIssue('reference', `断刀记录的刀具不存在: ${breakData.toolId}`, 'error', breakData);
    return { success: false, error: '刀具不存在', code: 'TOOL_NOT_FOUND' };
  }
  
  if (tool.status === 'broken') {
    addIssue('state', `刀具 ${tool.id} 已标记为断刀，重复记录`, 'warning', breakData);
    return { 
      success: false, 
      error: '该刀具已被标记为断刀', 
      code: 'ALREADY_BROKEN',
      existingBreak: store.breakRecords[tool.id]
    };
  }
  
  if (typeof breakData.totalUsageAtBreak !== 'number' || breakData.totalUsageAtBreak <= 0) {
    addIssue('validation', `断刀时累计使用次数无效: ${breakData.totalUsageAtBreak}`, 'error', breakData);
    return { success: false, error: '累计使用次数必须是正数', code: 'INVALID_TOTAL_USAGE' };
  }
  
  if (!MATERIALS.includes(breakData.material)) {
    addIssue('validation', `断刀时加工材料无效: ${breakData.material}`, 'error', breakData);
    return { success: false, error: '无效的材料类型', code: 'INVALID_MATERIAL' };
  }
  
  if (!SHIFTS.includes(breakData.shift)) {
    addIssue('validation', `断刀时班次无效: ${breakData.shift}`, 'error', breakData);
    return { success: false, error: '无效的班次', code: 'INVALID_SHIFT' };
  }
  
  let recordedUsage = 0;
  for (const recordId of tool.records) {
    const r = store.records[recordId];
    if (r && r.status === 'active') {
      recordedUsage += r.usageCount;
    }
  }
  
  const missingUsage = breakData.totalUsageAtBreak - recordedUsage;
  const backfillRecords = [];
  
  if (missingUsage > 0) {
    const consumption = calculateConsumption(tool.type, breakData.material, breakData.shift, missingUsage);
    const backfillRecord = {
      id: generateId('record'),
      toolId: tool.id,
      material: breakData.material,
      shift: breakData.shift,
      usageCount: missingUsage,
      consumption,
      status: 'active',
      createdAt: timestamp(),
      source: 'break',
      backfillReason: '断刀补录',
      breakRequestId: requestId
    };
    store.records[backfillRecord.id] = backfillRecord;
    tool.records.push(backfillRecord.id);
    tool.consumed += consumption.adjustedConsumption;
    backfillRecords.push(backfillRecord);
    
    addIssue(
      'backfill',
      `刀具 ${tool.id} 断刀补录 ${missingUsage} 次使用记录`,
      'warning',
      { breakData, recordedUsage, missingUsage }
    );
  } else if (missingUsage < 0) {
    addIssue(
      'discrepancy',
      `断刀累计次数(${breakData.totalUsageAtBreak}) < 已记录次数(${recordedUsage})，差异 ${Math.abs(missingUsage)} 次`,
      'error',
      { breakData, recordedUsage, missingUsage }
    );
  }
  
  const breakRecord = {
    id: generateId('break'),
    toolId: tool.id,
    breakTime: timestamp(),
    totalUsageAtBreak: breakData.totalUsageAtBreak,
    material: breakData.material,
    shift: breakData.shift,
    recordedUsage,
    missingUsage,
    backfillRecordIds: backfillRecords.map(r => r.id),
    requestId: requestId || null
  };
  
  store.breakRecords[tool.id] = breakRecord;
  
  tool.status = 'broken';
  tool.breakRecordId = breakRecord.id;
  tool.warnings = [{
    level: 'critical',
    message: '刀具已断刀'
  }];
  
  saveIdempotency(idemp.key, {
    breakRecord,
    backfillRecords,
    toolSnapshot: {
      id: tool.id,
      status: 'broken',
      consumed: tool.consumed,
      recordedUsage,
      totalUsageAtBreak: breakData.totalUsageAtBreak
    }
  });
  
  return {
    success: true,
    data: {
      breakRecord,
      backfillRecords,
      comparison: {
        recordedUsage,
        reportedAtBreak: breakData.totalUsageAtBreak,
        missingUsage,
        action: missingUsage > 0 ? '已补录' : missingUsage < 0 ? '存在矛盾' : '一致'
      },
      input: breakData
    }
  };
}

function getTool(toolId) {
  const tool = store.tools[toolId];
  if (!tool) {
    return { success: false, error: '刀具不存在', code: 'TOOL_NOT_FOUND' };
  }
  
  const records = tool.records.map(id => store.records[id]).filter(Boolean);
  const breakRecord = tool.breakRecordId ? store.breakRecords[tool.breakRecordId] : null;
  
  return {
    success: true,
    data: {
      tool,
      records,
      breakRecord,
      analysis: {
        effectiveLife: tool.effectiveLife,
        consumed: tool.consumed.toFixed(2),
        remaining: Math.max(0, tool.effectiveLife - tool.consumed).toFixed(2),
        usageRatio: (tool.consumed / tool.effectiveLife * 100).toFixed(1) + '%'
      }
    }
  };
}

function getSummary() {
  const tools = Object.values(store.tools);
  const rules = Object.values(store.lifeRules);
  const records = Object.values(store.records);
  const breaks = Object.values(store.breakRecords);
  
  const summary = {
    tools: {
      total: tools.length,
      byStatus: {
        available: tools.filter(t => t.status === 'available').length,
        in_use: tools.filter(t => t.status === 'near_end').length,
        critical: tools.filter(t => t.status === 'worn_out').length,
        broken: tools.filter(t => t.status === 'broken').length
      },
      withWarnings: tools.filter(t => t.warnings.length > 0).map(t => ({
        id: t.id,
        code: t.code,
        status: t.status,
        warnings: t.warnings
      }))
    },
    records: {
      total: records.length,
      byStatus: {
        active: records.filter(r => r.status === 'active').length,
        withdrawn: records.filter(r => r.status === 'withdrawn').length,
        fromBreak: records.filter(r => r.source === 'break').length
      },
      totalRawUsage: records.reduce((sum, r) => r.status === 'active' ? sum + r.usageCount : sum, 0),
      totalAdjustedConsumption: records.reduce((sum, r) => 
        r.status === 'active' ? sum + r.consumption.adjustedConsumption : sum, 0
      ).toFixed(2)
    },
    lifeRules: {
      total: rules.length,
      byToolType: {}
    },
    breaks: {
      total: breaks.length,
      withBackfill: breaks.filter(b => b.backfillRecordIds.length > 0).length
    },
    issues: {
      total: store.issues.length,
      open: store.issues.filter(i => i.status === 'open').length,
      byType: {}
    }
  };
  
  for (const rule of rules) {
    if (!summary.lifeRules.byToolType[rule.toolType]) {
      summary.lifeRules.byToolType[rule.toolType] = [];
    }
    summary.lifeRules.byToolType[rule.toolType].push({
      material: rule.material,
      shift: rule.shift,
      modifier: rule.modifier
    });
  }
  
  for (const issue of store.issues) {
    if (!summary.issues.byType[issue.type]) {
      summary.issues.byType[issue.type] = 0;
    }
    summary.issues.byType[issue.type]++;
  }
  
  return { success: true, data: summary };
}

function getIssues() {
  return { success: true, data: store.issues };
}

const routes = {
  'POST:/api/tools': (body, reqId) => createTool(body, reqId),
  'POST:/api/rules': (body, reqId) => createLifeRule(body, reqId),
  'POST:/api/records': (body, reqId) => createRecord(body, reqId),
  'POST:/api/records/:id/withdraw': (body, reqId, params) => withdrawRecord(params.id, reqId),
  'POST:/api/records/:id/correct': (body, reqId, params) => correctRecord(params.id, body, reqId),
  'POST:/api/breaks': (body, reqId) => recordBreakAndBackfill(body, reqId),
  'GET:/api/tools/:id': (body, reqId, params) => getTool(params.id),
  'GET:/api/summary': () => getSummary(),
  'GET:/api/issues': () => getIssues(),
  'GET:/api/tools': () => ({ success: true, data: Object.values(store.tools) }),
  'GET:/api/rules': () => ({ success: true, data: Object.values(store.lifeRules) }),
  'GET:/api/records': () => ({ success: true, data: Object.values(store.records) }),
  'GET:/api/breaks': () => ({ success: true, data: Object.values(store.breakRecords) })
};

function matchRoute(method, path) {
  for (const pattern of Object.keys(routes)) {
    const [routeMethod, routePath] = pattern.split(':');
    if (method !== routeMethod) continue;
    
    const routeParts = routePath.split('/');
    const pathParts = path.split('/');
    
    if (routeParts.length !== pathParts.length) continue;
    
    const params = {};
    let match = true;
    
    for (let i = 0; i < routeParts.length; i++) {
      if (routeParts[i].startsWith(':')) {
        params[routeParts[i].slice(1)] = pathParts[i];
      } else if (routeParts[i] !== pathParts[i]) {
        match = false;
        break;
      }
    }
    
    if (match) {
      return { handler: routes[pattern], params };
    }
  }
  return null;
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;
  const requestId = req.headers['x-request-id'] || parsedUrl.query.requestId;
  
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('X-Request-Id', requestId || 'none');
  
  try {
    const match = matchRoute(req.method, path);
    
    if (!match) {
      res.statusCode = 404;
      res.end(JSON.stringify({ 
        success: false, 
        error: '路由不存在', 
        code: 'ROUTE_NOT_FOUND',
        availableRoutes: Object.keys(routes)
      }));
      return;
    }
    
    const body = req.method === 'GET' ? {} : await parseBody(req);
    const result = match.handler(body, requestId, match.params);
    
    res.statusCode = result.success ? 200 : 400;
    res.end(JSON.stringify(result, null, 2));
    
  } catch (e) {
    addIssue('system', `服务器内部错误: ${e.message}`, 'error', { url: req.url, method: req.method });
    res.statusCode = 500;
    res.end(JSON.stringify({ 
      success: false, 
      error: '服务器内部错误', 
      code: 'INTERNAL_ERROR',
      message: e.message
    }));
  }
});

const PORT = 3000;
if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`\n════════════════════════════════════════════════════════`);
    console.log(`  车间刀具寿命预警 API 已启动`);
    console.log(`  端口: ${PORT}`);
    console.log(`════════════════════════════════════════════════════════`);
    console.log(`\n  可用接口:`);
    console.log(`  ────────────────────────────────────────────────────`);
    console.log(`  POST /api/tools        - 创建刀具档案`);
    console.log(`  POST /api/rules        - 创建寿命规则`);
    console.log(`  POST /api/records      - 提交加工记录`);
    console.log(`  POST /api/records/:id/withdraw  - 撤回记录`);
    console.log(`  POST /api/records/:id/correct   - 修正记录`);
    console.log(`  POST /api/breaks       - 断刀补录`);
    console.log(`  GET  /api/tools/:id    - 查询刀具详情`);
    console.log(`  GET  /api/tools        - 查询所有刀具`);
    console.log(`  GET  /api/summary      - 查询汇总`);
    console.log(`  GET  /api/issues       - 查询问题列表`);
    console.log(`\n  使用 X-Request-Id 头确保幂等性`);
    console.log(`  所有脏数据都进入 /api/issues，不静默跳过`);
    console.log(`\n════════════════════════════════════════════════════════\n`);
  });
}

module.exports = {
  server,
  createTool,
  createLifeRule,
  createRecord,
  withdrawRecord,
  correctRecord,
  recordBreakAndBackfill,
  getTool,
  getSummary,
  getIssues,
  store,
  SHIFTS,
  MATERIALS,
  TOOL_TYPES,
  getLifeModifier,
  calculateConsumption
};