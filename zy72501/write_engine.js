const fs = require('fs');

const newContent = `const {
  generateId,
  saveInspectionRecord,
  saveExportResult,
  savePhoneMaskIssue,
  addAuditLog,
  getDesensitizationRules,
  getGrayBatches
} = require('./models');

const PHONE_REGEX = /1[3-9]\\d{9}/g;

const RAG_PATTERNS = [
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

const NEGATION_PREFIXES = [
  '缺少', '缺失', '未标注', '未添加', '未填写', '无', '没有',
  '待补充', '尚未', '暂未', '待补', '需补充', '应该补充',
  '未找到', '未附上', '未提供', '缺乏', '未包含', '未说明',
  '未关联', '未绑定'
];

const NEGATION_SUFFIX_PATTERNS = [/缺失/, /待补充/, /未标注/, /未提供/, /待补/, /需补充/];

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

function isNegatedRagMatch(matchText, fullText, matchIndex) {
  const windowStart = Math.max(0, matchIndex - 24);
  const prefixWindow = fullText.substring(windowStart, matchIndex);
  for (const neg of NEGATION_PREFIXES) {
    if (prefixWindow.includes(neg)) {
      return { negated: true, reason: \`前缀包含否定词「\${neg}」\` };
    }
  }
  const suffixEnd = Math.min(fullText.length, matchIndex + matchText.length + 24);
  const suffixWindow = fullText.substring(matchIndex + matchText.length, suffixEnd);
  for (const p of NEGATION_SUFFIX_PATTERNS) {
    if (p.test(suffixWindow)) {
      return { negated: true, reason: \`后缀包含否定模式「\${p.toString()}」\` };
    }
  }
  return { negated: false };
}

function findValidRagMatches(text) {
  const validMatches = [];
  const negatedMatches = [];
  RAG_PATTERNS.forEach((pattern, idx) => {
    const regex = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
    let m;
    while ((m = regex.exec(text)) !== null) {
      const negCheck = isNegatedRagMatch(m[0], text, m.index);
      if (negCheck.negated) {
        negatedMatches.push({
          patternIndex: idx,
          matchedText: m[0],
          matchIndex: m.index,
          context: getMatchContext(text, m.index, m[0].length),
          negationReason: negCheck.reason
        });
      } else {
        validMatches.push({
          patternIndex: idx,
          matchedText: m[0],
          matchIndex: m.index,
          context: getMatchContext(text, m.index, m[0].length)
        });
      }
      if (m.index === regex.lastIndex) regex.lastIndex++;
    }
  });
  return { validMatches, negatedMatches };
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
      owner: '算法运营老唐',
      traceId: generateId('trace')
    });
  }

  if (!rule.remark || !rule.mainProcess) {
    gaps.push({
      type: 'missing_rule_remark',
      severity: 'medium',
      description: '脱敏规则备注中缺少主流程说明',
      missing: '主流程说明',
      nextStep: '请补充脱敏规则的主流程备注信息',
      owner: '规则导入人',
      traceId: generateId('trace')
    });
  }

  const ruleText = \`\${rule.remark || ''}\\n\${rule.mainProcess || ''}\\n\${rule.content || ''}\`;
  const ruleRagResult = findValidRagMatches(ruleText);
  const hasRagReference = ruleRagResult.validMatches.length > 0;

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
          'RAG reference',
          '【RAG引用】', '「RAG 引用」'
        ],
        negatedMatches: ruleRagResult.negatedMatches
      },
      traceId: generateId('trace')
    });
  } else {
    gaps.push({
      type: 'rag_reference_found',
      severity: 'info',
      description: '脱敏规则中已检测到 RAG 引用标注',
      owner: '系统',
      ragMatchDetails: ruleRagResult.validMatches,
      negatedMatches: ruleRagResult.negatedMatches,
      rawMaterialSnapshot: {
        remark: rule.remark || '',
        mainProcess: rule.mainProcess || '',
        content: rule.content || ''
      },
      traceId: generateId('trace')
    });
  }

  relatedBatches.forEach(batch => {
    const batchText = \`\${batch.sceneStatement || ''}\\n\${batch.content || ''}\`;
    const batchRagResult = findValidRagMatches(batchText);
    const batchHasRag = batchRagResult.validMatches.length > 0;

    if (!batchHasRag) {
      gaps.push({
        type: 'batch_no_rag_evidence',
        severity: 'medium',
        batchNo: batch.batchNo,
        batchId: batch.id,
        description: \`灰度批次 \${batch.batchNo} 的现场说法中缺少 RAG 引用标注\`,
        missing: '灰度批次 RAG 引用证据',
        nextStep: '请算法同事补充该批次的 RAG 引用来源',
        owner: '算法同事',
        rawMaterialSnapshot: {
          sceneStatement: batch.sceneStatement || '',
          content: batch.content || '',
          checkedFields: ['sceneStatement', 'content'],
          negatedMatches: batchRagResult.negatedMatches
        },
        traceId: generateId('trace')
      });
    } else {
      gaps.push({
        type: 'batch_rag_reference_found',
        severity: 'info',
        batchNo: batch.batchNo,
        batchId: batch.id,
        description: \`灰度批次 \${batch.batchNo} 中已检测到 RAG 引用标注\`,
        owner: '系统',
        ragMatchDetails: batchRagResult.validMatches,
        negatedMatches: batchRagResult.negatedMatches,
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

function checkPhoneMasking(text, sourceType, sourceId, sourceName, extraMeta = {}) {
  const issues = [];
  if (!text) return issues;
  const phones = detectPhoneNumbers(text);

  phones.forEach(phone => {
    if (!isPhoneMasked(phone)) {
      let idx = 0;
      let searchStart = 0;
      while ((idx = text.indexOf(phone, searchStart)) !== -1) {
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
            phoneContext: getMatchContext(text, idx, phone.length, 40),
            position: idx,
            fieldName: extraMeta.fieldName || 'unknown'
          },
          traceId: generateId('trace'),
          ...extraMeta
        });
        searchStart = idx + phone.length;
      }
    }
  });

  return issues;
}

function generateFriendlyReport(inspection) {
  const lines = [];
  lines.push(\`📋 RAG 引用缺失巡检报告\`);
  lines.push(\`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\`);
  lines.push(\`巡检编号: \${inspection.id}\`);
  lines.push(\`巡检时间: \${inspection.createdAt}\`);
  lines.push(\`执行人: \${inspection.operator}\`);
  if (inspection.options?.rerunFrom) lines.push(\`🔄 重跑来源: \${inspection.options.rerunFrom}\`);
  lines.push('');

  const ragGaps = inspection.gaps.filter(g => g.type === 'no_rag_evidence' || g.type === 'batch_no_rag_evidence');
  const ragFound = inspection.gaps.filter(g => g.type === 'rag_reference_found' || g.type === 'batch_rag_reference_found');
  const otherGaps = inspection.gaps.filter(g => !g.type.includes('rag'));

  lines.push(\`🔍 本次巡检范围:\`);
  lines.push(\`  - 脱敏规则: \${inspection.ruleCount} 条\`);
  lines.push(\`  - 灰度批次: \${inspection.batchCount} 条\`);
  lines.push(\`  - RAG 引用缺失: \${ragGaps.length} 个\`);
  lines.push(\`  - RAG 引用已存在: \${ragFound.length} 个\`);
  lines.push(\`  - 其他问题: \${otherGaps.length} 个\`);
  lines.push(\`  - 手机号漏遮: \${inspection.phoneIssues.length} 个\`);
  lines.push('');

  if (ragGaps.length > 0) {
    lines.push(\`🔴 RAG 引用缺失问题详情 (可通过 traceId 追回原始材料):\`);
    lines.push('');
    ragGaps.forEach((gap, idx) => {
      lines.push(\`  \${idx + 1}. [\${gap.severity === 'high' ? '🔴' : '🟡'}] \${gap.description}\`);
      lines.push(\`     🔍 Trace ID: \${gap.traceId}\`);
      lines.push(\`     ❓ 为什么留下: \${gap.description}\`);
      lines.push(\`     📦 还缺什么: \${gap.missing}\`);
      lines.push(\`     🎯 下一步找谁: \${gap.owner}\`);
      lines.push(\`     📝 具体行动: \${gap.nextStep}\`);
      if (gap.ruleName) lines.push(\`     📜 关联规则: \${gap.ruleName}\`);
      if (gap.batchNo) lines.push(\`     📦 关联批次: \${gap.batchNo}\`);
      if (gap.rawMaterialSnapshot?.negatedMatches && gap.rawMaterialSnapshot.negatedMatches.length > 0) {
        lines.push(\`     ⚠️  注意: 文本中包含 RAG 字样但属于否定表达，已正确判定为缺失：\`);
        gap.rawMaterialSnapshot.negatedMatches.forEach(nm => {
          lines.push(\`        - 匹配 "\${nm.matchedText}" 因「\${nm.negationReason}」被排除\`);
          if (nm.context) lines.push(\`          上下文: \${nm.context.fullContext}\`);
        });
      }
      if (gap.rawMaterialSnapshot) {
        lines.push(\`     📄 触发原始材料 (已快照保留):\`);
        if (gap.rawMaterialSnapshot.checkedFields) {
          lines.push(\`        已检查字段: \${gap.rawMaterialSnapshot.checkedFields.join(', ')}\`);
        }
        if (gap.rawMaterialSnapshot.requiredPatterns) {
          lines.push(\`        期望匹配模式: \${gap.rawMaterialSnapshot.requiredPatterns.slice(0, 5).join(' | ')}\${gap.rawMaterialSnapshot.requiredPatterns.length > 5 ? '...' : ''}\`);
        }
        if (gap.rawMaterialSnapshot.remark && gap.rawMaterialSnapshot.remark.length > 0) {
          const shortRemark = gap.rawMaterialSnapshot.remark.substring(0, 100) + (gap.rawMaterialSnapshot.remark.length > 100 ? '...' : '');
          lines.push(\`        备注原文: "\${shortRemark}"\`);
        }
        if (gap.rawMaterialSnapshot.mainProcess && gap.rawMaterialSnapshot.mainProcess.length > 0) {
          const shortProcess = gap.rawMaterialSnapshot.mainProcess.substring(0, 100) + (gap.rawMaterialSnapshot.mainProcess.length > 100 ? '...' : '');
          lines.push(\`        主流程原文: "\${shortProcess}"\`);
        }
        if (gap.rawMaterialSnapshot.sceneStatement !== undefined) {
          const shortScene = (gap.rawMaterialSnapshot.sceneStatement || '').substring(0, 100) + ((gap.rawMaterialSnapshot.sceneStatement || '').length > 100 ? '...' : '');
          lines.push(\`        现场说法原文: "\${shortScene}"\`);
        }
      }
      lines.push('');
    });
  }

  if (ragFound.length > 0) {
    lines.push(\`🟢 RAG 引用已检测到 (可通过 traceId 反查匹配内容):\`);
    lines.push('');
    ragFound.forEach((gap, idx) => {
      lines.push(\`  \${idx + 1}. 🟢 \${gap.description}\`);
      lines.push(\`     🔍 Trace ID: \${gap.traceId}\`);
      if (gap.ruleName) lines.push(\`     📜 关联规则: \${gap.ruleName}\`);
      if (gap.batchNo) lines.push(\`     📦 关联批次: \${gap.batchNo}\`);
      if (gap.ragMatchDetails && gap.ragMatchDetails.length > 0) {
        lines.push(\`     🎯 匹配到的 RAG 引用内容:\`);
        gap.ragMatchDetails.forEach((match, mIdx) => {
          lines.push(\`        \${mIdx + 1}. 匹配文本: "\${match.matchedText}"\`);
          if (match.context) {
            lines.push(\`           上下文: \${match.context.fullContext}\`);
          }
        });
      }
      if (gap.negatedMatches && gap.negatedMatches.length > 0) {
        lines.push(\`     ⚠️  同时排除的否定匹配:\`);
        gap.negatedMatches.forEach(nm => {
          lines.push(\`        - "\${nm.matchedText}" 因「\${nm.negationReason}」不计为有效引用\`);
        });
      }
      lines.push('');
    });
  }

  if (otherGaps.length > 0) {
    lines.push(\`⚠️  其他问题详情:\`);
    lines.push('');
    otherGaps.forEach((gap, idx) => {
      lines.push(\`  \${idx + 1}. [\${gap.severity === 'high' ? '🔴' : '🟡'}] \${gap.description}\`);
      lines.push(\`     🔍 Trace ID: \${gap.traceId || 'N/A'}\`);
      lines.push(\`     ❓ 为什么留下: \${gap.description}\`);
      lines.push(\`     📦 还缺什么: \${gap.missing}\`);
      lines.push(\`     🎯 下一步找谁: \${gap.owner}\`);
      lines.push(\`     📝 具体行动: \${gap.nextStep}\`);
      if (gap.ruleName) lines.push(\`     📜 关联规则: \${gap.ruleName}\`);
      if (gap.batchNo) lines.push(\`     📦 关联批次: \${gap.batchNo}\`);
      lines.push('');
    });
  }

  if (inspection.phoneIssues.length > 0) {
    lines.push(\`📱 手机号漏遮问题 (待算法同事复核，暂不归为正常):\`);
    lines.push('');
    inspection.phoneIssues.forEach((issue, idx) => {
      lines.push(\`  \${idx + 1}. 📱 \${issue.phoneNumber} (来源: \${issue.sourceName})\`);
      lines.push(\`     🔍 Trace ID: \${issue.traceId}\`);
      lines.push(\`     字段: \${issue.rawMaterialSnapshot?.fieldName || 'N/A'}\`);
      lines.push(\`     状态: \${issue.status === 'pending_review' ? '⏳ 待算法同事复核' : issue.status}\`);
      lines.push(\`     说明: \${issue.note}\`);
      if (issue.rawMaterialSnapshot?.phoneContext) {
        lines.push(\`     📄 出现位置上下文: \${issue.rawMaterialSnapshot.phoneContext.fullContext}\`);
      }
      lines.push('');
    });
  }

  if (inspection.gaps.length === 0 && inspection.phoneIssues.length === 0) {
    lines.push(\`✅ 本次巡检未发现问题，一切正常！\`);
  }

  lines.push(\`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\`);
  lines.push(\`💡 反查说明:\`);
  lines.push(\`   • 所有问题均已分配唯一 Trace ID，可用于反查修改历史\`);
  lines.push(\`   • 修改前的原始材料已快照保留，不会被后续修改覆盖\`);
  lines.push(\`   • 审计日志记录: 谁改了什么、改前内容、改后内容、修改原因\`);
  lines.push(\`   • 可通过 traceId 在审计日志和历史版本中完整追溯\`);

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
        mainProcess: rule.mainProcess,
        versionHistory: rule.versionHistory
      },
      grayBatches: relatedBatches.map(b => ({
        id: b.id,
        batchNo: b.batchNo,
        sceneStatement: b.sceneStatement,
        content: b.content,
        versionHistory: b.versionHistory
      })),
      gaps: gaps
    };

    allGaps.push(...gaps.map(g => ({ ...g, ruleId: rule.id, ruleName: rule.name })));

    const ruleRemarkPhones = checkPhoneMasking(rule.remark || '', 'desensitization_rule', rule.id, rule.name, { fieldName: 'remark' });
    const ruleProcessPhones = checkPhoneMasking(rule.mainProcess || '', 'desensitization_rule', rule.id, rule.name, { fieldName: 'mainProcess' });
    const ruleContentPhones = checkPhoneMasking(rule.content || '', 'desensitization_rule', rule.id, rule.name, { fieldName: 'content' });
    allPhoneIssues.push(...ruleRemarkPhones, ...ruleProcessPhones, ...ruleContentPhones);
  });

  batches.forEach(batch => {
    const scenePhones = checkPhoneMasking(batch.sceneStatement || '', 'gray_batch', batch.id, \`灰度批次 \${batch.batchNo}\`, {
      fieldName: 'sceneStatement',
      batchNo: batch.batchNo
    });
    const contentPhones = checkPhoneMasking(batch.content || '', 'gray_batch', batch.id, \`灰度批次 \${batch.batchNo}\`, {
      fieldName: 'content',
      batchNo: batch.batchNo
    });
    allPhoneIssues.push(...scenePhones, ...contentPhones);
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
    gapsSummary: {
      total: allGaps.length,
      ragMissing: allGaps.filter(g => g.type === 'no_rag_evidence' || g.type === 'batch_no_rag_evidence').length,
      ragFound: allGaps.filter(g => g.type === 'rag_reference_found' || g.type === 'batch_rag_reference_found').length,
      other: allGaps.filter(g => !g.type.includes('rag')).length
    },
    phoneIssuesSummary: {
      total: allPhoneIssues.length,
      pending: allPhoneIssues.filter(p => p.status === 'pending_review').length,
      confirmed: allPhoneIssues.filter(p => p.status === 'confirmed').length,
      items: allPhoneIssues.map(p => ({
        traceId: p.traceId,
        phoneNumber: p.phoneNumber,
        sourceName: p.sourceName,
        fieldName: p.rawMaterialSnapshot?.fieldName,
        batchNo: p.batchNo,
        status: p.status,
        context: p.rawMaterialSnapshot?.phoneContext?.fullContext
      }))
    },
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
  NEGATION_PREFIXES
};
`;

fs.writeFileSync('src/inspectionEngine.js', newContent, 'utf8');
console.log('✅ inspectionEngine.js 已重写成功');
console.log('文件大小:', newContent.length, '字节');
