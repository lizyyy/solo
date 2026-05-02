const moment = require('moment');

class MarkdownExporter {
  static async exportAuditReport(auditLogs, options = {}) {
    const title = options.title || '审计日志报告';
    const generatedAt = moment().format('YYYY-MM-DD HH:mm:ss');
    
    let markdown = `# ${title}\n\n`;
    markdown += `> 生成时间: ${generatedAt}\n\n`;
    markdown += `---\n\n`;
    
    if (auditLogs.length === 0) {
      markdown += `## 报告摘要\n\n`;
      markdown += `**记录总数**: 0\n\n`;
      markdown += `> 暂无审计日志记录\n\n`;
      return {
        content: markdown,
        filename: `audit-report-${moment().format('YYYYMMDDHHmmss')}.md`
      };
    }
    
    const actionStats = {};
    const entityTypeStats = {};
    const userStats = {};
    
    for (const log of auditLogs) {
      actionStats[log.action] = (actionStats[log.action] || 0) + 1;
      entityTypeStats[log.entity_type] = (entityTypeStats[log.entity_type] || 0) + 1;
      userStats[log.user_id] = (userStats[log.user_id] || 0) + 1;
    }
    
    markdown += `## 报告摘要\n\n`;
    markdown += `| 指标 | 数值 |\n`;
    markdown += `|------|------|\n`;
    markdown += `| **记录总数** | ${auditLogs.length} |\n`;
    markdown += `| **操作类型数** | ${Object.keys(actionStats).length} |\n`;
    markdown += `| **实体类型数** | ${Object.keys(entityTypeStats).length} |\n`;
    markdown += `| **操作用户数** | ${Object.keys(userStats).length} |\n\n`;
    
    markdown += `### 操作类型统计\n\n`;
    markdown += `| 操作类型 | 次数 |\n`;
    markdown += `|----------|------|\n`;
    for (const [action, count] of Object.entries(actionStats).sort((a, b) => b[1] - a[1])) {
      const actionName = this.getActionDescription(action);
      markdown += `| ${actionName} | ${count} |\n`;
    }
    markdown += `\n`;
    
    markdown += `### 实体类型统计\n\n`;
    markdown += `| 实体类型 | 次数 |\n`;
    markdown += `|----------|------|\n`;
    for (const [entityType, count] of Object.entries(entityTypeStats).sort((a, b) => b[1] - a[1])) {
      markdown += `| ${this.getEntityTypeName(entityType)} | ${count} |\n`;
    }
    markdown += `\n`;
    
    markdown += `---\n\n`;
    markdown += `## 详细记录\n\n`;
    
    for (const log of auditLogs) {
      const createdAt = log.created_at ? moment(log.created_at).format('YYYY-MM-DD HH:mm:ss') : '未知';
      const actionName = this.getActionDescription(log.action);
      
      markdown += `### ${actionName}\n\n`;
      markdown += `- **时间**: ${createdAt}\n`;
      markdown += `- **操作类型**: ${actionName}\n`;
      markdown += `- **实体类型**: ${this.getEntityTypeName(log.entity_type)}\n`;
      if (log.entity_id) {
        markdown += `- **实体ID**: ${log.entity_id}\n`;
      }
      if (log.entity_name) {
        markdown += `- **实体名称**: ${log.entity_name}\n`;
      }
      if (log.description) {
        markdown += `- **描述**: ${log.description}\n`;
      }
      markdown += `- **用户ID**: ${log.user_id || '未知'}\n`;
      markdown += `- **用户角色**: ${this.getRoleName(log.user_role)}\n`;
      
      if (log.old_value) {
        markdown += `\n**修改前值**:\n\`\`\`json\n${JSON.stringify(log.old_value, null, 2)}\n\`\`\`\n\n`;
      }
      if (log.new_value) {
        markdown += `**修改后值**:\n\`\`\`json\n${JSON.stringify(log.new_value, null, 2)}\n\`\`\`\n\n`;
      }
      
      markdown += `---\n\n`;
    }
    
    return {
      content: markdown,
      filename: `audit-report-${moment().format('YYYYMMDDHHmmss')}.md`
    };
  }

  static getActionDescription(action) {
    const descriptions = {
      'chemical.create': '创建试剂',
      'chemical.update': '更新试剂',
      'chemical.delete': '删除试剂',
      'batch.create': '创建批次',
      'batch.update': '更新批次',
      'batch.import': '导入批次',
      'request.create': '创建申请',
      'request.submit': '提交申请',
      'request.approve': '批准申请',
      'request.reject': '驳回申请',
      'request.execute': '执行申请',
      'request.return': '归还试剂',
      'request.dispose': '报废试剂',
      'stock.alert': '库存预警',
      'expiry.alert': '过期预警',
      'report.export': '导出报告'
    };
    return descriptions[action] || action;
  }

  static getEntityTypeName(entityType) {
    const names = {
      'chemical': '试剂',
      'batch': '批次',
      'request': '领用申请',
      'audit_log': '审计日志',
      'system': '系统'
    };
    return names[entityType] || entityType;
  }

  static getRoleName(role) {
    const names = {
      'admin': '管理员',
      'safety_officer': '安全员',
      'user': '普通用户'
    };
    return names[role] || role;
  }
}

module.exports = MarkdownExporter;
