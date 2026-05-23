const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const path = require('path');
const fs = require('fs');
const config = require('../config');
const { canViewSensitiveData } = require('../models/user');

function maskPhone(phone) {
  if (!phone) return '';
  const str = String(phone);
  if (str.length <= 7) return str;
  return str.slice(0, 3) + '****' + str.slice(-4);
}

function maskName(name) {
  if (!name) return '';
  const str = String(name);
  if (str.length <= 1) return str;
  return str[0] + '*'.repeat(str.length - 1);
}

function maskIdCard(idCard) {
  if (!idCard) return '';
  const str = String(idCard);
  if (str.length <= 10) return str;
  return str.slice(0, 6) + '********' + str.slice(-4);
}

function maskPassword(password) {
  if (!password) return '';
  return '***';
}

function maskSensitiveData(data, userRole) {
  if (canViewSensitiveData(userRole)) {
    return data;
  }

  const masked = { ...data };
  
  if (masked.guest_phone) {
    masked.guest_phone = maskPhone(masked.guest_phone);
  }
  if (masked.guest_name) {
    masked.guest_name = maskName(masked.guest_name);
  }
  if (masked.guest_id_card) {
    masked.guest_id_card = maskIdCard(masked.guest_id_card);
  }
  if (masked.room_password) {
    masked.room_password = maskPassword(masked.room_password);
  }
  if (masked.cleaner_phone) {
    masked.cleaner_phone = maskPhone(masked.cleaner_phone);
  }

  return masked;
}

function ensureExportDir() {
  const exportDir = path.join(process.cwd(), 'exports');
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }
  return exportDir;
}

async function exportOrdersToCsv(orders, userRole, filename = null) {
  const exportDir = ensureExportDir();
  const exportFilename = filename || `orders_${Date.now()}.csv`;
  const filePath = path.join(exportDir, exportFilename);

  const maskedOrders = orders.map(order => maskSensitiveData(order, userRole));

  const csvWriter = createCsvWriter({
    path: filePath,
    header: [
      { id: 'order_no', title: '订单号' },
      { id: 'room_no', title: '房间号' },
      { id: 'guest_name', title: '客人姓名' },
      { id: 'guest_phone', title: '客人电话' },
      { id: 'check_in_date', title: '入住日期' },
      { id: 'check_out_date', title: '退房日期' },
      { id: 'is_extended', title: '是否连住' },
      { id: 'linen_change_required', title: '是否换布草' },
      { id: 'cleaning_type', title: '保洁类型' },
      { id: 'cleaning_time', title: '保洁时间' },
      { id: 'status', title: '状态' },
      { id: 'workflow_status', title: '工作流状态' },
      { id: 'is_conflict', title: '是否冲突' },
      { id: 'conflict_reason', title: '冲突原因' },
      { id: 'is_missed', title: '是否漏房' },
      { id: 'missed_reason', title: '漏房原因' },
      { id: 'operator_name', title: '操作人' },
      { id: 'created_at', title: '创建时间' },
    ],
  });

  await csvWriter.writeRecords(maskedOrders);
  
  return {
    filename: exportFilename,
    path: filePath,
    recordCount: orders.length,
  };
}

async function exportMessagesToCsv(messages, userRole, filename = null) {
  const exportDir = ensureExportDir();
  const exportFilename = filename || `messages_${Date.now()}.csv`;
  const filePath = path.join(exportDir, exportFilename);

  const maskedMessages = messages.map(msg => maskSensitiveData(msg, userRole));

  const csvWriter = createCsvWriter({
    path: filePath,
    header: [
      { id: 'message_id', title: '消息ID' },
      { id: 'room_no', title: '房间号' },
      { id: 'cleaner_name', title: '保洁员' },
      { id: 'cleaner_phone', title: '保洁员电话' },
      { id: 'message_type', title: '消息类型' },
      { id: 'content', title: '内容' },
      { id: 'send_time', title: '发送时间' },
      { id: 'sender_name', title: '发送人' },
      { id: 'status', title: '状态' },
      { id: 'workflow_status', title: '工作流状态' },
      { id: 'operator_name', title: '操作人' },
      { id: 'created_at', title: '导入时间' },
    ],
  });

  await csvWriter.writeRecords(maskedMessages);
  
  return {
    filename: exportFilename,
    path: filePath,
    recordCount: messages.length,
  };
}

async function exportMaintenanceToCsv(notes, userRole, filename = null) {
  const exportDir = ensureExportDir();
  const exportFilename = filename || `maintenance_${Date.now()}.csv`;
  const filePath = path.join(exportDir, exportFilename);

  const csvWriter = createCsvWriter({
    path: filePath,
    header: [
      { id: 'room_no', title: '房间号' },
      { id: 'issue_type', title: '问题类型' },
      { id: 'description', title: '描述' },
      { id: 'reporter', title: '报告人' },
      { id: 'report_time', title: '报告时间' },
      { id: 'priority', title: '优先级' },
      { id: 'status', title: '状态' },
      { id: 'workflow_status', title: '工作流状态' },
      { id: 'handler', title: '处理人' },
      { id: 'handle_time', title: '处理时间' },
      { id: 'handle_result', title: '处理结果' },
      { id: 'operator_name', title: '操作人' },
      { id: 'created_at', title: '创建时间' },
    ],
  });

  await csvWriter.writeRecords(notes);
  
  return {
    filename: exportFilename,
    path: filePath,
    recordCount: notes.length,
  };
}

function generateReport(orders, messages, maintenance, conflicts, failedTasks) {
  const now = new Date().toLocaleString('zh-CN');
  
  const report = {
    generatedAt: now,
    summary: {
      totalOrders: orders.length,
      totalMessages: messages.length,
      totalMaintenance: maintenance.length,
      conflicts: conflicts.length,
      failedTasks: failedTasks.length,
    },
    details: {
      orderWorkflowStats: countByStatus(orders, 'workflow_status'),
      messageWorkflowStats: countByStatus(messages, 'workflow_status'),
      maintenanceWorkflowStats: countByStatus(maintenance, 'workflow_status'),
      missedRooms: orders.filter(o => o.is_missed).length,
      conflictRooms: conflicts,
    },
    recentChanges: [],
    recommendations: generateRecommendations(orders, messages, maintenance, conflicts, failedTasks),
  };

  return report;
}

function countByStatus(items, statusField) {
  const counts = {};
  items.forEach(item => {
    const status = item[statusField];
    counts[status] = (counts[status] || 0) + 1;
  });
  return counts;
}

function generateRecommendations(orders, messages, maintenance, conflicts, failedTasks) {
  const recommendations = [];

  if (conflicts.length > 0) {
    recommendations.push({
      level: 'high',
      type: 'conflict',
      message: `发现 ${conflicts.length} 个房间订单冲突，请立即处理`,
      action: '查看冲突订单列表，调整保洁排班',
    });
  }

  const missedCount = orders.filter(o => o.is_missed).length;
  if (missedCount > 0) {
    recommendations.push({
      level: 'high',
      type: 'missed',
      message: `发现 ${missedCount} 个漏房记录`,
      action: '核查漏房原因，补做保洁',
    });
  }

  const draftOrders = orders.filter(o => o.workflow_status === 'draft').length;
  if (draftOrders > 0) {
    recommendations.push({
      level: 'medium',
      type: 'workflow',
      message: `有 ${draftOrders} 个订单处于草稿状态`,
      action: '请及时提交审核',
    });
  }

  if (failedTasks.length > 0) {
    recommendations.push({
      level: 'high',
      type: 'task',
      message: `有 ${failedTasks.length} 个异步任务失败需要人工处理`,
      action: '查看失败任务列表，手动重试或处理',
    });
  }

  const pendingMaintenance = maintenance.filter(m => m.status === 'pending').length;
  if (pendingMaintenance > 5) {
    recommendations.push({
      level: 'medium',
      type: 'maintenance',
      message: `待处理维修工单较多 (${pendingMaintenance} 个)`,
      action: '请安排维修人员及时处理',
    });
  }

  return recommendations;
}

module.exports = {
  maskSensitiveData,
  maskPhone,
  maskName,
  maskIdCard,
  maskPassword,
  exportOrdersToCsv,
  exportMessagesToCsv,
  exportMaintenanceToCsv,
  generateReport,
};
