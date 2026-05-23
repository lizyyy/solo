const fs = require('fs');
const path = require('path');
const { createObjectCsvWriter } = require('csv-writer');
const { OUTPUT_FILES } = require('../config');

async function generateOutputs(results, context) {
  const { outputDir, headers, errors, options } = context;

  await writeJSONResults(results, outputDir);
  await writeMarkdownReport(results, errors, outputDir, options);
  await writeCleanedCSV(results.cleaned, headers, outputDir);
  await writeDuplicateGroupsCSV(results.duplicateGroups, outputDir);
  await writeErrorRowsCSV(errors, headers, outputDir);
}

async function writeJSONResults(results, outputDir) {
  const outputPath = path.join(outputDir, OUTPUT_FILES.json);
  
  const autoMergedCount = results.mergeSuggestions.filter(s => s.type === 'auto-merged').length;
  const conflictCount = results.mergeSuggestions.filter(s => s.type === 'conflict').length;
  
  const jsonData = {
    summary: {
      totalRecords: results.total,
      cleanedRecords: results.cleaned.length,
      duplicateGroups: results.duplicateGroups.length,
      duplicateRecords: results.duplicateCount,
      mergeSuggestions: results.mergeSuggestions.length,
      autoMergedFields: autoMergedCount,
      conflictsNeedReview: conflictCount
    },
    duplicateGroups: results.duplicateGroups.map(g => ({
      groupId: g.groupId,
      selectedRow: g.selected.rowIndex,
      memberRows: g.members.map(m => m.rowIndex),
      conflicts: g.conflicts,
      mergedFields: g.mergedFields || [],
      suggestionCount: g.suggestionCount
    })),
    mergeSuggestions: results.mergeSuggestions,
    cleanedRecords: results.cleaned.map(lead => ({
      originalRow: lead._rowIndex,
      phone: lead['手机号'],
      email: lead['邮箱'],
      companyName: lead['公司名'],
      channel: lead['来源渠道'],
      duplicateGroup: lead._duplicateGroup || null,
      mergedFromRows: lead._mergedFrom || null,
      mergedFields: lead._mergedFields || null
    }))
  };

  fs.writeFileSync(outputPath, JSON.stringify(jsonData, null, 2), 'utf-8');
}

async function writeMarkdownReport(results, errors, outputDir, options) {
  const outputPath = path.join(outputDir, OUTPUT_FILES.markdown);
  
  const autoMergedCount = results.mergeSuggestions.filter(s => s.type === 'auto-merged').length;
  const conflictCount = results.mergeSuggestions.filter(s => s.type === 'conflict').length;
  
  let md = `# 渠道线索去重报告\n\n`;
  md += `生成时间: ${new Date().toLocaleString('zh-CN')}\n\n`;
  
  md += `## 处理摘要\n\n`;
  md += `| 指标 | 数值 |\n`;
  md += `|------|------|\n`;
  md += `| 总记录数 | ${results.total} |\n`;
  md += `| 去重后保留 | ${results.cleaned.length} |\n`;
  md += `| 重复组数 | ${results.duplicateGroups.length} |\n`;
  md += `| 涉及重复记录 | ${results.duplicateCount} |\n`;
  md += `| ✅ 自动补全字段 | ${autoMergedCount} |\n`;
  md += `| ⚠️ 需人工确认冲突 | ${conflictCount} |\n`;
  md += `| 坏行/异常数 | ${errors.length} |\n\n`;
  
  md += `## 处理配置\n\n`;
  md += `- 来源优先级: ${options.priority}\n`;
  md += `- 模糊匹配阈值: ${options.threshold}\n`;
  md += `- 保留模式: ${options.keepAll ? '保留所有重复' : '智能合并唯一记录'}\n\n`;

  if (results.duplicateGroups.length > 0) {
    md += `## 重复组详情\n\n`;
    
    for (const group of results.duplicateGroups.slice(0, 20)) {
      md += `### ${group.groupId}\n\n`;
      
      const selectedMergedFields = (group.mergedFields || []).filter(f => f.action === 'auto-filled');
      
      md += `**选定保留:** 行 ${group.selected.rowIndex}\n`;
      md += `**最终合并值:** 手机号="${group.selected.phone}", 邮箱="${group.selected.email}", 公司名="${group.selected.companyName}"\n\n`;
      
      if (selectedMergedFields.length > 0) {
        md += `**自动补全的字段:**\n\n`;
        for (const merged of selectedMergedFields) {
          md += `- ✅ ${merged.field}: "${merged.originalValue}" → "${merged.mergedValue}" (补自行 ${merged.sourceRow}, ${merged.sourceChannel})\n`;
        }
        md += '\n';
      }
      
      md += `| 行号 | 手机号 | 邮箱 | 公司名 | 来源 | 状态 |\n`;
      md += `|------|--------|------|--------|------|------|\n`;
      
      for (const member of group.members) {
        const status = member.isSelected ? '✓ 保留基准' : '× 重复';
        md += `| ${member.rowIndex} | ${member.phone || '-'} | ${member.email || '-'} | ${member.companyName || '-'} | ${member.channel || '-'} | ${status} |\n`;
      }
      md += '\n';

      if (group.conflicts && group.conflicts.length > 0) {
        md += `**字段冲突（需人工确认）:**\n\n`;
        for (const conflict of group.conflicts) {
          for (const field of conflict.fields) {
            md += `- ⚠️ **${field.field}**: 保留值="${field.selectedValue}", 重复行${field.duplicateRow}="${field.duplicateValue}"\n`;
          }
        }
        md += '\n';
      }
    }
    
    if (results.duplicateGroups.length > 20) {
      md += `> 还有 ${results.duplicateGroups.length - 20} 组重复，请查看 JSON 结果获取完整信息\n\n`;
    }
  }

  if (results.mergeSuggestions.length > 0) {
    const autoMerged = results.mergeSuggestions.filter(s => s.type === 'auto-merged');
    const conflicts = results.mergeSuggestions.filter(s => s.type === 'conflict');
    
    if (autoMerged.length > 0) {
      md += `## ✅ 自动补全的字段\n\n`;
      md += `以下字段已从重复记录中自动补全，无需人工干预：\n\n`;
      
      const mergedByGroup = {};
      for (const s of autoMerged.slice(0, 50)) {
        if (!mergedByGroup[s.groupId]) mergedByGroup[s.groupId] = [];
        mergedByGroup[s.groupId].push(s);
      }
      
      for (const [groupId, items] of Object.entries(mergedByGroup)) {
        md += `### ${groupId}\n\n`;
        for (const s of items) {
          md += `- **${s.field}**: ${s.suggestion}\n`;
        }
        md += '\n';
      }
      
      if (autoMerged.length > 50) {
        md += `> 还有 ${autoMerged.length - 50} 条自动补全记录，请查看 JSON 结果获取完整信息\n\n`;
      }
    }
    
    if (conflicts.length > 0) {
      md += `## ⚠️ 字段冲突（需人工确认）\n\n`;
      md += `以下字段存在多个有效值，请人工确认最终保留哪一个：\n\n`;
      
      const conflictsByGroup = {};
      for (const s of conflicts.slice(0, 50)) {
        if (!conflictsByGroup[s.groupId]) conflictsByGroup[s.groupId] = [];
        conflictsByGroup[s.groupId].push(s);
      }
      
      for (const [groupId, items] of Object.entries(conflictsByGroup)) {
        md += `### ${groupId}\n\n`;
        for (const s of items) {
          md += `- **${s.field}**: ${s.suggestion}\n`;
          if (s.alternatives && s.alternatives.length > 0) {
            md += `  备选值: ${s.alternatives.map(a => `"${a.value}" (行${a.sourceRow}, ${a.sourceChannel})`).join(', ')}\n`;
          }
        }
        md += '\n';
      }
      
      if (conflicts.length > 50) {
        md += `> 还有 ${conflicts.length - 50} 条冲突记录，请查看 JSON 结果获取完整信息\n\n`;
      }
    }
  }

  if (errors.length > 0) {
    md += `## 坏行/异常记录（保留原始位置）\n\n`;
    md += `| 行号 | 问题 |\n`;
    md += `|------|------|\n`;
    
    for (const error of errors.slice(0, 20)) {
      md += `| ${error.row} | ${error.issues.join('; ')} |\n`;
    }
    
    if (errors.length > 20) {
      md += `| ... | 还有 ${errors.length - 20} 条，请查看 error-rows.csv |\n`;
    }
    md += '\n';
  }

  md += `## 使用说明\n\n`;
  md += `1. **cleaned-leads.csv**: 去重后的线索数据，可直接使用\n`;
  md += `2. **duplicate-groups.csv**: 所有重复组的详细信息\n`;
  md += `3. **deduplication-results.json**: 机器可读的完整处理结果\n`;
  md += `4. **error-rows.csv**: 无法处理的坏行，请人工修正\n\n`;

  fs.writeFileSync(outputPath, md, 'utf-8');
}

async function writeCleanedCSV(cleaned, headers, outputDir) {
  const outputPath = path.join(outputDir, OUTPUT_FILES.cleaned);
  
  const allHeaders = [...headers, '_duplicateGroup', '_isSelected', '_mergedFrom'];
  
  const csvWriter = createObjectCsvWriter({
    path: outputPath,
    header: allHeaders.map(h => ({ id: h, title: h }))
  });

  const records = cleaned.map(lead => {
    const record = {};
    for (const h of headers) {
      record[h] = lead[h] || '';
    }
    record['_duplicateGroup'] = lead._duplicateGroup || '';
    record['_isSelected'] = lead._isSelected !== undefined ? lead._isSelected : '';
    record['_mergedFrom'] = lead._mergedFrom ? lead._mergedFrom.join(',') : '';
    return record;
  });

  await csvWriter.writeRecords(records);
}

async function writeDuplicateGroupsCSV(duplicateGroups, outputDir) {
  const outputPath = path.join(outputDir, OUTPUT_FILES.duplicates);
  
  const csvWriter = createObjectCsvWriter({
    path: outputPath,
    header: [
      { id: 'groupId', title: '重复组ID' },
      { id: 'rowIndex', title: '原始行号' },
      { id: 'phone', title: '手机号' },
      { id: 'email', title: '邮箱' },
      { id: 'companyName', title: '公司名' },
      { id: 'channel', title: '来源渠道' },
      { id: 'isSelected', title: '是否保留' }
    ]
  });

  const records = [];
  for (const group of duplicateGroups) {
    for (const member of group.members) {
      records.push({
        groupId: group.groupId,
        rowIndex: member.rowIndex,
        phone: member.phone,
        email: member.email,
        companyName: member.companyName,
        channel: member.channel,
        isSelected: member.isSelected ? '是' : '否'
      });
    }
  }

  await csvWriter.writeRecords(records);
}

async function writeErrorRowsCSV(errors, headers, outputDir) {
  const outputPath = path.join(outputDir, OUTPUT_FILES.errors);
  
  const csvWriter = createObjectCsvWriter({
    path: outputPath,
    header: [
      { id: 'originalRow', title: '原始行号' },
      ...headers.map(h => ({ id: h, title: h })),
      { id: 'issues', title: '问题描述' }
    ]
  });

  const records = errors.map(error => {
    const record = {
      originalRow: error.row,
      issues: error.issues.join('; ')
    };
    for (const h of headers) {
      record[h] = error.data[h] || '';
    }
    return record;
  });

  await csvWriter.writeRecords(records);
}

module.exports = {
  generateOutputs
};
