const { Order, OrderStatus } = require('../models/Order');
const { PaymentTransaction, TransactionStatus } = require('../models/PaymentTransaction');
const { IdempotencyKey, IdempotencyStatus } = require('../models/IdempotencyKey');
const { CallbackEvent, CallbackStatus } = require('../models/CallbackEvent');
const { AuditLog, AuditAction } = require('../models/AuditLog');
const { RequestFingerprint } = require('../models/RequestFingerprint');

class ReportGenerator {
  static async generateJSONReport(options = {}) {
    const { format = 'json', startDate, endDate } = options;

    const totalOrders = await Order.count();
    const totalTransactions = await PaymentTransaction.count();
    const totalIdempotencyKeys = await IdempotencyKey.count();
    const totalCallbacks = await CallbackEvent.count();
    const totalFingerprints = await RequestFingerprint.count();
    const totalAuditLogs = await AuditLog.count();

    const ordersByStatus = {
      pending: await Order.count({ status: OrderStatus.PENDING }),
      paid: await Order.count({ status: OrderStatus.PAID }),
      cancelled: await Order.count({ status: OrderStatus.CANCELLED }),
      refunded: await Order.count({ status: OrderStatus.REFUNDED })
    };

    const transactionsByStatus = {
      pending: await PaymentTransaction.count({ status: TransactionStatus.PENDING }),
      processing: await PaymentTransaction.count({ status: TransactionStatus.PROCESSING }),
      success: await PaymentTransaction.count({ status: TransactionStatus.SUCCESS }),
      failed: await PaymentTransaction.count({ status: TransactionStatus.FAILED }),
      refunded: await PaymentTransaction.count({ status: TransactionStatus.REFUNDED })
    };

    const idempotencyByStatus = await IdempotencyKey.getStatistics();
    
    const callbacksByStatus = {
      received: await CallbackEvent.count({ status: CallbackStatus.RECEIVED }),
      processing: await CallbackEvent.count({ status: CallbackStatus.PROCESSING }),
      processed: await CallbackEvent.count({ status: CallbackStatus.PROCESSED }),
      duplicate: await CallbackEvent.count({ status: CallbackStatus.DUPLICATE }),
      failed: await CallbackEvent.count({ status: CallbackStatus.FAILED })
    };

    const recentOrders = await Order.list({ limit: 10 });
    const recentTransactions = await PaymentTransaction.list({ limit: 10 });
    const recentIdempotencyKeys = await IdempotencyKey.list({ limit: 10 });
    const recentCallbacks = await CallbackEvent.list({ limit: 10 });
    const recentAuditLogs = await AuditLog.list({ limit: 20 });

    const report = {
      generated_at: new Date().toISOString(),
      summary: {
        total_orders: totalOrders,
        total_transactions: totalTransactions,
        total_idempotency_keys: totalIdempotencyKeys,
        total_callbacks: totalCallbacks,
        total_request_fingerprints: totalFingerprints,
        total_audit_logs: totalAuditLogs
      },
      statistics: {
        orders_by_status: ordersByStatus,
        transactions_by_status: transactionsByStatus,
        idempotency_by_status: idempotencyByStatus.reduce((acc, item) => {
          acc[item.status] = item.count;
          return acc;
        }, {}),
        callbacks_by_status: callbacksByStatus
      },
      idempotency_analysis: {
        success_rate: totalIdempotencyKeys > 0 
          ? ((transactionsByStatus.success / totalTransactions) * 100).toFixed(2) + '%'
          : 'N/A',
        duplicate_callbacks_detected: callbacksByStatus.duplicate,
        conflicts_detected: idempotencyByStatus.find(s => s.status === IdempotencyStatus.CONFLICT)?.count || 0,
        processing_in_progress: idempotencyByStatus.find(s => s.status === IdempotencyStatus.PROCESSING)?.count || 0
      },
      recent_data: {
        orders: recentOrders,
        transactions: recentTransactions,
        idempotency_keys: recentIdempotencyKeys,
        callbacks: recentCallbacks,
        audit_logs: recentAuditLogs
      }
    };

    if (format === 'markdown') {
      return this.generateMarkdownReport(report);
    }

    return report;
  }

  static generateMarkdownReport(data) {
    const { summary, statistics, idempotency_analysis, recent_data, generated_at } = data;

    return `# 接口幂等性演示服务 - 系统报告

> 生成时间: ${generated_at}

## 一、数据概览

| 指标 | 数值 |
|------|------|
| 总订单数 | ${summary.total_orders} |
| 总交易数 | ${summary.total_transactions} |
| 幂等键记录数 | ${summary.total_idempotency_keys} |
| 回调事件数 | ${summary.total_callbacks} |
| 请求指纹数 | ${summary.total_request_fingerprints} |
| 审计日志数 | ${summary.total_audit_logs} |

## 二、状态统计

### 2.1 订单状态分布

| 状态 | 数量 |
|------|------|
| 待支付 (pending) | ${statistics.orders_by_status.pending} |
| 已支付 (paid) | ${statistics.orders_by_status.paid} |
| 已取消 (cancelled) | ${statistics.orders_by_status.cancelled} |
| 已退款 (refunded) | ${statistics.orders_by_status.refunded} |

### 2.2 交易状态分布

| 状态 | 数量 |
|------|------|
| 待处理 (pending) | ${statistics.transactions_by_status.pending} |
| 处理中 (processing) | ${statistics.transactions_by_status.processing} |
| 成功 (success) | ${statistics.transactions_by_status.success} |
| 失败 (failed) | ${statistics.transactions_by_status.failed} |
| 已退款 (refunded) | ${statistics.transactions_by_status.refunded} |

### 2.3 幂等键状态分布

| 状态 | 数量 |
|------|------|
${Object.entries(statistics.idempotency_by_status).map(([k, v]) => `| ${k} | ${v} |`).join('\n')}

### 2.4 回调状态分布

| 状态 | 数量 |
|------|------|
| 已接收 (received) | ${statistics.callbacks_by_status.received} |
| 处理中 (processing) | ${statistics.callbacks_by_status.processing} |
| 已处理 (processed) | ${statistics.callbacks_by_status.processed} |
| 重复 (duplicate) | ${statistics.callbacks_by_status.duplicate} |
| 失败 (failed) | ${statistics.callbacks_by_status.failed} |

## 三、幂等性分析

| 指标 | 值 |
|------|---|
| 交易成功率 | ${idempotency_analysis.success_rate} |
| 检测到的重复回调数 | ${idempotency_analysis.duplicate_callbacks_detected} |
| 检测到的冲突数 | ${idempotency_analysis.conflicts_detected} |
| 处理中请求数 | ${idempotency_analysis.processing_in_progress} |

## 四、最近数据

### 4.1 最近订单

${recent_data.orders.length > 0 ? recent_data.orders.map(o => `
- **ID**: ${o.id}
  - 用户ID: ${o.user_id}
  - 商品: ${o.product_name}
  - 金额: ${o.amount}
  - 状态: ${o.status}
  - 创建时间: ${o.created_at}
`).join('') : '暂无数据'}

### 4.2 最近交易

${recent_data.transactions.length > 0 ? recent_data.transactions.map(t => `
- **ID**: ${t.id}
  - 订单ID: ${t.order_id}
  - 金额: ${t.amount}
  - 状态: ${t.status}
  - 网关交易ID: ${t.gateway_transaction_id || 'N/A'}
  - 创建时间: ${t.created_at}
`).join('') : '暂无数据'}

### 4.3 最近幂等键记录

${recent_data.idempotency_keys.length > 0 ? recent_data.idempotency_keys.map(k => `
- **Key**: ${k.key}
  - 路径: ${k.request_method} ${k.request_path}
  - 状态: ${k.status}
  - 创建时间: ${k.created_at}
`).join('') : '暂无数据'}

### 4.4 最近回调事件

${recent_data.callbacks.length > 0 ? recent_data.callbacks.map(c => `
- **ID**: ${c.id}
  - 订单ID: ${c.order_id || 'N/A'}
  - 交易ID: ${c.transaction_id || 'N/A'}
  - 回调类型: ${c.callback_type}
  - 状态: ${c.status}
  - 创建时间: ${c.created_at}
`).join('') : '暂无数据'}

---

*此报告由接口幂等性演示服务自动生成*
`;
  }

  static async exportReport(format = 'json') {
    const report = await this.generateJSONReport({ format });
    
    if (format === 'markdown') {
      return this.generateMarkdownReport(report);
    }
    
    return JSON.stringify(report, null, 2);
  }
}

module.exports = { ReportGenerator };
