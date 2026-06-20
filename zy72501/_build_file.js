const fs = require('fs');
const content = `const {
  generateId,
  saveInspectionRecord,
  saveExportResult,
  savePhoneMaskIssue,
  addAuditLog,
  getDesensitizationRules,
  getGrayBatches
} = require('./models');

const PHONE_REGEX = /1[3-9]\\d{9}/g;

var RAG_PATTERNS = [
  /RAG[ _-]*(引用|证据|来源|出处|reference|cite)/i,
  /(引用|证据|来源|出处)[ _-]*RAG/i,
  /知识库第[^\\s]+节/,
  /引用来源[：:]/,
  /RAG[ _-]*reference/i,
  /\\*RAG\\*/,
  /【RAG[ _-]*(引用|证据|来源|出处)】/,
  /「RAG[ _-]*(引用|证据|来源|出处)」/,
  /RAG[ _-]*引用[ _-]*来源/i,
  /(引用|证据|来源|出处)[ _-]*\\[RAG\\]/i
];
var NEG_PREFIX = ['缺少','缺失','未标注','未添加','未填写','无','没有','待补充','尚未','暂未','待补','需补充','未找到','未附上','未提供','缺乏','未包含','未说明'];
var NEG_SUFFIX = [/缺失/,/待补充/,/未标注/,/未提供/,/待补/];
function isNegatedRagMatch(mt, ft, mi) {
  var pfx = ft.substring(Math.max(0, mi - 24), mi);
  for (var i = 0; i < NEG_PREFIX.length; i++) {
    if (pfx.indexOf(NEG_PREFIX[i]) >= 0) return {negated:true, reason:'前缀含「' + NEG_PREFIX[i] + '」'};
  }
  var sfx = ft.substring(mt.length + mi, Math.min(ft.length, mi + mt.length + 24));
  for (var j = 0; j < NEG_SUFFIX.length; j++) {
    if (NEG_SUFFIX[j].test(sfx)) return {negated:true, reason:'后缀匹配「' + NEG_SUFFIX[j].toString() + '」'};
  }
  return {negated:false};
}
function findValidRagMatches(text) {
  var valid = [], neg = [];
  if (!text) return {validMatches:valid, negatedMatches:neg};
  for (var pi = 0; pi < RAG_PATTERNS.length; pi++) {
    var pat = RAG_PATTERNS[pi];
    var re = new RegExp(pat.source, pat.flags.indexOf('g') >= 0 ? pat.flags : pat.flags + 'g');
    var m;
    while ((m = re.exec(text)) !== null) {
      var base = {patternIndex:pi, matchedText:m[0], matchIndex:m.index, context:getMatchContext(text, m.index, m[0].length)};
      var ck = isNegatedRagMatch(m[0], text, m.index);
      if (ck.negated) { base.negationReason = ck.reason; neg.push(base); } else { valid.push(base); }
      if (m.index === re.lastIndex) re.lastIndex++;
    }
  }
  return {validMatches:valid, negatedMatches:neg};
}

function getMatchContext(text, matchIndex, matchLength, contextLen = 30) {
  if (!text || matchIndex === undefined) return null;
  const start = Math.max(0, matchIndex - contextLen);
  const end = Math.min(text.length, matchIndex + matchLength + contextLen);
  let prefix = text.substring(start, matchIndex);
  let suffix = text.substring(matchIndex + matchLength, end);
  if (start > 0) prefix = '...' + prefix;
  if (end < text.length) suffix = suffix + '...';
  return {
    prefix,
    matched: text.substring(matchIndex, matchIndex + matchLength),
    suffix,
    fullContext: prefix + text.substring(matchIndex, matchIndex + matchLength) + suffix
  };
}

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

  const ragPatterns = RAG_PATTERNS;
  
  const ruleText = \\`\\${rule.remark || ''}\\n\\${rule.mainProcess || ''}\\n\\${rule.content || ''}\\`;
  const ruleRag = findValidRagMatches(ruleText);
  const hasRagReference = ruleRag.validMatches.length > 0;
  let ragMatchDetails = ruleRag.validMatches;
  let negatedMatches = ruleRag.negatedMatches;

  if (!hasRagReference) {
    gaps.push({
      type: 'no_rag_evidence',
      severity: 'high',
      description: '脱敏规则中未明确标注 RAG 引用来源',
      missing: 'RAG 引用证据链',
      nextStep: '请算法同事核查并补充 RAG 引用来源',
      owner: '算法同事',
      rawMaterialSnapshot: {
        remark: rule.remark || '',
        mainProcess: rule.mainProcess || '',
        content: rule.content || '',
        checkedFields: ['remark', 'mainProcess', 'content'],
        requiredPatterns: [
          'RAG 引用', 'RAG引用', 'RAG 证据', 
          '引用来源', '知识库第X节',
          'RAG reference', 'RAG cite',
          '【RAG引用】', '「RAG 引用」'
        ],
        negatedMatches: ruleRag.negatedMatches
      },
      traceId: generateId('trace')
    });
  } else if (ragMatchDetails) {
    gaps.push({
      type: 'rag_reference_found',
      severity: 'info',
      description: '脱敏规则中已检测到 RAG 引用标注',
      owner: '系统',
      ragMatchDetails: ragMatchDetails,
      negatedMatches: ruleRag.negatedMatches,
      rawMaterialSnapshot: {
        remark: rule.remark || '',
        mainProcess: rule.mainProcess || '',
        content: rule.content || ''
      },
      traceId: generateId('trace')
    });
  }

  relatedBatches.forEach(batch => {
    const batchText = \\`\\${batch.sceneStatement || ''}\\n\\${batch.content || ''}\\`;
    const batchRag = findValidRagMatches(batchText);
    const batchHasRag = batchRag.validMatches.length > 0;
    const batchRagMatchDetails = batchRag.validMatches;
    
    if (!batchHasRag) {
      gaps.push({
        type: 'batch_no_rag_evidence',
        severity: 'medium',
        batchNo: batch.batchNo,
        batchId: batch.id,
        description: \\`灰度批次 \\${batch.batchNo} 的现场说法中缺少 RAG 引用标注\\`,
        missing: '灰度批次 RAG 引用证据',
        nextStep: '请算法同事补充该批次的 RAG 引用来源',
        owner: '算法同事',
        rawMaterialSnapshot: {
          sceneStatement: batch.sceneStatement || '',
          content: batch.content || '',
          checkedFields: ['sceneStatement', 'content'],
          negatedMatches: batchRag.negatedMatches
        },
        traceId: generateId('trace')
      });
    } else {
      gaps.push({
        type: 'batch_rag_reference_found',
        severity: 'info',
        batchNo: batch.batchNo,
        batchId: batch.id,
        description: \\`灰度批次 \\${batch.batchNo} 中已检测到 RAG 引用标注\\`,
        owner: '系统',
        ragMatchDetails: batchRagMatchDetails,
        negatedMatches: batchRag.negatedMatches,
        rawMaterialSnapshot: {
          sceneStatement: batch.sceneStatement || '',
          content: batch.content || ''
        },
        traceId: generateId('trace')
      });
    }
  });

  return gaps;
}

function checkPhoneMasking(text, sourceType, sourceId, sourceName, extraMeta) {
  const issues = [];
  const phones = detectPhoneNumbers(text);
  const uniquePhones = [...new Set(phones)];
  
  uniquePhones.forEach(phone => {
    if (!isPhoneMasked(phone)) {
      let searchIdx = 0;
      while (true) {
        const phoneIdx = text.indexOf(phone, searchIdx);
        if (phoneIdx === -1) break;
        issues.push({
          id: generateId('phone'),
          phoneNumber: phone,
          sourceType,
          sourceId,
          sourceName,
          status: 'pending_review',
          detectedAt: new Date().toISOString(),
          note: '手机号在导出中漏遮，留待算法同事复核，暂不归为正常',
          rawMaterialSnapshot: {
            fullText: text,
            phoneContext: getMatchContext(text, phoneIdx, phone.length, 40),
            position: phoneIdx,
            fieldName: (extraMeta && extraMeta.fieldName) || 'unknown'
          },
          traceId: generateId('trace'),
          ...(extraMeta || {})
        });
        searchIdx = phoneIdx + 1;
      }
    }
  });
  
  return issues;
}

function generateFriendlyReport(inspection) {
  const lines = [];
  lines.push(\\`📋 RAG 引用缺失巡检报告\\`);
  lines.push(\\`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\`);
  lines.push(\\`巡检编号: \\${inspection.id}\\`);
  lines.push(\\`巡检时间: \\${inspection.createdAt}\\`);
  lines.push(\\`执行人: \\${inspection.operator}\\`);
  if (inspection.options?.rerunFrom) lines.push(\\`🔄 重跑来源: \\${inspection.options.rerunFrom}\\`);
  lines.push('');
  
  const ragGaps = inspection.gaps.filter(g => g.type === 'no_rag_evidence' || g.type === 'batch_no_rag_evidence');
  const ragFound = inspection.gaps.filter(g => g.type === 'rag_reference_found' || g.type === 'batch_rag_reference_found');
  const otherGaps = inspection.gaps.filter(g => !g.type.includes('rag'));
  
  lines.push(\\`🔍 本次巡检范围:\\`);
  lines.push(\\`  - 脱敏规则: \\${inspection.ruleCount} 条\\`);
  lines.push(\\`  - 灰度批次: \\${inspection.batchCount} 条\\`);
  lines.push(\\`  - RAG 引用缺失: \\${ragGaps.length} 个\\`);
  lines.push(\\`  - RAG 引用已存在: \\${ragFound.length} 个\\`);
  lines.push(\\`  - 其他问题: \\${otherGaps.length} 个\\`);
  lines.push(\\`  - 手机号漏遮: \\${inspection.phoneIssues.length} 个\\`);
  lines.push('');

  if (ragGaps.length > 0) {
    lines.push(\\`🔴 RAG 引用缺失问题详情 (可通过 traceId 追回原始材料):\\`);
    lines.push('');
    ragGaps.forEach((gap, idx) => {
      lines.push(\\`  \\${idx + 1}. [\\${gap.severity === 'high' ? '🔴' : '🟡'} \\${gap.description}\\`);
      lines.push(\\`     🔍 Trace ID: \\${gap.traceId}\\`);
      lines.push(\\`     ❓ 为什么留下: \\${gap.description}\\`);
      lines.push(\\`     📦 还缺什么: \\${gap.missing}\\`);
      lines.push(\\`     🎯 下一步找谁: \\${gap.owner}\\`);
      lines.push(\\`     📝 具体行动: \\${gap.nextStep}\\`);
      if (gap.ruleName) lines.push(\\`     📜 关联规则: \\${gap.ruleName}\\`);
      if (gap.batchNo) lines.push(\\`     📦 关联批次: \\${gap.batchNo}\\`);
      if (gap.rawMaterialSnapshot) {
        lines.push(\\`     📄 触发原始材料 (已快照保留):\\`);
        if (gap.rawMaterialSnapshot.checkedFields) {
          lines.push(\\`        已检查字段: \\${gap.rawMaterialSnapshot.checkedFields.join(', ')}\\`);
        }
        if (gap.rawMaterialSnapshot.requiredPatterns) {
          lines.push(\\`        期望匹配模式: \\${gap.rawMaterialSnapshot.requiredPatterns.slice(0, 5).join(' | ')}\\${gap.rawMaterialSnapshot.requiredPatterns.length > 5 ? '...' : ''}\\`);
        }
        if (gap.rawMaterialSnapshot.remark && gap.rawMaterialSnapshot.remark.length > 0) {
          const shortRemark = gap.rawMaterialSnapshot.remark.substring(0, 100) + (gap.rawMaterialSnapshot.remark.length > 100 ? '...' : '');
          lines.push(\\`        备注原文: "\\${shortRemark}"\\`);
        }
        if (gap.rawMaterialSnapshot.mainProcess && gap.rawMaterialSnapshot.mainProcess.length > 0) {
          const shortProcess = gap.rawMaterialSnapshot.mainProcess.substring(0, 100) + (gap.rawMaterialSnapshot.mainProcess.length > 100 ? '...' : '');
          lines.push(\\`        主流程原文: "\\${shortProcess}"\\`);
        }
        if (gap.rawMaterialSnapshot.sceneStatement !== undefined) {
          const shortScene = (gap.rawMaterialSnapshot.sceneStatement || '').substring(0, 100) + ((gap.rawMaterialSnapshot.sceneStatement || '').length > 100 ? '...' : '');
          lines.push(\\`        现场说法原文: "\\${shortScene}"\\`);
        }
        if (gap.rawMaterialSnapshot.negatedMatches && gap.rawMaterialSnapshot.negatedMatches.length > 0) {
          lines.push(\\`     ⚠️ 文本中包含 RAG 字样但属于否定表达，已正确判定为缺失：\\`);
          gap.rawMaterialSnapshot.negatedMatches.forEach((nm, nmIdx) => {
            lines.push(\\`        \\${nmIdx + 1}. 匹配文本: "\\${nm.matchedText}"\\`);
            lines.push(\\`           排除原因: \\${nm.negationReason}\\`);
          });
        }
      }
      lines.push('');
    });
  }

  if (ragFound.length > 0) {
    lines.push(\\`🟢 RAG 引用已检测到 (可通过 traceId 反查匹配内容):\\`);
    lines.push('');
    ragFound.forEach((gap, idx) => {
      lines.push(\\`  \\${idx + 1}. 🟢 \\${gap.description}\\`);
      lines.push(\\`     🔍 Trace ID: \\${gap.traceId}\\`);
      if (gap.ruleName) lines.push(\\`     📜 关联规则: \\${gap.ruleName}\\`);
      if (gap.batchNo) lines.push(\\`     📦 关联批次: \\${gap.batchNo}\\`);
      if (gap.ragMatchDetails && gap.ragMatchDetails.length > 0) {
        lines.push(\\`     🎯 匹配到的 RAG 引用内容:\\`);
        gap.ragMatchDetails.forEach((match, mIdx) => {
          lines.push(\\`        \\${mIdx + 1}. 匹配文本: "\\${match.matchedText}"\\`);
          if (match.context) {
            lines.push(\\`           上下文: \\${match.context.fullContext}\\`);
          }
        });
      }
      if (gap.negatedMatches && gap.negatedMatches.length > 0) {
        lines.push(\\`     ⚠️ 同时排除的否定匹配：\\`);
        gap.negatedMatches.forEach((nm, nmIdx) => {
          lines.push(\\`        \\${nmIdx + 1}. 匹配文本: "\\${nm.matchedText}"\\`);
          lines.push(\\`           排除原因: \\${nm.negationReason}\\`);
        });
      }
      lines.push('');
    });
  }

  if (otherGaps.length > 0) {
    lines.push(\\`⚠️  其他问题详情:\\`);
    lines.push('');
    otherGaps.forEach((gap, idx) => {
      lines.push(\\`  \\${idx + 1}. [\\${gap.severity === 'high' ? '🔴' : '🟡'} \\${gap.description}\\`);
      lines.push(\\`     🔍 Trace ID: \\${gap.traceId || 'N/A'}\\`);
      lines.push(\\`     ❓ 为什么留下: \\${gap.description}\\`);
      lines.push(\\`     📦 还缺什么: \\${gap.missing}\\`);
      lines.push(\\`     🎯 下一步找谁: \\${gap.owner}\\`);
      lines.push(\\`     📝 具体行动: \\${gap.nextStep}\\`);
      if (gap.ruleName) lines.push(\\`     📜 关联规则: \\${gap.ruleName}\\`);
      if (gap.batchNo) lines.push(\\`     📦 关联批次: \\${gap.batchNo}\\`);
      lines.push('');
    });
  }

  if (inspection.phoneIssues.length > 0) {
    lines.push(\\`📱 手机号漏遮问题 (待算法同事复核，暂不归为正常):\\`);
    lines.push('');
    inspection.phoneIssues.forEach((issue, idx) => {
      lines.push(\\`  \\${idx + 1}. 📱 \\${issue.phoneNumber} (来源: \\${issue.sourceName})\\`);
      lines.push(\\`     🔍 Trace ID: \\${issue.traceId}\\`);
      lines.push(\\`     字段: \\${issue.rawMaterialSnapshot?.fieldName || 'unknown'}\\`);
      lines.push(\\`     状态: \\${issue.status === 'pending_review' ? '⏳ 待算法同事复核' : issue.status}\\`);
      lines.push(\\`     说明: \\${issue.note}\\`);
      if (issue.rawMaterialSnapshot?.phoneContext) {
        lines.push(\\`     📄 出现位置上下文: \\${issue.rawMaterialSnapshot.phoneContext.fullContext}\\`);
      }
      lines.push('');
    });
  }

  if (inspection.gaps.length === 0 && inspection.phoneIssues.length === 0) {
    lines.push(\\`✅ 本次巡检未发现问题，一切正常！\\`);
  }

  lines.push(\\`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\`);
  lines.push(\\`💡 反查说明:\\`);
  lines.push(\\`   • 所有问题均已分配唯一 Trace ID，可用于反查修改历史\\`);
  lines.push(\\`   • 修改前的原始材料已快照保留，不会被后续修改覆盖\\`);
  lines.push(\\`   • 审计日志记录: 谁改了什么、改前内容、改后内容、修改原因\\`);
  lines.push(\\`   • 可通过 traceId 在审计日志和历史版本中完整追溯\\`);
  
  return lines.join('\\n');
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

    const rulePhoneIssuesRemark = checkPhoneMasking(
      rule.remark || '',
      'desensitization_rule',
      rule.id,
      rule.name,
      {fieldName: 'remark'}
    );
    allPhoneIssues.push(...rulePhoneIssuesRemark);

    const rulePhoneIssuesMainProcess = checkPhoneMasking(
      rule.mainProcess || '',
      'desensitization_rule',
      rule.id,
      rule.name,
      {fieldName: 'mainProcess'}
    );
    allPhoneIssues.push(...rulePhoneIssuesMainProcess);

    const rulePhoneIssuesContent = checkPhoneMasking(
      rule.content || '',
      'desensitization_rule',
      rule.id,
      rule.name,
      {fieldName: 'content'}
    );
    allPhoneIssues.push(...rulePhoneIssuesContent);
  });

  batches.forEach(batch => {
    const batchPhoneIssuesScene = checkPhoneMasking(
      batch.sceneStatement || '',
      'gray_batch',
      batch.id,
      \\`灰度批次 \\${batch.batchNo}\\`,
      {fieldName: 'sceneStatement', batchNo: batch.batchNo}
    );
    allPhoneIssues.push(...batchPhoneIssuesScene);

    const batchPhoneIssuesContent = checkPhoneMasking(
      batch.content || '',
      'gray_batch',
      batch.id,
      \\`灰度批次 \\${batch.batchNo}\\`,
      {fieldName: 'content', batchNo: batch.batchNo}
    );
    allPhoneIssues.push(...batchPhoneIssuesContent);
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

  const ragGaps = allGaps.filter(g => g.type === 'no_rag_evidence' || g.type === 'batch_no_rag_evidence');
  const ragFound = allGaps.filter(g => g.type === 'rag_reference_found' || g.type === 'batch_rag_reference_found');
  const otherGaps = allGaps.filter(g => !g.type.includes('rag'));

  const gapsSummary = {
    total: allGaps.length,
    ragMissing: ragGaps.length,
    ragFound: ragFound.length,
    other: otherGaps.length
  };

  const pendingCount = allPhoneIssues.filter(i => i.status === 'pending_review').length;
  const confirmedCount = allPhoneIssues.filter(i => i.status === 'confirmed').length;
  const phoneItems = allPhoneIssues.map(issue => ({
    traceId: issue.traceId,
    phoneNumber: issue.phoneNumber,
    sourceName: issue.sourceName,
    fieldName: issue.rawMaterialSnapshot?.fieldName || 'unknown',
    batchNo: issue.batchNo || null,
    status: issue.status,
    context: issue.rawMaterialSnapshot?.phoneContext?.fullContext || ''
  }));

  const phoneIssuesSummary = {
    total: allPhoneIssues.length,
    pending: pendingCount,
    confirmed: confirmedCount,
    items: phoneItems
  };

  const exportResult = {
    id: generateId('export'),
    inspectionId: inspection.id,
    type: 'inspection_export',
    content: generateFriendlyReport(inspection),
    gapsSummary,
    phoneIssuesSummary,
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
  checkPhoneMasking,
  findValidRagMatches,
  isNegatedRagMatch,
  RAG_PATTERNS,
  NEG_PREFIX
};
`;

fs.writeFileSync('/Users/lzy/pro/solo/workspaces/zy72501/src/inspectionEngine.js', content, 'utf8');
console.log('文件写入完成，共 ' + content.split('\n').length + ' 行');
