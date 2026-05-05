const store = require('../store');
const analysisService = require('./analysisService');

class ReportService {
  generateJSONReport(taskId) {
    const task = store.getReplayTask(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    const results = store.getAnalysisResultsByTaskId(taskId);
    const statistics = analysisService.getStatistics();

    const report = {
      id: taskId,
      title: `Message Queue Analysis Report - ${task.name}`,
      generatedAt: new Date().toISOString(),
      task: task.toJSON(),
      summary: {
        totalMessages: task.messageIds.length,
        analyzedMessages: results.length,
        problemsFound: results.reduce((sum, r) => sum + r.problems.length, 0),
        statusBreakdown: {}
      },
      problems: {
        ackLost: [],
        duplicateDeliveries: [],
        maxRetryReached: [],
        deadLetter: [],
        orderKeyViolation: [],
        consumerBacklog: [],
        idempotencyRisk: []
      },
      details: results.map(r => r.toJSON()),
      statistics: statistics
    };

    for (const result of results) {
      if (!report.summary.statusBreakdown[result.finalStatus]) {
        report.summary.statusBreakdown[result.finalStatus] = 0;
      }
      report.summary.statusBreakdown[result.finalStatus]++;

      if (result.ackLost) {
        report.problems.ackLost.push({
          messageId: result.messageId,
          problems: result.problems.filter(p => p.type === 'ack_lost')
        });
      }

      if (result.duplicateDeliveries > 0) {
        report.problems.duplicateDeliveries.push({
          messageId: result.messageId,
          count: result.duplicateDeliveries,
          problems: result.problems.filter(p => p.type === 'duplicate_delivery')
        });
      }

      if (result.maxRetryReached) {
        report.problems.maxRetryReached.push({
          messageId: result.messageId,
          problems: result.problems.filter(p => p.type === 'max_retry_reached')
        });
      }

      if (result.deadLetterReason) {
        report.problems.deadLetter.push({
          messageId: result.messageId,
          reason: result.deadLetterReason,
          problems: result.problems.filter(p => p.type === 'dead_letter')
        });
      }

      if (result.orderKeyViolation) {
        report.problems.orderKeyViolation.push({
          messageId: result.messageId,
          problems: result.problems.filter(p => p.type === 'order_key_violation')
        });
      }

      if (result.consumerBacklog > 0) {
        report.problems.consumerBacklog.push({
          messageId: result.messageId,
          backlog: result.consumerBacklog,
          problems: result.problems.filter(p => p.type === 'consumer_backlog')
        });
      }

      if (result.idempotencyRisk) {
        report.problems.idempotencyRisk.push({
          messageId: result.messageId,
          problems: result.problems.filter(p => p.type === 'idempotency_risk')
        });
      }
    }

    return store.addReport({
      taskId,
      format: 'json',
      title: report.title,
      summary: report.summary,
      details: report
    });
  }

  generateMarkdownReport(taskId) {
    const task = store.getReplayTask(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    const results = store.getAnalysisResultsByTaskId(taskId);
    const statistics = analysisService.getStatistics();

    const now = new Date().toISOString();
    let markdown = `# Message Queue Analysis Report\n\n`;
    markdown += `**Generated At:** ${now}\n\n`;
    markdown += `**Task:** ${task.name}\n`;
    markdown += `**Task ID:** ${taskId}\n\n`;
    markdown += `---\n\n`;

    markdown += `## Summary\n\n`;
    markdown += `- **Total Messages:** ${task.messageIds.length}\n`;
    markdown += `- **Analyzed Messages:** ${results.length}\n`;
    const totalProblems = results.reduce((sum, r) => sum + r.problems.length, 0);
    markdown += `- **Total Problems Found:** ${totalProblems}\n\n`;

    markdown += `### Status Breakdown\n\n`;
    const statusCounts = {};
    for (const result of results) {
      statusCounts[result.finalStatus] = (statusCounts[result.finalStatus] || 0) + 1;
    }
    
    for (const [status, count] of Object.entries(statusCounts)) {
      const statusEmoji = this.getStatusEmoji(status);
      markdown += `- ${statusEmoji} **${status}**: ${count}\n`;
    }
    markdown += `\n---\n\n`;

    markdown += `## Problem Analysis\n\n`;

    const ackLostMessages = results.filter(r => r.ackLost);
    if (ackLostMessages.length > 0) {
      markdown += `### 🔴 ACK Lost\n\n`;
      markdown += `**Count:** ${ackLostMessages.length}\n\n`;
      markdown += `**Description:** Consumer processed message but broker never received confirmation.\n\n`;
      markdown += `**Affected Messages:**\n\n`;
      for (const result of ackLostMessages) {
        markdown += `- \`${result.messageId}\`\n`;
      }
      markdown += `\n`;
    }

    const duplicateMessages = results.filter(r => r.duplicateDeliveries > 0);
    if (duplicateMessages.length > 0) {
      markdown += `### 🟠 Duplicate Deliveries\n\n`;
      markdown += `**Count:** ${duplicateMessages.length}\n\n`;
      markdown += `**Description:** Messages were delivered multiple times.\n\n`;
      markdown += `**Affected Messages:**\n\n`;
      for (const result of duplicateMessages) {
        markdown += `- \`${result.messageId}\` - ${result.duplicateDeliveries + 1} deliveries (${result.duplicateDeliveries} duplicates)\n`;
      }
      markdown += `\n`;
    }

    const maxRetryMessages = results.filter(r => r.maxRetryReached);
    if (maxRetryMessages.length > 0) {
      markdown += `### 🔴 Max Retry Reached\n\n`;
      markdown += `**Count:** ${maxRetryMessages.length}\n\n`;
      markdown += `**Description:** Messages reached maximum retry attempts.\n\n`;
      markdown += `**Affected Messages:**\n\n`;
      for (const result of maxRetryMessages) {
        markdown += `- \`${result.messageId}\`\n`;
      }
      markdown += `\n`;
    }

    const deadLetterMessages = results.filter(r => r.deadLetterReason);
    if (deadLetterMessages.length > 0) {
      markdown += `### 💀 Dead Letter Queue\n\n`;
      markdown += `**Count:** ${deadLetterMessages.length}\n\n`;
      markdown += `**Description:** Messages were sent to dead letter queue.\n\n`;
      markdown += `**Affected Messages:**\n\n`;
      for (const result of deadLetterMessages) {
        markdown += `- \`${result.messageId}\` - Reason: ${result.deadLetterReason}\n`;
      }
      markdown += `\n`;
    }

    const orderKeyViolations = results.filter(r => r.orderKeyViolation);
    if (orderKeyViolations.length > 0) {
      markdown += `### 🟡 Order Key Violation\n\n`;
      markdown += `**Count:** ${orderKeyViolations.length}\n\n`;
      markdown += `**Description:** Messages with same order key were processed out of order.\n\n`;
      markdown += `**Affected Messages:**\n\n`;
      for (const result of orderKeyViolations) {
        const message = store.getMessage(result.messageId);
        markdown += `- \`${result.messageId}\` - Order Key: ${message?.orderKey || 'unknown'}\n`;
      }
      markdown += `\n`;
    }

    const idempotencyRisks = results.filter(r => r.idempotencyRisk);
    if (idempotencyRisks.length > 0) {
      markdown += `### 🔴 Idempotency Risk\n\n`;
      markdown += `**Count:** ${idempotencyRisks.length}\n\n`;
      markdown += `**Description:** Messages have idempotency risk - no unique key for deduplication.\n\n`;
      markdown += `**Affected Messages:**\n\n`;
      for (const result of idempotencyRisks) {
        markdown += `- \`${result.messageId}\`\n`;
      }
      markdown += `\n`;
    }

    markdown += `---\n\n`;
    markdown += `## Statistics\n\n`;
    markdown += `- **Total Messages:** ${statistics.totalMessages}\n`;
    markdown += `- **Total Delivery Events:** ${statistics.totalDeliveryEvents}\n`;
    markdown += `- **Total Analysis Results:** ${statistics.totalAnalysisResults}\n\n`;

    markdown += `### Problem Statistics\n\n`;
    for (const [problem, count] of Object.entries(statistics.problemCounts)) {
      if (count > 0) {
        markdown += `- **${problem}**: ${count}\n`;
      }
    }

    markdown += `\n---\n\n`;
    markdown += `## Recommendations\n\n`;
    markdown += `Based on the analysis, here are recommendations:\n\n`;

    if (ackLostMessages.length > 0) {
      markdown += `### ACK Lost Issues\n`;
      markdown += `- Review consumer ACK timeout settings\n`;
      markdown += `- Check for network issues between consumer and broker\n`;
      markdown += `- Ensure consumer has proper error handling before sending ACK\n\n`;
    }

    if (duplicateMessages.length > 0) {
      markdown += `### Duplicate Delivery Issues\n`;
      markdown += `- Implement idempotent consumers\n`;
      markdown += `- Use message IDs or unique keys for deduplication\n`;
      markdown += `- Review retry policies and ACK behavior\n\n`;
    }

    if (maxRetryMessages.length > 0 || deadLetterMessages.length > 0) {
      markdown += `### Retry & Dead Letter Issues\n`;
      markdown += `- Review dead letter queue messages for root cause\n`;
      markdown += `- Consider implementing exponential backoff\n`;
      markdown += `- Add alerts for messages approaching max retry count\n\n`;
    }

    if (orderKeyViolations.length > 0) {
      markdown += `### Ordering Issues\n`;
      markdown += `- Ensure messages with same order key go to same partition\n`;
      markdown += `- Review partition key strategy\n`;
      markdown += `- Consider using strict ordering if required\n\n`;
    }

    markdown += `---\n\n`;
    markdown += `## Detailed Message Analysis\n\n`;

    for (const result of results) {
      markdown += `### Message: \`${result.messageId}\`\n\n`;
      markdown += `- **Final Status:** ${this.getStatusEmoji(result.finalStatus)} ${result.finalStatus}\n`;
      
      if (result.ackLost) {
        markdown += `- **ACK Lost:** Yes 🔴\n`;
      }
      
      if (result.duplicateDeliveries > 0) {
        markdown += `- **Duplicate Deliveries:** ${result.duplicateDeliveries} 🟠\n`;
      }
      
      if (result.maxRetryReached) {
        markdown += `- **Max Retry Reached:** Yes 🔴\n`;
      }
      
      if (result.deadLetterReason) {
        markdown += `- **Dead Letter Reason:** ${result.deadLetterReason} 💀\n`;
      }
      
      if (result.orderKeyViolation) {
        markdown += `- **Order Key Violation:** Yes 🟡\n`;
      }
      
      if (result.idempotencyRisk) {
        markdown += `- **Idempotency Risk:** Yes 🔴\n`;
      }
      
      if (result.problems.length > 0) {
        markdown += `\n**Problems:**\n\n`;
        for (const problem of result.problems) {
          const severityEmoji = problem.severity === 'critical' ? '💀' : 
                                  problem.severity === 'high' ? '🔴' : 
                                  problem.severity === 'medium' ? '🟠' : '🟡';
          markdown += `- ${severityEmoji} [${problem.severity.toUpperCase()}] ${problem.message}\n`;
        }
      }
      
      markdown += `\n---\n\n`;
    }

    return store.addReport({
      taskId,
      format: 'markdown',
      title: `Message Queue Analysis Report - ${task.name}`,
      summary: {
        totalMessages: task.messageIds.length,
        analyzedMessages: results.length,
        problemsFound: totalProblems
      },
      details: markdown
    });
  }

  getStatusEmoji(status) {
    const emojis = {
      'success': '✅',
      'failed': '❌',
      'retrying': '🔄',
      'dead-letter': '💀',
      'ack-lost': '🔴',
      'processing': '⏳',
      'undelivered': '📭',
      'unknown': '❓'
    };
    return emojis[status] || '❓';
  }

  exportReport(reportId) {
    const report = store.getReport(reportId);
    if (!report) {
      throw new Error(`Report not found: ${reportId}`);
    }

    if (report.format === 'markdown') {
      return {
        format: 'markdown',
        content: report.details,
        filename: `report-${reportId}.md`
      };
    } else {
      return {
        format: 'json',
        content: JSON.stringify(report.details, null, 2),
        filename: `report-${reportId}.json`
      };
    }
  }
}

module.exports = new ReportService();
