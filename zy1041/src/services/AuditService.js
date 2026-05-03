const AuditLog = require('../models/AuditLog');
const Request = require('../models/Request');
const Order = require('../models/Order');
const { ORDER_STATUS_NAMES, AUDIT_ACTIONS } = require('../utils/constants');

const ACTION_NAMES = {
  [AUDIT_ACTIONS.REQUEST_CREATED]: '创建请求单',
  [AUDIT_ACTIONS.TRIP_CREATED]: '创建行程',
  [AUDIT_ACTIONS.MATCHING_ATTEMPTED]: '撮合尝试',
  [AUDIT_ACTIONS.MATCHING_SUCCESS]: '撮合成功',
  [AUDIT_ACTIONS.ORDER_LOCKED]: '锁定订单',
  [AUDIT_ACTIONS.ORDER_CONFIRMED]: '确认订单',
  [AUDIT_ACTIONS.ITEM_PICKED_UP]: '取到物品',
  [AUDIT_ACTIONS.ITEM_DELIVERED]: '送达物品',
  [AUDIT_ACTIONS.ORDER_CANCELLED]: '取消订单',
  [AUDIT_ACTIONS.ORDER_TIMEOUT]: '订单超时',
  [AUDIT_ACTIONS.DISPUTE_RAISED]: '发起争议',
  [AUDIT_ACTIONS.DISPUTE_RESOLVED]: '解决争议'
};

const ACTOR_TYPE_NAMES = {
  'requester': '发起人',
  'traveler': '顺路人',
  'system': '系统'
};

class AuditService {
  static async logEvent(data) {
    return AuditLog.create(data);
  }

  static async getRequestAuditLog(requestId) {
    const logs = await AuditLog.findByRequestId(requestId);
    const request = await Request.findById(requestId);
    const orders = await Order.findByRequestId(requestId);

    return {
      request: request,
      orders: orders,
      audit_logs: logs.map(log => ({
        ...log,
        action_name: ACTION_NAMES[log.action] || log.action,
        actor_type_name: ACTOR_TYPE_NAMES[log.actor_type] || log.actor_type
      }))
    };
  }

  static async exportToMarkdown(requestId) {
    const auditData = await this.getRequestAuditLog(requestId);
    const { request, orders, audit_logs } = auditData;

    if (!request) {
      return `# 请求单不存在\n\n未找到ID为 ${requestId} 的请求单。`;
    }

    let md = `# 顺路带物请求单日报\n\n`;
    md += `> 生成时间: ${new Date().toLocaleString('zh-CN')}\n\n`;

    md += `## 一、请求单基本信息\n\n`;
    md += `| 字段 | 值 |\n`;
    md += `|------|-----|\n`;
    md += `| 请求单ID | ${request.id} |\n`;
    md += `| 发起人ID | ${request.requester_id} |\n`;
    md += `| 取货点 | ${request.pickup_location} |\n`;
    md += `| 送达点 | ${request.dropoff_location} |\n`;
    md += `| 物品类型 | ${request.item_type} |\n`;
    md += `| 重量 | ${request.weight || 0} kg |\n`;
    md += `| 体积 | ${request.volume || 0} L |\n`;
    md += `| 最晚送达时间 | ${request.latest_delivery_time} |\n`;
    md += `| 小费 | ¥${request.tip_amount || 0} |\n`;
    md += `| 当前状态 | ${ORDER_STATUS_NAMES[request.status] || request.status} |\n`;
    if (request.notes) {
      md += `| 备注 | ${request.notes} |\n`;
    }
    md += `\n`;

    if (orders && orders.length > 0) {
      md += `## 二、相关订单信息\n\n`;
      for (const order of orders) {
        md += `### 订单 ${order.id}\n\n`;
        md += `| 字段 | 值 |\n`;
        md += `|------|-----|\n`;
        md += `| 订单状态 | ${ORDER_STATUS_NAMES[order.status] || order.status} |\n`;
        md += `| 顺路人ID | ${order.traveler_id} |\n`;
        md += `| 关联行程ID | ${order.trip_id} |\n`;
        md += `| 创建时间 | ${order.created_at} |\n`;
        md += `\n`;
      }
    }

    md += `## 三、事件日志\n\n`;
    if (!audit_logs || audit_logs.length === 0) {
      md += `暂无事件日志。\n\n`;
    } else {
      md += `| 序号 | 时间 | 操作 | 操作者 | 详情 |\n`;
      md += `|------|------|------|--------|------|\n`;

      audit_logs.forEach((log, index) => {
        const time = log.created_at ? new Date(log.created_at).toLocaleString('zh-CN') : '-';
        const action = log.action_name || log.action;
        const actor = `${log.actor_type_name} (${log.actor_id})`;
        const details = this.formatDetailsForMarkdown(log.details);
        
        md += `| ${index + 1} | ${time} | ${action} | ${actor} | ${details} |\n`;
      });
      md += `\n`;
    }

    md += `## 四、状态流转图\n\n`;
    md += `\`\`\`mermaid\n`;
    md += `stateDiagram-v2\n`;
    
    const statusSequence = this.buildStatusSequence(audit_logs);
    if (statusSequence.length > 0) {
      md += `    [*] --> ${statusSequence[0]}\n`;
      for (let i = 0; i < statusSequence.length - 1; i++) {
        md += `    ${statusSequence[i]} --> ${statusSequence[i + 1]}\n`;
      }
      const lastStatus = statusSequence[statusSequence.length - 1];
      if (['delivered', 'cancelled', 'timeout_released'].includes(lastStatus)) {
        md += `    ${lastStatus} --> [*]\n`;
      }
    }
    md += `\`\`\`\n\n`;

    md += `---\n\n`;
    md += `*本文档由顺路带物系统自动生成*\n`;

    return md;
  }

  static formatDetailsForMarkdown(details) {
    if (!details || Object.keys(details).length === 0) {
      return '-';
    }

    const parts = [];
    for (const [key, value] of Object.entries(details)) {
      if (value !== null && value !== undefined) {
        parts.push(`${key}: ${value}`);
      }
    }

    return parts.length > 0 ? parts.join('; ') : '-';
  }

  static buildStatusSequence(auditLogs) {
    const statusActions = {
      [AUDIT_ACTIONS.MATCHING_SUCCESS]: 'pending_matching',
      [AUDIT_ACTIONS.ORDER_LOCKED]: 'locked',
      [AUDIT_ACTIONS.ORDER_CONFIRMED]: 'both_confirmed',
      [AUDIT_ACTIONS.ITEM_PICKED_UP]: 'picked_up',
      [AUDIT_ACTIONS.ITEM_DELIVERED]: 'delivered',
      [AUDIT_ACTIONS.ORDER_CANCELLED]: 'cancelled',
      [AUDIT_ACTIONS.ORDER_TIMEOUT]: 'timeout_released',
      [AUDIT_ACTIONS.DISPUTE_RAISED]: 'in_dispute'
    };

    const sequence = [];
    for (const log of auditLogs) {
      const status = statusActions[log.action];
      if (status && !sequence.includes(status)) {
        sequence.push(status);
      }
    }

    return sequence;
  }

  static async exportAllToMarkdown(date = null) {
    const allLogs = await AuditLog.findAll();
    const allRequests = await Request.findAll();

    const targetDate = date ? new Date(date) : new Date();
    const dateStr = targetDate.toISOString().split('T')[0];

    const filteredLogs = allLogs.filter(log => {
      if (!log.created_at) return false;
      const logDate = new Date(log.created_at).toISOString().split('T')[0];
      return logDate === dateStr;
    });

    const requestIds = [...new Set(filteredLogs.map(l => l.request_id))];

    let md = `# 顺路带物系统日报\n\n`;
    md += `> 日期: ${dateStr}\n`;
    md += `> 生成时间: ${new Date().toLocaleString('zh-CN')}\n\n`;

    md += `## 今日概览\n\n`;
    md += `- 涉及请求单数: ${requestIds.length}\n`;
    md += `- 事件总数: ${filteredLogs.length}\n\n`;

    md += `## 各请求单详情\n\n`;
    md += `---\n\n`;

    for (const requestId of requestIds) {
      const request = allRequests.find(r => r.id === requestId);
      const requestLogs = filteredLogs.filter(l => l.request_id === requestId);

      if (request) {
        md += `### 请求单: ${requestId}\n\n`;
        md += `- 发起人: ${request.requester_id}\n`;
        md += `- 取货点: ${request.pickup_location} → 送达点: ${request.dropoff_location}\n`;
        md += `- 物品: ${request.item_type} (${request.weight || 0}kg/${request.volume || 0}L)\n`;
        md += `- 当前状态: ${ORDER_STATUS_NAMES[request.status] || request.status}\n`;
        md += `- 今日事件数: ${requestLogs.length}\n\n`;
      }

      md += `#### 事件日志\n\n`;
      for (const log of requestLogs) {
        const time = log.created_at ? new Date(log.created_at).toLocaleString('zh-CN') : '-';
        const action = ACTION_NAMES[log.action] || log.action;
        const actor = ACTOR_TYPE_NAMES[log.actor_type] || log.actor_type;
        
        md += `- **${time}** - ${actor}执行: ${action}`;
        if (log.details && Object.keys(log.details).length > 0) {
          md += ` (${this.formatDetailsForMarkdown(log.details)})`;
        }
        md += `\n`;
      }
      md += `\n---\n\n`;
    }

    return md;
  }
}

module.exports = AuditService;
