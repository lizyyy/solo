import fs from 'fs/promises';

export function formatJson(data, pretty) {
  if (pretty === undefined) pretty = true;
  return pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
}

export function formatMarkdown(data, title) {
  if (title === undefined) title = '查询结果';
  
  let md = '# ' + title + '\n\n';
  md += '> 查询时间: ' + data.queryTime + '\n\n';
  md += '**总数: ' + data.totalCount + '**\n\n';

  if (data.filters) {
    md += '## 过滤条件\n\n';
    const filterEntries = Object.entries(data.filters).filter(function(entry) {
      return entry[1] !== undefined;
    });
    if (filterEntries.length > 0) {
      md += '| 条件 | 值 |\n|------|----|\n';
      for (let i = 0; i < filterEntries.length; i++) {
        const key = filterEntries[i][0];
        const value = filterEntries[i][1];
        md += '| ' + key + ' | ' + value + ' |\n';
      }
    } else {
      md += '无过滤条件\n';
    }
    md += '\n';
  }

  if (data.batches) {
    md += '## 批次列表\n\n';
    md += '| 批次ID | 记录数 | 失败数 | 脏数据 | 边界输入 | 操作者 | 风险类型 |\n';
    md += '|--------|--------|--------|--------|----------|--------|----------|\n';
    for (let i = 0; i < data.batches.length; i++) {
      const batch = data.batches[i];
      md += '| ' + batch.batchId + 
           ' | ' + batch.recordCount + 
           ' | ' + batch.failureCount + 
           ' | ' + batch.dirtyCount + 
           ' | ' + batch.boundaryCount + 
           ' | ' + batch.operators.join(', ') + 
           ' | ' + batch.riskTypes.join(', ') + ' |\n';
    }
    md += '\n';
  }

  if (data.records && data.records.length > 0) {
    md += '## 记录详情\n\n';
    
    const firstRecord = data.records[0];
    
    if (firstRecord.reminders) {
      md += '### 审批催办记录\n\n';
      md += '| 记录ID | 系统 | 操作者 | 当前状态 | 催办次数 | 催办详情 |\n';
      md += '|--------|------|--------|----------|----------|----------|\n';
      for (let i = 0; i < data.records.length; i++) {
        const record = data.records[i];
        const reminderText = record.reminders
          .map(function(r) { return r.time.slice(0, 16) + ' - ' + r.remark; })
          .join('<br>');
        md += '| ' + record.id + 
             ' | ' + record.system + 
             ' | ' + record.operator + 
             ' | ' + record.status + 
             ' | ' + record.reminderCount + 
             ' | ' + reminderText + ' |\n';
      }
    } else {
      md += '| 记录ID | 批次ID | 系统 | 旧版本 | 新版本 | 风险类型 | 操作者 | 状态 | 失败原因 | 脏数据 |\n';
      md += '|--------|--------|------|--------|--------|----------|--------|------|----------|--------|\n';
      const displayCount = Math.min(50, data.records.length);
      for (let i = 0; i < displayCount; i++) {
        const record = data.records[i];
        const isDirty = record.isDirty ? '是' : '否';
        const failureReason = record.failureReason || '-';
        md += '| ' + record.id + 
             ' | ' + record.batchId + 
             ' | ' + record.system + 
             ' | ' + record.oldVersion + 
             ' | ' + record.newVersion + 
             ' | ' + record.riskName + 
             ' | ' + record.operator + 
             ' | ' + record.status + 
             ' | ' + failureReason + 
             ' | ' + isDirty + ' |\n';
      }
      if (data.records.length > 50) {
        md += '\n> 显示前 50 条，共 ' + data.records.length + ' 条记录\n';
      }
    }
    md += '\n';

    md += '## 状态变化追踪（复盘用）\n\n';
    const historyCount = Math.min(20, data.records.length);
    for (let i = 0; i < historyCount; i++) {
      const record = data.records[i];
      if (record.statusHistory && record.statusHistory.length > 0) {
        md += '### ' + record.id + ' - ' + record.system + '\n\n';
        md += '| 时间 | 状态 | 操作者 | 备注 |\n';
        md += '|------|------|--------|------|\n';
        for (let j = 0; j < record.statusHistory.length; j++) {
          const history = record.statusHistory[j];
          md += '| ' + history.timestamp.slice(0, 19) + 
               ' | ' + history.status + 
               ' | ' + history.operator + 
               ' | ' + (history.remark || '-') + ' |\n';
        }
        md += '\n';
      }
    }
  }

  return md;
}

export async function saveJson(data, outputPath) {
  const json = formatJson(data);
  await fs.writeFile(outputPath, json, 'utf-8');
  return outputPath;
}

export async function saveMarkdown(data, outputPath, title) {
  const md = formatMarkdown(data, title);
  await fs.writeFile(outputPath, md, 'utf-8');
  return outputPath;
}

export function formatConsole(data) {
  console.log('\n========================================');
  console.log('查询时间: ' + data.queryTime);
  console.log('记录总数: ' + data.totalCount);
  if (data.filters) {
    console.log('过滤条件:', data.filters);
  }
  console.log('========================================\n');

  if (data.records) {
    for (let i = 0; i < data.records.length; i++) {
      const record = data.records[i];
      console.log('[' + record.status + '] ' + record.id);
      console.log('  系统: ' + record.system);
      console.log('  版本: ' + record.oldVersion + ' -> ' + record.newVersion);
      console.log('  操作者: ' + record.operator);
      console.log('  风险类型: ' + record.riskName);
      if (record.failureReason) {
        console.log('  失败原因: ' + record.failureReason);
      }
      if (record.isDirty) {
        console.log('  脏数据: ' + record.dirtyRemark);
      }
      if (record.approverList && record.approverList.length > 0) {
        console.log('  审批催办: ' + record.approverList.join(', '));
      }
      console.log('');
    }
  }
}
