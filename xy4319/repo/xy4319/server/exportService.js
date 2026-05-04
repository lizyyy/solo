const { allQuery, getQuery } = require('./database');
const { TRIAGE_LEVELS } = require('./rulesEngine');
const { format } = require('date-fns');
const { zhCN } = require('date-fns/locale');

async function generateMarkdownReport(sessionId = null) {
  const now = new Date();
  
  // 获取基本统计
  const patients = await allQuery(`
    SELECT * FROM patients 
    ORDER BY arrivalTime DESC
  `);
  
  const departments = await allQuery(`
    SELECT * FROM departments 
    ORDER BY name
  `);
  
  const logs = await allQuery(`
    SELECT * FROM operation_logs 
    ORDER BY timestamp DESC
    LIMIT 500
  `);
  
  const incidents = await allQuery(`
    SELECT * FROM incidents 
    ORDER BY timestamp DESC
  `);
  
  const transfers = await allQuery(`
    SELECT tq.*, p.name as patientName, p.triageLevel
    FROM transfer_queue tq
    LEFT JOIN patients p ON tq.patientId = p.id
    ORDER BY tq.assignedAt DESC
  `);
  
  // 统计数据
  const stats = {
    totalPatients: patients.length,
    byTriageLevel: {
      red: patients.filter(p => p.triageLevel === 'red').length,
      yellow: patients.filter(p => p.triageLevel === 'yellow').length,
      green: patients.filter(p => p.triageLevel === 'green').length
    },
    byStatus: {},
    totalIncidents: incidents.length,
    criticalIncidents: incidents.filter(i => i.severity === 'critical').length,
    totalTransfers: transfers.length,
    completedTransfers: transfers.filter(t => t.status === 'completed').length,
    totalLogs: logs.length
  };
  
  patients.forEach(p => {
    stats.byStatus[p.status] = (stats.byStatus[p.status] || 0) + 1;
  });
  
  // 生成 Markdown
  let markdown = `# 急诊演练复盘报告\n\n`;
  markdown += `**生成时间**: ${format(now, 'yyyy年MM月dd日 HH:mm:ss', { locale: zhCN })}\n\n`;
  markdown += `---\n\n`;
  
  // 概览
  markdown += `## 📊 演练概览\n\n`;
  markdown += `| 指标 | 数值 |\n`;
  markdown += `|------|------|\n`;
  markdown += `| 总患者数 | ${stats.totalPatients} |\n`;
  markdown += `| 红区患者 | ${stats.byTriageLevel.red} |\n`;
  markdown += `| 黄区患者 | ${stats.byTriageLevel.yellow} |\n`;
  markdown += `| 绿区患者 | ${stats.byTriageLevel.green} |\n`;
  markdown += `| 异常事件 | ${stats.totalIncidents} |\n`;
  markdown += `| 严重事件 | ${stats.criticalIncidents} |\n`;
  markdown += `| 转运请求 | ${stats.totalTransfers} |\n`;
  markdown += `| 已完成转运 | ${stats.completedTransfers} |\n\n`;
  
  // 分诊统计
  markdown += `## 🏥 分诊统计\n\n`;
  markdown += `### 按分诊级别分布\n\n`;
  const triagePercentages = {
    red: stats.totalPatients > 0 ? ((stats.byTriageLevel.red / stats.totalPatients) * 100).toFixed(1) : 0,
    yellow: stats.totalPatients > 0 ? ((stats.byTriageLevel.yellow / stats.totalPatients) * 100).toFixed(1) : 0,
    green: stats.totalPatients > 0 ? ((stats.byTriageLevel.green / stats.totalPatients) * 100).toFixed(1) : 0
  };
  markdown += `- **红区**: ${stats.byTriageLevel.red} 人 (${triagePercentages.red}%)\n`;
  markdown += `- **黄区**: ${stats.byTriageLevel.yellow} 人 (${triagePercentages.yellow}%)\n`;
  markdown += `- **绿区**: ${stats.byTriageLevel.green} 人 (${triagePercentages.green}%)\n\n`;
  
  // 科室容量
  markdown += `## 🛏️ 科室容量状态\n\n`;
  markdown += `| 科室 | 总床位 | 可用床位 | 使用率 | 状态 |\n`;
  markdown += `|------|--------|----------|--------|------|\n`;
  departments.forEach(dept => {
    const usageRate = dept.totalBeds > 0 
      ? ((dept.totalBeds - dept.availableBeds) / dept.totalBeds * 100).toFixed(1) 
      : 0;
    let status = '正常';
    if (dept.availableBeds === 0) status = '已满';
    else if (dept.availableBeds <= 2) status = '紧张';
    markdown += `| ${dept.name} | ${dept.totalBeds} | ${dept.availableBeds} | ${usageRate}% | ${status} |\n`;
  });
  markdown += `\n`;
  
  // 异常事件
  markdown += `## ⚠️ 异常事件汇总\n\n`;
  if (incidents.length === 0) {
    markdown += `本次演练无异常事件记录。\n\n`;
  } else {
    markdown += `| 时间 | 类型 | 严重程度 | 描述 | 状态 |\n`;
    markdown += `|------|------|----------|------|------|\n`;
    incidents.forEach(incident => {
      const time = incident.timestamp 
        ? format(new Date(incident.timestamp), 'HH:mm:ss', { locale: zhCN })
        : '-';
      const severityLabel = {
        warning: '警告',
        error: '错误',
        critical: '严重'
      }[incident.severity] || incident.severity;
      const resolved = incident.isResolved ? '已解决' : '未解决';
      markdown += `| ${time} | ${incident.type} | ${severityLabel} | ${incident.description || '-'} | ${resolved} |\n`;
    });
    markdown += `\n`;
  }
  
  // 转运情况
  markdown += `## 🚑 转运情况\n\n`;
  if (transfers.length === 0) {
    markdown += `本次演练无转运记录。\n\n`;
  } else {
    markdown += `| 患者 | 分诊级别 | 优先级 | 队列位置 | 状态 | 分配时间 |\n`;
    markdown += `|------|----------|--------|----------|------|----------|\n`;
    transfers.forEach(transfer => {
      const triageLabel = TRIAGE_LEVELS[transfer.triageLevel]?.label || '-';
      const statusLabel = {
        pending: '等待中',
        in_progress: '进行中',
        completed: '已完成',
        cancelled: '已取消'
      }[transfer.status] || transfer.status;
      const time = transfer.assignedAt 
        ? format(new Date(transfer.assignedAt), 'HH:mm:ss', { locale: zhCN })
        : '-';
      markdown += `| ${transfer.patientName || '-'} | ${triageLabel} | ${transfer.priority} | ${transfer.queuePosition || '-'} | ${statusLabel} | ${time} |\n`;
    });
    markdown += `\n`;
  }
  
  // 操作日志摘要
  markdown += `## 📝 操作日志摘要\n\n`;
  markdown += `本次演练共记录 ${stats.totalLogs} 条操作日志。\n\n`;
  
  if (logs.length > 0) {
    const recentLogs = logs.slice(0, 20);
    markdown += `### 最近 20 条操作\n\n`;
    markdown += `| 时间 | 操作 | 实体类型 | 严重程度 |\n`;
    markdown += `|------|------|----------|----------|\n`;
    recentLogs.forEach(log => {
      const time = log.timestamp 
        ? format(new Date(log.timestamp), 'HH:mm:ss', { locale: zhCN })
        : '-';
      const actionLabel = {
        patient_created: '患者创建',
        patient_updated: '患者更新',
        patient_triage_changed: '分诊变更',
        wait_timeout: '等待超时',
        transfer_missed: '转运漏看',
        bed_conflict: '床位冲突',
        transfer_requested: '转运请求',
        transfer_completed: '转运完成'
      }[log.action] || log.action;
      const severityLabel = {
        debug: '调试',
        info: '信息',
        warning: '警告',
        error: '错误',
        critical: '严重'
      }[log.severity] || log.severity;
      markdown += `| ${time} | ${actionLabel} | ${log.entityType || '-'} | ${severityLabel} |\n`;
    });
    markdown += `\n`;
  }
  
  // 建议改进
  markdown += `## 💡 改进建议\n\n`;
  const suggestions = [];
  
  if (stats.criticalIncidents > 0) {
    suggestions.push(`- **严重事件处理**: 本次演练出现 ${stats.criticalIncidents} 起严重事件，建议加强红区患者的快速响应机制。`);
  }
  
  const waitingPatients = patients.filter(p => p.status === 'waiting');
  if (waitingPatients.length > 5) {
    suggestions.push(`- **候诊积压**: 当前有 ${waitingPatients.length} 名患者正在等待，建议增加分诊人员或优化分诊流程。`);
  }
  
  const departmentsWithCapacityIssue = departments.filter(d => d.availableBeds <= 2);
  if (departmentsWithCapacityIssue.length > 0) {
    suggestions.push(`- **床位紧张**: ${departmentsWithCapacityIssue.map(d => d.name).join('、')} 等科室床位紧张，建议考虑扩容或转诊机制。`);
  }
  
  const missedTransfers = transfers.filter(t => t.status === 'pending');
  if (missedTransfers.length > 0) {
    suggestions.push(`- **转运积压**: 有 ${missedTransfers.length} 个转运请求待处理，建议检查转运资源配置。`);
  }
  
  if (suggestions.length === 0) {
    suggestions.push('- 本次演练整体运行良好，无明显需要改进的问题。');
  }
  
  suggestions.forEach(s => {
    markdown += `${s}\n\n`;
  });
  
  // 页脚
  markdown += `---\n\n`;
  markdown += `*报告由分诊转运压测台系统自动生成*\n`;
  
  return {
    markdown,
    stats,
    patients,
    departments,
    incidents,
    transfers,
    logs
  };
}

async function generateCSVIncidents(sessionId = null) {
  const incidents = await allQuery(`
    SELECT i.*, p.name as patientName
    FROM incidents i
    LEFT JOIN patients p ON i.patientId = p.id
    ORDER BY i.timestamp DESC
  `);
  
  const csvLines = [];
  
  // 表头
  csvLines.push(['时间', '事件类型', '严重程度', '患者ID', '患者姓名', '描述', '是否已解决', '解决时间'].join(','));
  
  // 数据行
  incidents.forEach(incident => {
    const time = incident.timestamp 
      ? format(new Date(incident.timestamp), 'yyyy-MM-dd HH:mm:ss', { locale: zhCN })
      : '';
    const resolvedAt = incident.resolvedAt 
      ? format(new Date(incident.resolvedAt), 'yyyy-MM-dd HH:mm:ss', { locale: zhCN })
      : '';
    const severityLabel = {
      warning: '警告',
      error: '错误',
      critical: '严重'
    }[incident.severity] || incident.severity;
    const resolved = incident.isResolved ? '是' : '否';
    
    const escapedDescription = (incident.description || '').replace(/"/g, '""');
    
    csvLines.push([
      `"${time}"`,
      `"${incident.type}"`,
      `"${severityLabel}"`,
      `"${incident.patientId || ''}"`,
      `"${incident.patientName || ''}"`,
      `"${escapedDescription}"`,
      `"${resolved}"`,
      `"${resolvedAt}"`
    ].join(','));
  });
  
  return csvLines.join('\n');
}

async function generateCSVPatients(sessionId = null) {
  const patients = await allQuery(`
    SELECT * FROM patients 
    ORDER BY arrivalTime DESC
  `);
  
  const csvLines = [];
  
  // 表头
  csvLines.push(['患者ID', '姓名', '年龄', '性别', '主诉', '分诊级别', '到院时间', '状态', '目标科室', '备注'].join(','));
  
  // 数据行
  patients.forEach(patient => {
    const triageLabel = TRIAGE_LEVELS[patient.triageLevel]?.label || patient.triageLevel;
    const arrivalTime = patient.arrivalTime 
      ? format(new Date(patient.arrivalTime), 'yyyy-MM-dd HH:mm:ss', { locale: zhCN })
      : '';
    const statusLabel = {
      waiting: '等待中',
      triage: '分诊中',
      treatment: '治疗中',
      transferred: '已转运',
      discharged: '已出院'
    }[patient.status] || patient.status;
    
    const escapedComplaint = (patient.chiefComplaint || '').replace(/"/g, '""');
    const escapedNotes = (patient.notes || '').replace(/"/g, '""');
    
    csvLines.push([
      `"${patient.id}"`,
      `"${patient.name}"`,
      `"${patient.age || ''}"`,
      `"${patient.gender || ''}"`,
      `"${escapedComplaint}"`,
      `"${triageLabel}"`,
      `"${arrivalTime}"`,
      `"${statusLabel}"`,
      `"${patient.targetDepartment || ''}"`,
      `"${escapedNotes}"`
    ].join(','));
  });
  
  return csvLines.join('\n');
}

module.exports = {
  generateMarkdownReport,
  generateCSVIncidents,
  generateCSVPatients
};
