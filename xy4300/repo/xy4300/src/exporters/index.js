const dayjs = require('dayjs');

const STATUS_DISPLAY = {
  in_stock: '在库',
  borrowed: '借出',
  inspecting: '检验中',
  scrapped: '已报废'
};

const RISK_LEVEL_DISPLAY = {
  critical: '严重',
  high: '高',
  medium: '中',
  low: '低'
};

const RISK_TYPE_DISPLAY = {
  expired_inspection: '过期未检',
  gas_mixup: '气体混放',
  duplicate_flow: '重复流转',
  missing_empty_cylinder: '空瓶未追回'
};

function exportToMarkdown(logs) {
  if (!logs || logs.length === 0) {
    return '# 审计日志\n\n暂无数据';
  }

  let md = '# 审计日志报告\n\n';
  md += `生成时间: ${dayjs().format('YYYY-MM-DD HH:mm:ss')}\n\n`;
  md += `总计: ${logs.length} 条记录\n\n`;
  md += '---\n\n';

  for (const log of logs) {
    md += `## 操作ID: ${log.id}\n\n`;
    md += `- **操作类型**: ${log.operation}\n`;
    md += `- **操作表**: ${log.table_name || 'N/A'}\n`;
    md += `- **记录ID**: ${log.record_id || 'N/A'}\n`;
    md += `- **操作用户**: ${log.user || 'system'}\n`;
    md += `- **IP地址**: ${log.ip_address || 'N/A'}\n`;
    md += `- **操作时间**: ${log.created_at}\n\n`;
    
    if (log.old_values) {
      md += `**旧值**:\n\`\`\`json\n${log.old_values}\n\`\`\`\n\n`;
    }
    
    if (log.new_values) {
      md += `**新值**:\n\`\`\`json\n${log.new_values}\n\`\`\`\n\n`;
    }
    
    md += '---\n\n';
  }

  return md;
}

function exportToCSV(logs) {
  if (!logs || logs.length === 0) {
    return 'id,operation,table_name,record_id,user,ip_address,created_at';
  }

  const headers = ['id', 'operation', 'table_name', 'record_id', 'user', 'ip_address', 'created_at', 'old_values', 'new_values'];
  let csv = headers.join(',') + '\n';

  for (const log of logs) {
    const row = [
      log.id,
      escapeCSV(log.operation),
      escapeCSV(log.table_name || ''),
      log.record_id || '',
      escapeCSV(log.user || ''),
      escapeCSV(log.ip_address || ''),
      log.created_at,
      escapeCSV(log.old_values || ''),
      escapeCSV(log.new_values || '')
    ];
    csv += row.join(',') + '\n';
  }

  return csv;
}

function escapeCSV(value) {
  if (value === null || value === undefined) {
    return '';
  }
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function exportInventoryToMarkdown(inventory, stats) {
  let md = '# 库存盘点报告\n\n';
  md += `生成时间: ${dayjs().format('YYYY-MM-DD HH:mm:ss')}\n\n`;
  md += '## 统计概览\n\n';
  md += `- **总气瓶数**: ${stats.total}\n`;
  md += `- **在库**: ${stats.byStatus.inStock}\n`;
  md += `- **借出**: ${stats.byStatus.borrowed}\n`;
  md += `- **检验中**: ${stats.byStatus.inspecting}\n`;
  md += `- **已报废**: ${stats.byStatus.scrapped}\n\n`;

  if (Object.keys(stats.byGasType).length > 0) {
    md += '## 按气体类型统计\n\n';
    md += '| 气体类型 | 数量 |\n';
    md += '|----------|------|\n';
    for (const [type, count] of Object.entries(stats.byGasType)) {
      md += `| ${type} | ${count} |\n`;
    }
    md += '\n';
  }

  if (Object.keys(stats.byLocation).length > 0) {
    md += '## 按位置统计\n\n';
    md += '| 位置 | 数量 |\n';
    md += '|------|------|\n';
    for (const [location, count] of Object.entries(stats.byLocation)) {
      md += `| ${location} | ${count} |\n`;
    }
    md += '\n';
  }

  if (inventory && inventory.length > 0) {
    md += '## 气瓶明细\n\n';
    md += '| 编号 | 气体类型 | 容量 | 状态 | 位置 | 下次检验日期 |\n';
    md += '|------|----------|------|------|------|--------------|\n';
    
    for (const cylinder of inventory) {
      md += `| ${cylinder.serial_number} | ${cylinder.gas_type} | ${cylinder.capacity || '-'} | ${STATUS_DISPLAY[cylinder.status] || cylinder.status} | ${cylinder.location || '-'} | ${cylinder.next_inspection_date || '-'} |\n`;
    }
  }

  return md;
}

function exportInventoryToCSV(inventory) {
  if (!inventory || inventory.length === 0) {
    return 'serial_number,gas_type,capacity,status,location,next_inspection_date';
  }

  const headers = ['serial_number', 'gas_type', 'capacity', 'status', 'location', 'next_inspection_date', 'last_inspection_date', 'manufacturer'];
  let csv = headers.join(',') + '\n';

  for (const cylinder of inventory) {
    const row = [
      escapeCSV(cylinder.serial_number),
      escapeCSV(cylinder.gas_type),
      cylinder.capacity || '',
      escapeCSV(STATUS_DISPLAY[cylinder.status] || cylinder.status),
      escapeCSV(cylinder.location || ''),
      cylinder.next_inspection_date || '',
      cylinder.last_inspection_date || '',
      escapeCSV(cylinder.manufacturer || '')
    ];
    csv += row.join(',') + '\n';
  }

  return csv;
}

function exportRiskAlertsToMarkdown(alerts) {
  if (!alerts || alerts.length === 0) {
    return '# 风险告警报告\n\n暂无风险告警';
  }

  let md = '# 风险告警报告\n\n';
  md += `生成时间: ${dayjs().format('YYYY-MM-DD HH:mm:ss')}\n\n`;
  md += `总计: ${alerts.length} 条告警\n\n`;
  md += '---\n\n';

  const grouped = groupBy(alerts, 'risk_type');
  
  for (const [type, items] of Object.entries(grouped)) {
    md += `## ${RISK_TYPE_DISPLAY[type] || type} (${items.length}条)\n\n`;
    
    for (const alert of items) {
      md += `### 告警ID: ${alert.id}\n\n`;
      md += `- **风险等级**: ${RISK_LEVEL_DISPLAY[alert.risk_level] || alert.risk_level}\n`;
      md += `- **状态**: ${alert.status}\n`;
      md += `- **描述**: ${alert.description}\n`;
      md += `- **创建时间**: ${alert.created_at}\n`;
      if (alert.reviewed_by) {
        md += `- **复核人**: ${alert.reviewed_by}\n`;
        md += `- **复核时间**: ${alert.reviewed_at || '-'}\n`;
      }
      md += '\n';
    }
  }

  return md;
}

function groupBy(array, key) {
  return array.reduce((result, item) => {
    (result[item[key]] = result[item[key]] || []).push(item);
    return result;
  }, {});
}

module.exports = {
  exportToMarkdown,
  exportToCSV,
  exportInventoryToMarkdown,
  exportInventoryToCSV,
  exportRiskAlertsToMarkdown,
  STATUS_DISPLAY,
  RISK_LEVEL_DISPLAY,
  RISK_TYPE_DISPLAY
};
