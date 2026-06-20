const fs = require('fs');

let content = fs.readFileSync('./src/inspectionEngine.js', 'utf8');

// 2. 修改批次检测部分 - 使用 findValidRagMatches
content = content.replace(
  /  relatedBatches\.forEach\(batch => \{
    const batchText = \`\$\{batch\.sceneStatement \|\| ''\}\\n\$\{batch\.content \|\| ''\}\`;
    const batchHasRag = ragPatterns\.some\(pattern => pattern\.test\(batchText\)\);
    
    let batchRagMatchDetails = null;
    if \(batchHasRag\) \{
      batchRagMatchDetails = \[\];
      ragPatterns\.forEach\(\(pattern, idx\) => \{
        const match = batchText\.match\(pattern\);
        if \(match\) \{
          batchRagMatchDetails\.push\(\{
            patternIndex: idx,
            matchedText: match\[0\],
            context: getMatchContext\(batchText, match\.index, match\[0\]\.length\)
          \}\);
        \}
      \}\);
    \}
    
    if \(!batchHasRag\) \{
      gaps\.push\(\{
        type: 'batch_no_rag_evidence',
        severity: 'medium',
        batchNo: batch\.batchNo,
        batchId: batch\.id,
        description: \`灰度批次 \$\{batch\.batchNo\} 的现场说法中缺少 RAG 引用标注\`,
        missing: '灰度批次 RAG 引用证据',
        nextStep: '请算法同事补充该批次的 RAG 引用来源',
        owner: '算法同事',
        rawMaterialSnapshot: \{
          sceneStatement: batch\.sceneStatement \|\| '',
          content: batch\.content \|\| '',
          checkedFields: \['sceneStatement', 'content'\]
        \},
        traceId: generateId\('trace'\)
      \}\);
    \} else \{
      gaps\.push\(\{
        type: 'batch_rag_reference_found',
        severity: 'info',
        batchNo: batch\.batchNo,
        batchId: batch\.id,
        description: \`灰度批次 \$\{batch\.batchNo\} 中已检测到 RAG 引用标注\`,
        owner: '系统',
        ragMatchDetails: batchRagMatchDetails,
        rawMaterialSnapshot: \{
          sceneStatement: batch\.sceneStatement \|\| '',
          content: batch\.content \|\| ''
        \},
        traceId: generateId\('trace'\)
      \}\);
    \}
  \}\);/,
  `  relatedBatches.forEach(batch => {
    const batchText = \`\${batch.sceneStatement || ''}\\n\${batch.content || ''}\`;
    const batchRag = findValidRagMatches(batchText);
    const batchHasRag = batchRag.validMatches.length > 0;
    
    const batchRagMatchDetails = batchHasRag ? batchRag.validMatches : null;
    
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
        description: \`灰度批次 \${batch.batchNo} 中已检测到 RAG 引用标注\`,
        owner: '系统',
        ragMatchDetails: batchRagMatchDetails,
        negatedMatches: batchRag.negatedMatches,
        rawMaterialSnapshot: {
          sceneStatement: batch.sceneStatement || '',
          content: batch.content || '',
          negatedMatches: batchRag.negatedMatches
        },
        traceId: generateId('trace')
      });
    }
  });`
);

console.log('Step 2: 批次检测部分修改完成');

// 3. 修改 checkPhoneMasking 函数
content = content.replace(
  /function checkPhoneMasking\(text, sourceType, sourceId, sourceName, fieldName\) \{
  const issues = \[\];
  const phones = detectPhoneNumbers\(text\);
  
  phones\.forEach\(phone => \{
    if \(!isPhoneMasked\(phone\)\) \{
      const phoneIdx = text\.indexOf\(phone\);
      issues\.push\(\{
        id: generateId\('phone'\),
        phoneNumber: phone,
        sourceType,
        sourceId,
        sourceName,
        fieldName: fieldName \|\| 'content',
        status: 'pending_review',
        detectedAt: new Date\(\)\.toISOString\(\),
        note: '手机号在导出中漏遮，留待算法同事复核，暂不归为正常',
        rawMaterialSnapshot: \{
          fullText: text,
          phoneContext: getMatchContext\(text, phoneIdx, phone\.length, 40\),
          position: phoneIdx,
          fieldName: fieldName \|\| 'content'
        \},
        context: getMatchContext\(text, phoneIdx, phone\.length, 40\)\?\.fullContext \|\| '',
        traceId: generateId\('trace'\)
      \}\);
    \}
  \}\);
  
  return issues;
\}/,
  `function checkPhoneMasking(text, sourceType, sourceId, sourceName, extraMeta) {
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
          fieldName: (extraMeta && extraMeta.fieldName) || 'unknown',
          status: 'pending_review',
          detectedAt: new Date().toISOString(),
          note: '手机号在导出中漏遮，留待算法同事复核，暂不归为正常',
          rawMaterialSnapshot: {
            fullText: text,
            phoneContext: getMatchContext(text, phoneIdx, phone.length, 40),
            position: phoneIdx,
            fieldName: (extraMeta && extraMeta.fieldName) || 'unknown'
          },
          context: getMatchContext(text, phoneIdx, phone.length, 40)?.fullContext || '',
          traceId: generateId('trace'),
          ...(extraMeta || {})
        });
        searchIdx = phoneIdx + 1;
      }
    }
  });
  
  return issues;
}`
);

console.log('Step 3: checkPhoneMasking 函数修改完成');

// 4. 修改 runInspection 中的 checkPhoneMasking 调用
// 规则部分
content = content.replace(
  /    const rulePhoneIssuesContent = checkPhoneMasking\(
      rule\.content \|\| '',
      'desensitization_rule',
      rule\.id,
      rule\.name,
      'content'
    \);/,
  `    const rulePhoneIssuesContent = checkPhoneMasking(
      rule.content || '',
      'desensitization_rule',
      rule.id,
      rule.name,
      { fieldName: 'content' }
    );`
);

content = content.replace(
  /    const rulePhoneIssuesRemark = checkPhoneMasking\(
      rule\.remark \|\| '',
      'desensitization_rule',
      rule\.id,
      rule\.name,
      'remark'
    \);/,
  `    const rulePhoneIssuesRemark = checkPhoneMasking(
      rule.remark || '',
      'desensitization_rule',
      rule.id,
      rule.name,
      { fieldName: 'remark' }
    );`
);

content = content.replace(
  /    const rulePhoneIssuesMainProcess = checkPhoneMasking\(
      rule\.mainProcess \|\| '',
      'desensitization_rule',
      rule\.id,
      rule\.name,
      'mainProcess'
    \);/,
  `    const rulePhoneIssuesMainProcess = checkPhoneMasking(
      rule.mainProcess || '',
      'desensitization_rule',
      rule.id,
      rule.name,
      { fieldName: 'mainProcess' }
    );`
);

// 批次部分
content = content.replace(
  /    const batchPhoneIssuesScene = checkPhoneMasking\(
      batch\.sceneStatement \|\| '',
      'gray_batch',
      batch\.id,
      \`灰度批次 \$\{batch\.batchNo\}\`,
      'sceneStatement'
    \);/,
  `    const batchPhoneIssuesScene = checkPhoneMasking(
      batch.sceneStatement || '',
      'gray_batch',
      batch.id,
      \`灰度批次 \${batch.batchNo}\`,
      { fieldName: 'sceneStatement', batchNo: batch.batchNo }
    );`
);

content = content.replace(
  /    const batchPhoneIssuesContent = checkPhoneMasking\(
      batch\.content \|\| '',
      'gray_batch',
      batch\.id,
      \`灰度批次 \$\{batch\.batchNo\}\`,
      'content'
    \);/,
  `    const batchPhoneIssuesContent = checkPhoneMasking(
      batch.content || '',
      'gray_batch',
      batch.id,
      \`灰度批次 \${batch.batchNo}\`,
      { fieldName: 'content', batchNo: batch.batchNo }
    );`
);

console.log('Step 4: checkPhoneMasking 调用修改完成');

// 5. 修改 generateFriendlyReport 中的否定表达说明
content = content.replace(
  /        if \(gap\.rawMaterialSnapshot\.negatedMatches && gap\.rawMaterialSnapshot\.negatedMatches\.length > 0\) \{
          lines\.push\(`        否定表达匹配数: \$\{gap\.rawMaterialSnapshot\.negatedMatches\.length\}`\);
          gap\.rawMaterialSnapshot\.negatedMatches\.forEach\(\(nm, ni\) => \{
            if \(ni < 2\) \{
              lines\.push\(`          否定表达 \$\{ni \+ 1\}: "\$\{nm\.matchedText\}" \(原因: \$\{nm\.negationReason\}\)`\);
            \}
          \}\);
        \}/,
  `        if (gap.rawMaterialSnapshot.negatedMatches && gap.rawMaterialSnapshot.negatedMatches.length > 0) {
          lines.push(\`     ⚠️  文本中包含 RAG 字样但属于否定表达，已正确判定为缺失：\`);
          gap.rawMaterialSnapshot.negatedMatches.forEach((nm, nmIdx) => {
            lines.push(\`        \${nmIdx + 1}. 匹配文本: "\${nm.matchedText}"\`);
            lines.push(\`           排除原因: \${nm.negationReason}\`);
          });
        }`
);

console.log('Step 5: generateFriendlyReport 否定表达说明修改完成');

// 6. 修改 phoneIssuesSummary items 添加 batchNo
content = content.replace(
  /  const phoneIssuesSummary = \{
    pending: pendingCount,
    confirmed: confirmedCount,
    items: allPhoneMaskIssues\.map\(p => \(\{
      traceId: p\.traceId,
      phoneNumber: p\.phoneNumber,
      fieldName: p\.fieldName,
      status: p\.status,
      sourceName: p\.sourceName,
      context: p\.context \|\| \(p\.rawMaterialSnapshot\?\.phoneContext\?\.fullContext \|\| ''\)
    \}\)\)
  \};/,
  `  const phoneIssuesSummary = {
    pending: pendingCount,
    confirmed: confirmedCount,
    items: allPhoneMaskIssues.map(p => ({
      traceId: p.traceId,
      phoneNumber: p.phoneNumber,
      fieldName: p.fieldName,
      batchNo: p.batchNo,
      status: p.status,
      sourceName: p.sourceName,
      context: p.context || (p.rawMaterialSnapshot?.phoneContext?.fullContext || '')
    }))
  };`
);

console.log('Step 6: phoneIssuesSummary items 修改完成');

// 7. 删除 runInspection 中多余的 ragMatches 处理逻辑（因为 analyzeCitationGaps 已经处理了）
content = content.replace(
  /    const ruleText = \`\$\{rule\.remark \|\| ''\}\\n\$\{rule\.mainProcess \|\| ''\}\\n\$\{rule\.content \|\| ''\}\`;
    const ragMatches = findValidRagMatches\(ruleText\);
    
    gaps\.forEach\(g => \{
      if \(g\.type === 'no_rag_evidence'\) \{
        g\.negatedMatches = ragMatches\.negatedMatches;
        if \(g\.rawMaterialSnapshot\) \{
          g\.rawMaterialSnapshot\.negatedMatches = ragMatches\.negatedMatches;
        \}
      \} else if \(g\.type === 'rag_reference_found'\) \{
        g\.negatedMatches = ragMatches\.negatedMatches;
      \}
    \}\);
    
    /,
  ``
);

// 8. 删除 batches 循环中多余的 batchRagMatches 处理逻辑
content = content.replace(
  /    const batchText = \`\$\{batch\.sceneStatement \|\| ''\}\\n\$\{batch\.content \|\| ''\}\`;
    const batchRagMatches = findValidRagMatches\(batchText\);
    
    allCitationGaps\.forEach\(g => \{
      if \(g\.batchId === batch\.id && g\.type === 'batch_no_rag_evidence'\) \{
        g\.negatedMatches = batchRagMatches\.negatedMatches;
        if \(g\.rawMaterialSnapshot\) \{
          g\.rawMaterialSnapshot\.negatedMatches = batchRagMatches\.negatedMatches;
        \}
      \}
    \}\);
    
    /,
  ``
);

console.log('Step 7-8: 删除多余的 ragMatches 处理逻辑完成');

fs.writeFileSync('./src/inspectionEngine.js', content);
console.log('所有修改完成，文件已保存！');
