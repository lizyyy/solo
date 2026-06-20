const fs = require('fs');

let content = fs.readFileSync('src/inspectionEngine.js', 'utf8');

// 修复1: 移除 /\bRAG\b/i, 这行会导致误匹配
content = content.replace('    /\\bRAG\\b/i,\n', '');

// 修复2: 修改 analyzeCitationGaps 中的 RAG 检测逻辑 - 使用 findValidRagMatches
const oldRuleDetection = `  const ruleText = \`\${rule.remark || ''}\\n\${rule.mainProcess || ''}\\n\${rule.content || ''}\`;
  const hasRagReference = ragPatterns.some(pattern => pattern.test(ruleText));
  
  let ragMatchDetails = null;
  if (hasRagReference) {
    ragMatchDetails = [];
    ragPatterns.forEach((pattern, idx) => {
      const match = ruleText.match(pattern);
      if (match) {
        ragMatchDetails.push({
          patternIndex: idx,
          matchedText: match[0],
          context: getMatchContext(ruleText, match.index, match[0].length)
        });
      }
    });
  }

  if (!hasRagReference) {`;

const newRuleDetection = `  const ruleText = \`\${rule.remark || ''}\\n\${rule.mainProcess || ''}\\n\${rule.content || ''}\`;
  const ragMatches = findValidRagMatches(ruleText);
  const hasRagReference = ragMatches.validMatches.length > 0;
  
  let ragMatchDetails = null;
  let negatedMatches = null;
  if (hasRagReference) {
    ragMatchDetails = ragMatches.validMatches;
  }
  if (ragMatches.negatedMatches.length > 0) {
    negatedMatches = ragMatches.negatedMatches;
  }

  if (!hasRagReference) {`;

content = content.replace(oldRuleDetection, newRuleDetection);

// 修复3: 在 no_rag_evidence 中添加 negatedMatches 字段
const oldNoRagEvidence = `      rawMaterialSnapshot: {
        remark: rule.remark || '',
        mainProcess: rule.mainProcess || '',
        content: rule.content || '',
        checkedFields: ['remark', 'mainProcess', 'content'],
        requiredPatterns: [
          'RAG 引用', 'RAG引用', 'RAG 证据', 
          '引用来源', '知识库第X节',
          'RAG reference', 'RAG cite',
          '【RAG引用】', '「RAG 引用」'
        ]
      },
      traceId: generateId('trace')
    });
  } else if (ragMatchDetails) {`;

const newNoRagEvidence = `      rawMaterialSnapshot: {
        remark: rule.remark || '',
        mainProcess: rule.mainProcess || '',
        content: rule.content || '',
        checkedFields: ['remark', 'mainProcess', 'content'],
        negatedMatches: negatedMatches,
        requiredPatterns: [
          'RAG 引用', 'RAG引用', 'RAG 证据', 
          '引用来源', '知识库第X节',
          'RAG reference', 'RAG cite',
          '【RAG引用】', '「RAG 引用」'
        ]
      },
      negatedMatches: negatedMatches,
      traceId: generateId('trace')
    });
  } else if (ragMatchDetails) {`;

content = content.replace(oldNoRagEvidence, newNoRagEvidence);

// 修复4: 修改批次的 RAG 检测逻辑
const oldBatchDetection = `  relatedBatches.forEach(batch => {
    const batchText = \`\${batch.sceneStatement || ''}\\n\${batch.content || ''}\`;
    const batchHasRag = ragPatterns.some(pattern => pattern.test(batchText));
    
    let batchRagMatchDetails = null;
    if (batchHasRag) {
      batchRagMatchDetails = [];
      ragPatterns.forEach((pattern, idx) => {
        const match = batchText.match(pattern);
        if (match) {
          batchRagMatchDetails.push({
            patternIndex: idx,
            matchedText: match[0],
            context: getMatchContext(batchText, match.index, match[0].length)
          });
        }
      });
    }
    
    if (!batchHasRag) {`;

const newBatchDetection = `  relatedBatches.forEach(batch => {
    const batchText = \`\${batch.sceneStatement || ''}\\n\${batch.content || ''}\`;
    const batchRagMatches = findValidRagMatches(batchText);
    const batchHasRag = batchRagMatches.validMatches.length > 0;
    
    let batchRagMatchDetails = null;
    let batchNegatedMatches = null;
    if (batchHasRag) {
      batchRagMatchDetails = batchRagMatches.validMatches;
    }
    if (batchRagMatches.negatedMatches.length > 0) {
      batchNegatedMatches = batchRagMatches.negatedMatches;
    }
    
    if (!batchHasRag) {`;

content = content.replace(oldBatchDetection, newBatchDetection);

// 修复5: 在批次 no_rag_evidence 中添加 negatedMatches
const oldBatchNoRag = `        rawMaterialSnapshot: {
          sceneStatement: batch.sceneStatement || '',
          content: batch.content || '',
          checkedFields: ['sceneStatement', 'content']
        },
        traceId: generateId('trace')
      });
    } else {`;

const newBatchNoRag = `        rawMaterialSnapshot: {
          sceneStatement: batch.sceneStatement || '',
          content: batch.content || '',
          checkedFields: ['sceneStatement', 'content'],
          negatedMatches: batchNegatedMatches
        },
        negatedMatches: batchNegatedMatches,
        traceId: generateId('trace')
      });
    } else {`;

content = content.replace(oldBatchNoRag, newBatchNoRag);

// 修复6: 确保 exportResult 中有 gapsSummary 和 phoneIssuesSummary
// 先检查是否已经有了
if (!content.includes('gapsSummary: gapsSummary')) {
  console.log('需要添加 gapsSummary 和 phoneIssuesSummary');
  const oldExportResult = `  const exportResult = {
    id: generateId('export'),
    inspectionId: inspection.id,
    type: 'inspection_export',
    content: generateFriendlyReport(inspection),
    createdAt: new Date().toISOString(),
    status: 'generated'
  };`;

  const newExportResult = `  const exportResult = {
    id: generateId('export'),
    inspectionId: inspection.id,
    type: 'inspection_export',
    content: generateFriendlyReport(inspection),
    createdAt: new Date().toISOString(),
    status: 'generated',
    gapsSummary: gapsSummary,
    phoneIssuesSummary: phoneIssuesSummary
  };`;

  content = content.replace(oldExportResult, newExportResult);
}

// 修复7: 确保 return 语句格式正确
const oldReturn = `  return {
    inspection,
    exportResult,
    friendlyReport: generateFriendlyReport(inspection)
  };`;

const newReturn = `  return {
    inspection: inspection,
    exportResult: exportResult,
    friendlyReport: generateFriendlyReport(inspection)
  };`;

content = content.replace(oldReturn, newReturn);

// 修复8: 确保 generateFriendlyReport 能正确处理不同的字段名
const oldGapsAccess = `  const ragGaps = inspection.gaps.filter(g => g.type === 'no_rag_evidence' || g.type === 'batch_no_rag_evidence');
  const ragFound = inspection.gaps.filter(g => g.type === 'rag_reference_found' || g.type === 'batch_rag_reference_found');
  const otherGaps = inspection.gaps.filter(g => !g.type.includes('rag'));`;

const newGapsAccess = `  const gaps = inspection.gaps || inspection.citationGaps?.gaps || [];
  const phoneIssues = inspection.phoneIssues || inspection.phoneMaskIssues?.phoneIssues || [];
  
  const ragGaps = gaps.filter(g => g.type === 'no_rag_evidence' || g.type === 'batch_no_rag_evidence');
  const ragFound = gaps.filter(g => g.type === 'rag_reference_found' || g.type === 'batch_rag_reference_found');
  const otherGaps = gaps.filter(g => !g.type.includes('rag'));`;

content = content.replace(oldGapsAccess, newGapsAccess);

// 修复9: 替换所有 inspection.gaps 和 inspection.phoneIssues 的直接引用
content = content.replace(/inspection\.gaps\.length/g, 'gaps.length');
content = content.replace(/inspection\.phoneIssues\.length/g, 'phoneIssues.length');
content = content.replace(/inspection\.gaps\.filter/g, 'gaps.filter');
content = content.replace(/inspection\.phoneIssues\.forEach/g, 'phoneIssues.forEach');

fs.writeFileSync('src/inspectionEngine.js', content);
console.log('✅ 所有修复已应用');
