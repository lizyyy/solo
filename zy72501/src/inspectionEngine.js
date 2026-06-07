const {
  generateId,
  saveInspectionRecord,
  saveExportResult,
  savePhoneMaskIssue,
  addAuditLog,
  getDesensitizationRules,
  getGrayBatches
} = require('./models');

const PHONE_REGEX = /1[3-9]\d{9}/g;

function detectPhoneNumbers(text) {
  if (!text) return [];
  const matches = text.match(PHONE_REGEX);
  return matches || [];
}

function isPhoneMasked(phone) {
  return phone.includes('*') || phone.includes('x') || phone.includes('X');
}

function analyzeCitationGaps(rule, batches) {
  const gaps = [];
  const relatedBatches = batches.filter(b => b.relatedRuleId === rule.id);
  
  if (relatedBatches.length === 0) {
    gaps.push({
      type: 'missing_gray_batch',
      severity: 'high',
      description: '该脱敏规则尚未关联任何灰度批次现场说法',
      missing: '灰度批次现场说法证据',
      nextStep: '请算法运营老唐补录对应灰度批次',
      owner: '算法运营老唐'
    });
  }

  if (!rule.remark || !rule.mainProcess) {
    gaps.push({
      type: 'missing_rule_remark',
      severity: 'medium',
      description: '脱敏规则备注中缺少主流程说明',
      missing: '主流程说明',
      nextStep: '请补充脱敏规则的主流程备注信息',
      owner: '规则导入人'
    });
  }

  const ruleKeywords = ['RAG', '引用', '证据', '来源', '出处'];
  const hasRagReference = ruleKeywords.some(kw => 
    (rule.remark || '').includes(kw) || 
    (rule.mainProcess || '').includes(kw) ||
    (rule.content || '').includes(kw)
  );

  if (!hasRagReference) {
    gaps.push({
      type: 'no_rag_evidence',
      severity: 'high',
      description: '脱敏规则中未明确标注 RAG 引用来源',
      missing: 'RAG 引用证据链',
      nextStep: '请算法同事核查并补充 RAG 引用来源',
      owner: '算法同事'
    });
  }

  relatedBatches.forEach(batch => {
    const batchHasRag = ruleKeywords.some(kw =>
      (batch.sceneStatement || '').includes(kw) ||
      (batch.content || '').includes(kw)
    );
    if (!batchHasRag) {
      gaps.push({
        type: 'batch_no_rag_evidence',
        severity: 'medium',
        batchNo: batch.batchNo,
        description: `灰度批次 ${batch.batchNo} 的现场说法中缺少 RAG 引用标注`,
        missing: '灰度批次 RAG 引用证据',
        nextStep: '请算法同事补充该批次的 RAG 引用来源',
        owner: '算法同事'
      });
    }
  });

  return gaps;
}

function checkPhoneMasking(text, sourceType, sourceId, sourceName) {
  const issues = [];
  const phones = detectPhoneNumbers(text);
  
  phones.forEach(phone => {
    if (!isPhoneMasked(phone)) {
      issues.push({
        id: generateId('phone'),
        phoneNumber: phone,
        sourceType,
        sourceId,
        sourceName,
        status: 'pending_review',
        detectedAt: new Date().toISOString(),
        note: '手机号在导出中漏遮，留待算法同事复核，暂不归为正常'
      });
    }
  });
  
  return issues;
}

function generateFriendlyReport(inspection) {
  const lines = [];
  lines.push(`📋 RAG 引用缺失巡检报告`);
  lines.push(`━━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`巡检编号: ${inspection.id}`);
  lines.push(`巡检时间: ${inspection.createdAt}`);
  lines.push(`执行人: ${inspection.operator}`);
  lines.push('');
  
  lines.push(`🔍 本次巡检范围:`);
  lines.push(`  - 脱敏规则: ${inspection.ruleCount} 条`);
  lines.push(`  - 灰度批次: ${inspection.batchCount} 条`);
  lines.push(`  - 发现问题: ${inspection.gaps.length} 个`);
  lines.push(`  - 手机号漏遮: ${inspection.phoneIssues.length} 个`);
  lines.push('');

  if (inspection.gaps.length > 0) {
    lines.push(`⚠️  引用缺失问题详情:`);
    lines.push('');
    inspection.gaps.forEach((gap, idx) => {
      lines.push(`  ${idx + 1}. [${gap.severity === 'high' ? '🔴' : '🟡'} ${gap.description}`);
      lines.push(`     ❓ 为什么留下: ${gap.description}`);
      lines.push(`     📦 还缺什么: ${gap.missing}`);
      lines.push(`     🎯 下一步找谁: ${gap.owner}`);
      lines.push(`     📝 具体行动: ${gap.nextStep}`);
      if (gap.batchNo) lines.push(`     📦 关联批次: ${gap.batchNo}`);
      lines.push('');
    });
  }

  if (inspection.phoneIssues.length > 0) {
    lines.push(`📱 手机号漏遮问题（待算法同事复核:`);
    lines.push('');
    inspection.phoneIssues.forEach((issue, idx) => {
      lines.push(`  ${idx + 1}. ${issue.phoneNumber} (来源: ${issue.sourceName})`);
      lines.push(`     状态: ${issue.status === 'pending_review' ? '⏳ 待算法同事复核' : issue.status}`);
      lines.push(`     说明: ${issue.note}`);
      lines.push('');
    });
  }

  if (inspection.gaps.length === 0 && inspection.phoneIssues.length === 0) {
    lines.push(`✅ 本次巡检未发现问题，一切正常！`);
  }

  lines.push(`━━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`💡 提示: 所有修改操作均已记录审计日志，可追溯谁改了什么、为什么改`);
  
  return lines.join('\n');
}

function runInspection(operator, options = {}) {
  const rules = getDesensitizationRules();
  const batches = getGrayBatches();
  
  const allGaps = [];
  const allPhoneIssues = [];
  const evidenceMap = {};

  rules.forEach(rule => {
    const gaps = analyzeCitationGaps(rule, batches);
    const relatedBatches = batches.filter(b => b.relatedRuleId === rule.id);
    
    evidenceMap[rule.id] = {
      rule: {
        id: rule.id,
        name: rule.name,
        remark: rule.remark,
        mainProcess: rule.mainProcess
      },
      grayBatches: relatedBatches.map(b => ({
        id: b.id,
        batchNo: b.batchNo,
        sceneStatement: b.sceneStatement
      })),
      gaps: gaps
    };

    allGaps.push(...gaps.map(g => ({ ...g, ruleId: rule.id, ruleName: rule.name })));

    const rulePhoneIssues = checkPhoneMasking(
      rule.content || '',
      'desensitization_rule',
      rule.id,
      rule.name
    );
    allPhoneIssues.push(...rulePhoneIssues);
  });

  batches.forEach(batch => {
    const batchPhoneIssues = checkPhoneMasking(
      batch.content || batch.sceneStatement || '',
      'gray_batch',
      batch.id,
      `灰度批次 ${batch.batchNo}`
    );
    allPhoneIssues.push(...batchPhoneIssues);
  });

  allPhoneIssues.forEach(issue => savePhoneMaskIssue(issue));

  const inspection = {
    id: generateId('inspect'),
    operator,
    createdAt: new Date().toISOString(),
    ruleCount: rules.length,
    batchCount: batches.length,
    gaps: allGaps,
    phoneIssues: allPhoneIssues,
    evidenceMap,
    options
  };

  saveInspectionRecord(inspection);
  addAuditLog('run_inspection', operator, { inspectionId: inspection.id, gapCount: allGaps.length, phoneIssueCount: allPhoneIssues.length });

  const exportResult = {
    id: generateId('export'),
    inspectionId: inspection.id,
    type: 'inspection_export',
    content: generateFriendlyReport(inspection),
    createdAt: new Date().toISOString(),
    status: 'generated'
  };
  saveExportResult(exportResult);

  return {
    inspection,
    exportResult,
    friendlyReport: generateFriendlyReport(inspection)
  };
}

function rerunInspection(operator, previousInspectionId) {
  addAuditLog('rerun_inspection', operator, { previousInspectionId });
  return runInspection(operator, { rerunFrom: previousInspectionId });
}

module.exports = {
  runInspection,
  rerunInspection,
  detectPhoneNumbers,
  isPhoneMasked,
  generateFriendlyReport,
  checkPhoneMasking
};
