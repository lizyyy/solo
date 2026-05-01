const { AuditService, RISK_FLAGS } = require('./auditService');
const userService = require('./userService');
const credentialService = require('./credentialService');

class ExportService {
  exportJSON() {
    const logs = AuditService.getLogsForExport();
    const users = userService.getAllUsers();
    const credentials = credentialService.getAllCredentials();

    const userMap = new Map();
    users.forEach(u => userMap.set(u.id, u));

    const credentialMap = new Map();
    credentials.forEach(c => credentialMap.set(c.id, c));

    const enrichedLogs = logs.map(log => ({
      ...log,
      user: log.userId ? userMap.get(log.userId) : null,
      credential: log.credentialId ? credentialMap.get(log.credentialId) : null
    }));

    return {
      exportTime: new Date().toISOString(),
      summary: this._generateSummary(logs, users, credentials),
      users,
      credentials,
      auditLogs: enrichedLogs
    };
  }

  exportMarkdown() {
    const data = this.exportJSON();
    const lines = [];

    lines.push('# 无密码登录训练场 - 培训复盘报告');
    lines.push('');
    lines.push(`> 生成时间: ${data.exportTime}`);
    lines.push('');

    lines.push('## 一、训练概览');
    lines.push('');
    lines.push('| 指标 | 数值 |');
    lines.push('|------|------|');
    lines.push(`| 用户数 | ${data.summary.totalUsers} |`);
    lines.push(`| 凭据数 | ${data.summary.totalCredentials} |`);
    lines.push(`| 撤销凭据数 | ${data.summary.revokedCredentials} |`);
    lines.push(`| 总操作次数 | ${data.summary.totalOperations} |`);
    lines.push(`| 成功操作 | ${data.summary.successfulOperations} |`);
    lines.push(`| 失败操作 | ${data.summary.failedOperations} |`);
    lines.push('');

    lines.push('## 二、风险检测统计');
    lines.push('');

    if (data.summary.risks.length === 0) {
      lines.push('> 本次训练未检测到风险操作');
      lines.push('');
    } else {
      lines.push('| 风险类型 | 检测次数 | 说明 |');
      lines.push('|----------|----------|------|');
      data.summary.risks.forEach(risk => {
        lines.push(`| ${risk.name} | ${risk.count} | ${risk.description} |`);
      });
      lines.push('');
    }

    lines.push('## 三、用户列表');
    lines.push('');

    if (data.users.length === 0) {
      lines.push('> 暂无用户');
      lines.push('');
    } else {
      lines.push('| 用户名 | 显示名 | 用户ID | 创建时间 |');
      lines.push('|--------|--------|--------|----------|');
      data.users.forEach(user => {
        lines.push(`| ${user.username} | ${user.displayName || '-'} | ${user.id.substring(0, 8)}... | ${user.createdAt} |`);
      });
      lines.push('');
    }

    lines.push('## 四、凭据列表');
    lines.push('');

    if (data.credentials.length === 0) {
      lines.push('> 暂无凭据');
      lines.push('');
    } else {
      lines.push('| 设备备注 | 状态 | 签名计数器 | 创建时间 |');
      lines.push('|----------|------|--------------|----------|');
      data.credentials.forEach(cred => {
        const status = cred.isRevoked ? '已撤销' : '正常';
        const remark = cred.deviceRemark || '未命名设备';
        lines.push(`| ${remark} | ${status} | ${cred.signCount} | ${cred.createdAt} |`);
      });
      lines.push('');
    }

    lines.push('## 五、详细审计日志');
    lines.push('');

    if (data.auditLogs.length === 0) {
      lines.push('> 暂无操作记录');
      lines.push('');
    } else {
      data.auditLogs.forEach((log, index) => {
        lines.push(`### 操作 ${index + 1}: ${this._getActionName(log.action)}`);
        lines.push('');
        lines.push(`- **时间**: ${log.createdAt}`);
        lines.push(`- **结果**: ${log.success ? '成功' : '失败'}`);
        if (log.errorCode) {
          lines.push(`- **错误码**: ${log.errorCode}`);
        }
        if (log.errorMessage) {
          lines.push(`- **错误信息**: ${log.errorMessage}`);
        }
        if (log.riskFlags && log.riskFlags.length > 0) {
          lines.push(`- **检测到的风险**: ${log.riskFlags.map(r => this._getRiskName(r)).join(', ')}`);
        }
        if (log.details && Object.keys(log.details).length > 0) {
          lines.push('- **详细信息**:');
          Object.entries(log.details).forEach(([key, value]) => {
            lines.push(`  - ${key}: ${JSON.stringify(value)}`);
          });
        }
        lines.push('');
      });
    }

    lines.push('---');
    lines.push('');
    lines.push('> 此报告由"无密码登录训练场"自动生成');

    return lines.join('\n');
  }

  _generateSummary(logs, users, credentials) {
    const successfulOps = logs.filter(l => l.success).length;
    const failedOps = logs.filter(l => !l.success).length;

    const riskCounts = new Map();
    logs.forEach(log => {
      if (log.riskFlags && log.riskFlags.length > 0) {
        log.riskFlags.forEach(flag => {
          riskCounts.set(flag, (riskCounts.get(flag) || 0) + 1);
        });
      }
    });

    const risks = [];
    riskCounts.forEach((count, flag) => {
      risks.push({
        flag,
        name: this._getRiskName(flag),
        count,
        description: this._getRiskDescription(flag)
      });
    });

    return {
      totalUsers: users.length,
      totalCredentials: credentials.length,
      revokedCredentials: credentials.filter(c => c.isRevoked).length,
      totalOperations: logs.length,
      successfulOperations: successfulOps,
      failedOperations: failedOps,
      risks
    };
  }

  _getActionName(action) {
    const names = {
      'registration_start': '开始注册',
      'registration_complete': '注册完成',
      'registration_failed': '注册失败',
      'authentication_start': '开始登录',
      'authentication_complete': '登录成功',
      'authentication_failed': '登录失败',
      'credential_revoked': '撤销凭据',
      'credential_unrevoked': '恢复凭据',
      'credential_deleted': '删除凭据',
      'user_created': '创建用户',
      'user_deleted': '删除用户',
      'export_report': '导出报告'
    };
    return names[action] || action;
  }

  _getRiskName(flag) {
    const names = {
      'challenge_replay': '重放攻击',
      'challenge_expired': '挑战值过期',
      'credential_revoked': '已撤销凭据',
      'credential_duplicate': '重复凭据',
      'sign_count_rollback': '计数器倒退',
      'rp_id_mismatch': 'RP ID 不匹配',
      'origin_mismatch': 'Origin 不匹配',
      'user_handle_mismatch': '用户句柄不匹配',
      'user_not_found': '用户不存在',
      'credential_not_found': '凭据不存在',
      'signature_invalid': '签名无效',
      'missing_fields': '缺少字段'
    };
    return names[flag] || flag;
  }

  _getRiskDescription(flag) {
    const descriptions = {
      'challenge_replay': '检测到同一挑战值被重复使用，可能是重放攻击',
      'challenge_expired': '使用了已过期的挑战值',
      'credential_revoked': '尝试使用已被撤销的凭据进行登录',
      'credential_duplicate': '检测到重复的凭据注册',
      'sign_count_rollback': '签名计数器值小于存储值，可能是克隆攻击',
      'rp_id_mismatch': '认证数据中的 RP ID 哈希不匹配',
      'origin_mismatch': '请求的 Origin 与配置不匹配',
      'user_handle_mismatch': '用户句柄与存储值不匹配',
      'user_not_found': '操作的用户不存在',
      'credential_not_found': '操作的凭据不存在',
      'signature_invalid': '数字签名验证失败',
      'missing_fields': '请求缺少必要字段'
    };
    return descriptions[flag] || '未知风险';
  }
}

module.exports = new ExportService();
