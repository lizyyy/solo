const TimelineManager = require('./timeline');
const RetryManager = require('./retry-manager');
const WarehouseService = require('../services/warehouse-service');
const AccountingService = require('../services/accounting-service');
const LogisticsService = require('../services/logistics-service');

const ReportExporter = {
  exportJSON: (transactionId) => {
    const timelineDetail = TimelineManager.getTimelineWithDetails(transactionId);
    
    if (!timelineDetail) {
      return { error: 'Transaction not found' };
    }

    const retryHistory = RetryManager.getRetryHistory(transactionId);
    const warehouseOps = WarehouseService.getOperationHistory(transactionId);
    const accountOps = AccountingService.getOperationHistory(transactionId);
    const logisticsOps = LogisticsService.getOperationHistory(transactionId);
    const shipment = LogisticsService.getShipmentByTransaction(transactionId);

    return {
      exportAt: new Date().toISOString(),
      transaction: {
        id: timelineDetail.transactionId,
        businessType: timelineDetail.businessType,
        status: timelineDetail.status,
        idempotencyKey: timelineDetail.idempotencyKey,
        createdAt: timelineDetail.createdAt,
        updatedAt: timelineDetail.updatedAt,
        payload: timelineDetail.payload
      },
      shipment: shipment ? {
        shipmentNo: shipment.shipment_no,
        fromAddress: shipment.from_address,
        toAddress: shipment.to_address,
        items: JSON.parse(shipment.items),
        status: shipment.status
      } : null,
      timeline: timelineDetail.timeline,
      retryHistory: retryHistory.map(r => ({
        step: r.step,
        attemptCount: r.attempt_count,
        status: r.status,
        timestamp: r.created_at
      })),
      operations: {
        warehouse: warehouseOps,
        accounting: accountOps,
        logistics: logisticsOps
      }
    };
  },

  exportMarkdown: (transactionId) => {
    const data = this.exportJSON(transactionId);
    
    if (data.error) {
      return `# 错误\n\n${data.error}`;
    }

    const tx = data.transaction;
    const getStatusIcon = (status) => {
      const icons = {
        'SUCCESS': '✅',
        'START': '⏳',
        'FAILED': '❌',
        'RETRY': '🔄',
        'CONFIRMED': '✅',
        'CANCELLED': '⚠️',
        'FAILED': '❌',
        'PREPARED': '⏳'
      };
      return icons[status] || '❓';
    };

    let md = `# 分布式事务复盘报告\n\n`;
    md += `**导出时间**: ${data.exportAt}\n\n`;
    md += `---\n\n`;

    md += `## 事务基本信息\n\n`;
    md += `| 字段 | 值 |\n|------|-----|\n`;
    md += `| 事务ID | ${tx.id} |\n`;
    md += `| 业务类型 | ${tx.businessType} |\n`;
    md += `| 当前状态 | ${getStatusIcon(tx.status)} ${tx.status} |\n`;
    md += `| 幂等键 | ${tx.idempotencyKey || '无'} |\n`;
    md += `| 创建时间 | ${tx.createdAt} |\n`;
    md += `| 更新时间 | ${tx.updatedAt} |\n\n`;

    md += `## 事务请求详情\n\n`;
    md += `\`\`\`json\n${JSON.stringify(tx.payload, null, 2)}\n\`\`\`\n\n`;

    if (data.shipment) {
      md += `## 运单信息\n\n`;
      md += `| 字段 | 值 |\n|------|-----|\n`;
      md += `| 运单号 | ${data.shipment.shipmentNo} |\n`;
      md += `| 发货地址 | ${data.shipment.fromAddress} |\n`;
      md += `| 收货地址 | ${data.shipment.toAddress} |\n`;
      md += `| 商品 | ${JSON.stringify(data.shipment.items)} |\n`;
      md += `| 状态 | ${getStatusIcon(data.shipment.status)} ${data.shipment.status} |\n\n`;
    }

    md += `## 执行时间线\n\n`;
    md += `| 序号 | 步骤 | 状态 | 时间 | 消息 |\n`;
    md += `|------|------|------|------|------|\n`;
    data.timeline.forEach((t, idx) => {
      md += `| ${idx + 1} | ${t.step} | ${getStatusIcon(t.status)} ${t.status} | ${t.timestamp} | ${t.message || '-'} |\n`;
    });
    md += '\n';

    if (data.retryHistory.length > 0) {
      md += `## 重试记录\n\n`;
      md += `| 步骤 | 尝试次数 | 状态 | 时间 |\n`;
      md += `|------|----------|------|------|\n`;
      data.retryHistory.forEach(r => {
        md += `| ${r.step} | ${r.attemptCount} | ${getStatusIcon(r.status)} ${r.status} | ${r.timestamp} |\n`;
      });
      md += '\n';
    }

    md += `## 服务操作记录\n\n`;
    
    if (data.operations.warehouse.length > 0) {
      md += `### 仓库服务\n\n`;
      md += `| SKU | 源仓库 | 目标仓库 | 数量 | 操作 | 状态 |\n`;
      md += `|-----|--------|----------|------|------|------|\n`;
      data.operations.warehouse.forEach(op => {
        md += `| ${op.sku} | ${op.from_location || '-'} | ${op.to_location || '-'} | ${op.quantity} | ${op.operation_type} | ${getStatusIcon(op.status)} ${op.status} |\n`;
      });
      md += '\n';
    }

    if (data.operations.accounting.length > 0) {
      md += `### 账务服务\n\n`;
      md += `| 账户 | 金额 | 操作 | 状态 |\n`;
      md += `|------|------|------|------|\n`;
      data.operations.accounting.forEach(op => {
        md += `| ${op.account_id} | ${op.amount} | ${op.operation_type} | ${getStatusIcon(op.status)} ${op.status} |\n`;
      });
      md += '\n';
    }

    if (data.operations.logistics.length > 0) {
      md += `### 物流服务\n\n`;
      md += `| 运单号 | 操作 | 状态 |\n`;
      md += `|--------|------|------|\n`;
      data.operations.logistics.forEach(op => {
        md += `| ${op.shipment_no} | ${op.operation_type} | ${getStatusIcon(op.status)} ${op.status} |\n`;
      });
      md += '\n';
    }

    md += `---\n\n`;
    md += `*此报告由分布式事务演练系统自动生成*\n`;

    return md;
  },

  exportAllTransactions: () => {
    const transactions = TimelineManager.listAllTransactions();
    
    return {
      exportAt: new Date().toISOString(),
      total: transactions.length,
      transactions: transactions.map(tx => ({
        id: tx.id,
        businessType: tx.business_type,
        status: tx.status,
        createdAt: tx.created_at,
        updatedAt: tx.updated_at
      }))
    };
  }
};

module.exports = ReportExporter;
