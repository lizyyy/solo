class Exporter {
  constructor(storage) {
    this.storage = storage;
  }

  formatTimestamp(timestamp) {
    return new Date(timestamp * 1000).toISOString();
  }

  exportToJSON(options = {}) {
    const subscriptionId = options.subscriptionId;
    const includeEvents = options.includeEvents !== false;
    const includeLogs = options.includeLogs !== false;
    const includeDeadLetters = options.includeDeadLetters !== false;

    const result = {
      exported_at: this.formatTimestamp(Math.floor(Date.now() / 1000)),
      subscriptions: [],
      events: [],
      delivery_logs: [],
      dead_letters: []
    };

    const subscriptions = subscriptionId 
      ? [this.storage.getSubscription(subscriptionId)]
      : this.storage.listSubscriptions();

    result.subscriptions = subscriptions.filter(s => s);

    if (includeEvents) {
      for (const sub of result.subscriptions) {
        const events = this.storage.getEventsBySubscription(sub.id);
        result.events.push(...events);
      }
    }

    if (includeLogs) {
      result.delivery_logs = this.storage.getAllDeliveryLogs(subscriptionId, 10000);
    }

    if (includeDeadLetters) {
      result.dead_letters = this.storage.getDeadLetters(subscriptionId);
    }

    return result;
  }

  exportToMarkdown(options = {}) {
    const data = this.exportToJSON(options);
    const lines = [];

    lines.push('# Webhook 投递审计报告');
    lines.push('');
    lines.push(`> 导出时间: ${data.exported_at}`);
    lines.push('');
    lines.push('---');
    lines.push('');

    lines.push('## 订阅概览');
    lines.push('');
    lines.push('| ID | 端点 | 状态 | 创建时间 |');
    lines.push('|----|------|------|----------|');
    
    for (const sub of data.subscriptions) {
      const status = sub.active ? '活跃' : '停用';
      lines.push(`| ${sub.id} | ${sub.endpoint} | ${status} | ${this.formatTimestamp(sub.created_at)} |`);
    }
    lines.push('');

    if (data.events.length > 0) {
      lines.push('## 事件记录');
      lines.push('');
      
      for (const event of data.events) {
        lines.push(`### 事件: ${event.event_type}`);
        lines.push('');
        lines.push(`- **ID**: ${event.id}`);
        lines.push(`- **订阅 ID**: ${event.subscription_id}`);
        lines.push(`- **状态**: ${event.status}`);
        if (event.idempotency_key) {
          lines.push(`- **幂等键**: ${event.idempotency_key}`);
        }
        lines.push(`- **创建时间**: ${this.formatTimestamp(event.created_at)}`);
        lines.push('');
        lines.push('#### Payload');
        lines.push('');
        lines.push('```json');
        lines.push(JSON.stringify(event.payload, null, 2));
        lines.push('```');
        lines.push('');
      }
    }

    if (data.delivery_logs.length > 0) {
      lines.push('## 投递日志');
      lines.push('');
      lines.push('| 时间 | 事件类型 | 尝试次数 | 状态 | HTTP 状态码 | 错误信息 |');
      lines.push('|------|----------|----------|------|-------------|----------|');
      
      for (const log of data.delivery_logs) {
        const statusIcon = log.status === 'success' ? '✅' : '❌';
        const statusCode = log.status_code || '-';
        const error = log.error_message || '-';
        lines.push(`| ${this.formatTimestamp(log.delivered_at)} | ${log.event_type} | ${log.attempt} | ${statusIcon} ${log.status} | ${statusCode} | ${error} |`);
      }
      lines.push('');
    }

    if (data.dead_letters.length > 0) {
      lines.push('## 死信队列');
      lines.push('');
      lines.push('> 以下事件投递失败并已进入死信队列，需要人工处理');
      lines.push('');
      
      for (const dl of data.dead_letters) {
        lines.push(`### ${dl.event_type}`);
        lines.push('');
        lines.push(`- **ID**: ${dl.id}`);
        lines.push(`- **事件 ID**: ${dl.event_id}`);
        lines.push(`- **最后错误**: ${dl.last_error}`);
        lines.push(`- **入队时间**: ${this.formatTimestamp(dl.created_at)}`);
        lines.push('');
        lines.push('#### Payload');
        lines.push('');
        lines.push('```json');
        lines.push(JSON.stringify(dl.payload, null, 2));
        lines.push('```');
        lines.push('');
      }
    }

    const stats = this.storage.getStats();
    lines.push('## 统计信息');
    lines.push('');
    lines.push('| 指标 | 数值 |');
    lines.push('|------|------|');
    lines.push(`| 订阅数 | ${stats.subscriptions} |`);
    lines.push(`| 总事件数 | ${stats.events.total} |`);
    lines.push(`| 成功投递 | ${stats.events.success} |`);
    lines.push(`| 失败事件 | ${stats.events.failed} |`);
    lines.push(`| 待处理 | ${stats.events.pending} |`);
    lines.push(`| 死信数 | ${stats.events.dead_letters} |`);
    lines.push(`| 总投递尝试 | ${stats.deliveries} |`);
    lines.push('');

    return lines.join('\n');
  }

  export(format, options = {}) {
    switch (format.toLowerCase()) {
      case 'md':
      case 'markdown':
        return {
          format: 'markdown',
          content: this.exportToMarkdown(options),
          contentType: 'text/markdown'
        };
      case 'json':
      default:
        return {
          format: 'json',
          content: this.exportToJSON(options),
          contentType: 'application/json'
        };
    }
  }
}

module.exports = Exporter;