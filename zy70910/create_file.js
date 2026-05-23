const fs = require('fs');

const reportGeneratorContent = `const ReportGenerator = {
  getDiscrepancyTypeName: (type) => {
    const typeNames = {
      UNDEDUCTED: "未扣费异常",
      DUPLICATE_REFUND: "重复退款异常",
      CROSS_PLATFORM: "跨平台订单异常",
      AMOUNT_MISMATCH: "金额不匹配异常",
      TIME_MISMATCH: "时间不匹配异常",
      STATUS_MISMATCH: "状态不匹配异常"
    };
    return typeNames[type] || "未知异常";
  },

  getStatusName: (status) => {
    const statusNames = {
      PENDING: "待处理",
      APPROVED: "已放行",
      REJECTED: "已退回",
      INFO_REQUESTED: "待补材料"
    };
    return statusNames[status] || status;
  },

  getOperationName: (operation) => {
    const operationNames = {
      APPROVE: "放行",
      REJECT: "退回",
      REQUEST_INFO: "要求补材料"
    };
    return operationNames[operation] || operation;
  },

  formatDiscrepancyForReport: (discrepancy) => {
    const description = discrepancy.description ? JSON.parse(discrepancy.description) : {};
    return {
      discrepancyId: discrepancy.discrepancy_id,
      orderId: discrepancy.order_id,
      type: discrepancy.discrepancy_type,
      typeName: ReportGenerator.getDiscrepancyTypeName(discrepancy.discrepancy_type),
      status: discrepancy.status,
      statusName: ReportGenerator.getStatusName(discrepancy.status),
      result: discrepancy.result,
      description: description,
      descriptionText: ReportGenerator.formatDescription(description, discrepancy.discrepancy_type)
    };
  },

  formatDescription: (description, type) => {
    const descriptions = {
      UNDEDUCTED: \`订单金额: ¥\${description.order || 0}, 充电记录数: \${description.logs || 0}条\`,
      DUPLICATE_REFUND: \`退款次数: \${description.refundCount || 0}次\`,
      CROSS_PLATFORM: \`订单来源: \${description.order_platform || "未知"}, 支付渠道: \${description.payment_channel || "未知"}\`,
      AMOUNT_MISMATCH: \`订单金额: ¥\${description.order_amount || 0}, 支付金额: ¥\${description.payment_amount || 0}, 差额: ¥\${description.diff || 0}\`,
      TIME_MISMATCH: \`时间差异: \${description.diffMinutes || 0}分钟\`,
      STATUS_MISMATCH: \`订单状态: \${description.order_status || "未知"}, 支付状态: \${description.payment_status || "未知"}\`
    };
    return descriptions[type] || JSON.stringify(description);
  },

  generateAuditTrail: (reviewLogs) => {
    if (!reviewLogs || reviewLogs.length === 0) {
      return [];
    }

    return reviewLogs.map((log, index) => ({
      sequence: index + 1,
      operation: log.operation_type,
      operationName: ReportGenerator.getOperationName(log.operation_type),
      operator: log.operator,
      previousStatus: log.previous_status,
      previousStatusName: ReportGenerator.getStatusName(log.previous_status),
      nextStatus: log.next_status,
      nextStatusName: ReportGenerator.getStatusName(log.next_status),
      remark: log.remark || "",
      timestamp: log.timestamp
    }));
  },

  generateCSVContent: (data, columns) => {
    const header = columns.map(c => c.title).join(",");
    const rows = data.map(item => {
      return columns.map(col => {
        let value = item[col.key] || "";
        if (typeof value === "string" && (value.includes(",") || value.includes('"') || value.includes("\n"))) {
          value = '"' + value.replace(/"/g, '""') + '"';
        }
        return value;
      }).join(",");
    });

    return [header, ...rows].join("\n");
  },

  buildSummaryContent: (task, statistics, discrepancies) => {
    return {
      taskId: task.task_id,
      taskName: task.name,
      generatedAt: new Date().toISOString(),
      statistics: {
        total: statistics.total,
        pending: statistics.pending,
        approved: statistics.approved,
        rejected: statistics.rejected,
        infoRequested: statistics.infoRequested,
        approvalRate: statistics.total > 0 ? ((statistics.approved / statistics.total) * 100).toFixed(2) + "%" : "0%",
        completionRate: statistics.total > 0 ? (((statistics.approved + statistics.rejected) / statistics.total) * 100).toFixed(2) + "%" : "0%"
      },
      byType: Object.keys(statistics.byType || {}).map(type => ({
        type,
        typeName: ReportGenerator.getDiscrepancyTypeName(type),
        ...statistics.byType[type]
      })),
      sourceTrace: {
        taskCreatedAt: task.created_at,
        taskCompletedAt: task.completed_at,
        dataSource: "对账系统实时计算"
      }
    };
  },

  buildDetailContent: (task, statistics, discrepancies, reviewLogsMap) => {
    return {
      taskId: task.task_id,
      taskName: task.name,
      generatedAt: new Date().toISOString(),
      statistics: {
        total: statistics.total,
        pending: statistics.pending,
        approved: statistics.approved,
        rejected: statistics.rejected,
        infoRequested: statistics.infoRequested
      },
      discrepancies: discrepancies.map(d => {
        const formatted = ReportGenerator.formatDiscrepancyForReport(d);
        const auditTrail = ReportGenerator.generateAuditTrail(reviewLogsMap[d.discrepancy_id] || []);
        return {
          ...formatted,
          auditTrail,
          auditTrailCount: auditTrail.length,
          handlingJustification: ReportGenerator.generateHandlingJustification(formatted, auditTrail)
        };
      }),
      sourceTrace: {
        taskCreatedAt: task.created_at,
        dataSource: "对账系统实时计算",
        dataSynchronization: "复核后自动同步更新"
      }
    };
  },

  generateHandlingJustification: (discrepancy, auditTrail) => {
    if (auditTrail.length === 0) {
      return "该差异尚未进行人工复核处理。";
    }

    const latestAction = auditTrail[0];
    const justification = \`
【差异类型】\${discrepancy.typeName}
【当前状态】\${discrepancy.statusName}
【最新操作】\${latestAction.operationName}
【操作人】\${latestAction.operator}
【操作时间】\${latestAction.timestamp}
【处理说明】\${latestAction.remark || "无"}
【操作历史】共 \${auditTrail.length} 次操作，完整追溯链见审计日志
    \`.trim();

    return justification;
  },

  buildReportContent: (reportType, task, statistics, discrepancies, reviewLogsMap) => {
    if (reportType === "SUMMARY") {
      return ReportGenerator.buildSummaryContent(task, statistics, discrepancies);
    } else {
      return ReportGenerator.buildDetailContent(task, statistics, discrepancies, reviewLogsMap);
    }
  }
};

module.exports = ReportGenerator;
`;

fs.writeFileSync('/Users/lzy/pro/solo/workspaces/zy70910/src/utils/reportGenerator.js', reportGeneratorContent);
console.log('reportGenerator.js created successfully');
