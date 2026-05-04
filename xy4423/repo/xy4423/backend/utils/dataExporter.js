const { EventStatus, ObservationType } = require('../models/dataModels');
const eventService = require('../services/eventService');

// 状态描述映射
const STATUS_DESCRIPTIONS = {
  [EventStatus.PENDING]: '待处理',
  [EventStatus.CONFIRMED]: '已确认',
  [EventStatus.REJECTED]: '已驳回',
  [EventStatus.NEEDS_REVIEW]: '需要人工复核',
  [EventStatus.DUPLICATE]: '重复观测',
  [EventStatus.CLOUD_OBSCURED]: '云层遮挡',
  [EventStatus.POWER_LOSS]: '设备掉电'
};

// 状态颜色映射（用于 Markdown 表格）
const STATUS_COLORS = {
  [EventStatus.PENDING]: '🟡',
  [EventStatus.CONFIRMED]: '🟢',
  [EventStatus.REJECTED]: '🔴',
  [EventStatus.NEEDS_REVIEW]: '🟠',
  [EventStatus.DUPLICATE]: '🟣',
  [EventStatus.CLOUD_OBSCURED]: '☁️',
  [EventStatus.POWER_LOSS]: '⚡'
};

// 生成 Markdown 复盘报告
async function generateMarkdownReport(eventIds = null, includeDetails = true) {
  let events = await eventService.getAllEvents();
  
  // 如果指定了事件 ID，只包含这些事件
  if (eventIds && Array.isArray(eventIds) && eventIds.length > 0) {
    events = events.filter(e => eventIds.includes(e.id));
  }
  
  // 按状态分组
  const eventsByStatus = groupEventsByStatus(events);
  
  // 生成报告
  const reportLines = [];
  
  // 标题
  reportLines.push('# 观测夜复盘报告');
  reportLines.push('');
  reportLines.push(`**生成时间**: ${new Date().toLocaleString('zh-CN')}`);
  reportLines.push(`**总事件数**: ${events.length}`);
  reportLines.push('');
  
  // 统计摘要
  reportLines.push('## 统计摘要');
  reportLines.push('');
  
  // 统计表格
  reportLines.push('| 状态 | 数量 | 描述 |');
  reportLines.push('|------|------|------|');
  
  for (const [status, statusEvents] of Object.entries(eventsByStatus)) {
    if (statusEvents.length > 0) {
      reportLines.push(`| ${STATUS_COLORS[status] || ''} ${STATUS_DESCRIPTIONS[status] || status} | ${statusEvents.length} | ${getStatusDescription(status)} |`);
    }
  }
  
  reportLines.push('');
  
  // 时间轴概览
  reportLines.push('## 时间轴概览');
  reportLines.push('');
  
  if (events.length > 0) {
    const sortedEvents = [...events].sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
    const firstEvent = sortedEvents[0];
    const lastEvent = sortedEvents[sortedEvents.length - 1];
    
    reportLines.push(`- **观测开始时间**: ${formatDateTime(firstEvent.startTime)}`);
    reportLines.push(`- **观测结束时间**: ${formatDateTime(lastEvent.endTime)}`);
    reportLines.push(`- **观测时长**: ${calculateDuration(firstEvent.startTime, lastEvent.endTime)}`);
    reportLines.push('');
  }
  
  // 详细事件列表
  if (includeDetails && events.length > 0) {
    reportLines.push('## 详细事件列表');
    reportLines.push('');
    
    const sortedEvents = [...events].sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
    
    for (const event of sortedEvents) {
      reportLines.push(`### ${STATUS_COLORS[event.status] || ''} 事件 ${event.id.substring(0, 8)}...`);
      reportLines.push('');
      reportLines.push(`- **状态**: ${STATUS_DESCRIPTIONS[event.status] || event.status}`);
      reportLines.push(`- **开始时间**: ${formatDateTime(event.startTime)}`);
      reportLines.push(`- **结束时间**: ${formatDateTime(event.endTime)}`);
      reportLines.push(`- **持续时间**: ${calculateDuration(event.startTime, event.endTime)}`);
      reportLines.push(`- **置信度**: ${event.confidence}%`);
      reportLines.push('');
      
      // 观测数据
      const cameraCount = event.observations.filter(o => o.type === ObservationType.CAMERA_TRIGGER).length;
      const visualCount = event.observations.filter(o => o.type === ObservationType.VISUAL_RECORD).length;
      
      reportLines.push(`#### 观测数据`);
      reportLines.push('');
      reportLines.push(`- 相机触发记录: ${cameraCount} 条`);
      reportLines.push(`- 目视记录: ${visualCount} 条`);
      reportLines.push('');
      
      // 系统分析
      reportLines.push(`#### 系统分析`);
      reportLines.push('');
      reportLines.push('```');
      reportLines.push(event.notes);
      reportLines.push('```');
      reportLines.push('');
      
      // 管理员备注
      if (event.adminComment && event.adminComment.trim()) {
        reportLines.push(`#### 管理员备注`);
        reportLines.push('');
        reportLines.push(`> ${event.adminComment}`);
        reportLines.push('');
      }
      
      // 分隔线
      reportLines.push('---');
      reportLines.push('');
    }
  }
  
  // 附录
  reportLines.push('## 附录');
  reportLines.push('');
  reportLines.push('### 状态说明');
  reportLines.push('');
  reportLines.push('- 🟡 **待处理**: 事件尚未进行人工审核');
  reportLines.push('- 🟢 **已确认**: 经人工确认是流星事件');
  reportLines.push('- 🔴 **已驳回**: 经人工确认不是流星（如噪点、飞机等）');
  reportLines.push('- 🟠 **需要人工复核**: 系统建议人工复核的事件');
  reportLines.push('- 🟣 **重复观测**: 同一事件被多次记录');
  reportLines.push('- ☁️ **云层遮挡**: 观测期间云量较高，可能影响观测质量');
  reportLines.push('- ⚡ **设备掉电**: 观测期间检测到低电量或掉电事件');
  reportLines.push('');
  
  return reportLines.join('\n');
}

// 生成 JSON 审计包
async function generateJSONAudit(eventIds = null) {
  let events = await eventService.getAllEvents();
  
  // 如果指定了事件 ID，只包含这些事件
  if (eventIds && Array.isArray(eventIds) && eventIds.length > 0) {
    events = events.filter(e => eventIds.includes(e.id));
  }
  
  // 生成审计包
  const auditPackage = {
    version: '1.0',
    generatedAt: new Date().toISOString(),
    summary: {
      totalEvents: events.length,
      byStatus: {}
    },
    events: events.map(event => ({
      id: event.id,
      status: event.status,
      statusDescription: STATUS_DESCRIPTIONS[event.status] || event.status,
      startTime: event.startTime,
      endTime: event.endTime,
      confidence: event.confidence,
      tags: event.tags,
      notes: event.notes,
      adminComment: event.adminComment,
      analysis: {
        ...event.analysis,
        duplicateOf: event.analysis.duplicateOf ? event.analysis.duplicateOf.substring(0, 8) + '...' : null
      },
      observations: event.observations.map(obs => ({
        id: obs.id,
        type: obs.type,
        sourceFile: obs.sourceFile,
        timestamp: obs.timestamp,
        rawData: obs.rawData
      })),
      createdAt: event.createdAt,
      updatedAt: event.updatedAt
    }))
  };
  
  // 计算按状态分组的统计
  const eventsByStatus = groupEventsByStatus(events);
  for (const [status, statusEvents] of Object.entries(eventsByStatus)) {
    if (statusEvents.length > 0) {
      auditPackage.summary.byStatus[status] = {
        count: statusEvents.length,
        description: STATUS_DESCRIPTIONS[status] || status
      };
    }
  }
  
  return auditPackage;
}

// 辅助函数：按状态分组事件
function groupEventsByStatus(events) {
  const grouped = {};
  
  // 初始化所有状态
  for (const status of Object.values(EventStatus)) {
    grouped[status] = [];
  }
  
  // 分组
  for (const event of events) {
    if (grouped[event.status]) {
      grouped[event.status].push(event);
    }
  }
  
  return grouped;
}

// 辅助函数：获取状态描述
function getStatusDescription(status) {
  const descriptions = {
    [EventStatus.PENDING]: '事件尚未进行人工审核',
    [EventStatus.CONFIRMED]: '经人工确认是流星事件',
    [EventStatus.REJECTED]: '经人工确认不是流星（如噪点、飞机等）',
    [EventStatus.NEEDS_REVIEW]: '系统建议人工复核的事件',
    [EventStatus.DUPLICATE]: '同一事件被多次记录',
    [EventStatus.CLOUD_OBSCURED]: '观测期间云量较高，可能影响观测质量',
    [EventStatus.POWER_LOSS]: '观测期间检测到低电量或掉电事件'
  };
  
  return descriptions[status] || '';
}

// 辅助函数：格式化日期时间
function formatDateTime(isoString) {
  if (!isoString) return '未知';
  
  try {
    const date = new Date(isoString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch (e) {
    return isoString;
  }
}

// 辅助函数：计算持续时间
function calculateDuration(startIso, endIso) {
  if (!startIso || !endIso) return '未知';
  
  try {
    const start = new Date(startIso);
    const end = new Date(endIso);
    const diffMs = end - start;
    
    if (diffMs < 0) return '未知';
    
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    
    if (diffHours > 0) {
      return `${diffHours} 小时 ${diffMinutes % 60} 分钟 ${diffSeconds % 60} 秒`;
    } else if (diffMinutes > 0) {
      return `${diffMinutes} 分钟 ${diffSeconds % 60} 秒`;
    } else {
      return `${diffSeconds} 秒`;
    }
  } catch (e) {
    return '未知';
  }
}

module.exports = {
  generateMarkdownReport,
  generateJSONAudit
};
