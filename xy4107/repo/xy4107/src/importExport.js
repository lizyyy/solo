const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { Readable } = require('stream');
const storage = require('./storage');
const stateMachine = require('./stateMachine');

class ImportExport {
  async importUsersFromCSV(csvContent) {
    const results = [];
    const errors = [];
    const stream = Readable.from(csvContent);
    
    return new Promise((resolve, reject) => {
      stream
        .pipe(csv())
        .on('data', (row) => {
          results.push(row);
        })
        .on('end', async () => {
          const imported = [];
          const failed = [];

          for (const row of results) {
            try {
              const username = row.username || row.Username || row.user || row.User;
              const displayName = row.displayName || row.DisplayName || row.name || row.Name || username;
              const email = row.email || row.Email || null;

              if (!username) {
                failed.push({ row, reason: '缺少用户名字段' });
                continue;
              }

              let user = storage.getUserByUsername(username);
              if (user) {
                failed.push({ row, reason: '用户名已存在' });
                continue;
              }

              user = storage.createUser({
                username,
                displayName,
                email,
                state: 'initial',
                imported: true,
                importedAt: new Date().toISOString()
              });

              imported.push({
                id: user.id,
                username: user.username,
                displayName: user.displayName,
                email: user.email
              });

              storage.createAuditLog({
                action: 'USER_IMPORTED',
                userId: user.id,
                username: user.username,
                details: { source: 'CSV_IMPORT' },
                timestamp: new Date().toISOString()
              });
            } catch (e) {
              failed.push({ row, reason: e.message });
            }
          }

          resolve({
            success: true,
            total: results.length,
            imported: imported.length,
            failed: failed.length,
            importedUsers: imported,
            failedRows: failed
          });
        })
        .on('error', reject);
    });
  }

  exportUsersToCSV() {
    const users = storage.getUsers();
    const headers = ['id', 'username', 'displayName', 'email', 'state', 'hasCredentials', 'createdAt', 'lastLoginAt'];
    
    let csvContent = headers.join(',') + '\n';
    
    users.forEach(user => {
      const row = [
        user.id,
        user.username,
        user.displayName || '',
        user.email || '',
        user.state || '',
        user.hasCredentials ? 'true' : 'false',
        user.createdAt || '',
        user.lastLoginAt || ''
      ];
      csvContent += row.map(v => `"${v}"`).join(',') + '\n';
    });

    return csvContent;
  }

  exportMarkdownReport(options = {}) {
    const stats = stateMachine.getStatistics();
    const auditLogs = stateMachine.getAuditLogs(options);
    const users = storage.getUsers();
    const credentials = storage.getCredentials();

    const now = new Date().toISOString();
    
    let report = `# 无密码登录安全演练报告

> 生成时间: ${now}
> 报告版本: v1.0

---

## 1. 概览

### 用户统计
| 指标 | 数值 |
|------|------|
| 总用户数 | ${stats.users.total} |
| 已注册凭证用户 | ${stats.users.withCredentials} |
| 未注册凭证用户 | ${stats.users.withoutCredentials} |

### 凭证统计
| 指标 | 数值 |
|------|------|
| 总凭证数 | ${stats.credentials.total} |
| 活跃凭证 | ${stats.credentials.active} |
| 已撤销凭证 | ${stats.credentials.revoked} |

### 审计统计
| 指标 | 数值 |
|------|------|
| 总审计条目 | ${stats.audit.total} |

---

## 2. 操作统计

| 操作类型 | 次数 |
|----------|------|
`;

    const actionNames = {
      'REGISTRATION_STARTED': '注册开始',
      'REGISTRATION_CHALLENGE_ISSUED': '注册挑战签发',
      'REGISTRATION_COMPLETED': '注册完成',
      'AUTHENTICATION_CHALLENGE_ISSUED': '认证挑战签发',
      'AUTHENTICATION_COMPLETED': '认证完成',
      'BACKUP_CODE_USED': '备用码使用',
      'CREDENTIAL_REVOKED': '凭证撤销',
      'BACKUP_CODES_REGENERATED': '备用码重新生成',
      'USER_IMPORTED': '用户导入'
    };

    for (const [action, count] of Object.entries(stats.audit.actions)) {
      const displayName = actionNames[action] || action;
      report += `| ${displayName} | ${count} |\n`;
    }

    report += `
---

## 3. 详细审计日志

`;

    if (auditLogs.length === 0) {
      report += '暂无审计日志记录。\n';
    } else {
      report += `| 时间 | 用户 | 操作 | 结果 | 详情 |\n`;
      report += `|------|------|------|------|------|\n`;

      auditLogs.slice(0, 50).forEach(log => {
        const action = actionNames[log.action] || log.action;
        const result = log.success ? '成功' : '失败';
        const details = JSON.stringify(log.details || {}).substring(0, 50);
        report += `| ${log.timestamp} | ${log.username || '-'} | ${action} | ${result} | ${details} |\n`;
      });

      if (auditLogs.length > 50) {
        report += `\n> 显示最近 50 条记录，共 ${auditLogs.length} 条。完整记录请查看 JSON 审计包。\n`;
      }
    }

    report += `
---

## 4. 用户详情

`;

    users.forEach(user => {
      const userCredentials = credentials.filter(c => c.userId === user.id);
      const activeCredentials = userCredentials.filter(c => c.isActive);
      const revokedCredentials = userCredentials.filter(c => !c.isActive);

      report += `### ${user.displayName || user.username} (${user.username})

- **用户ID**: ${user.id}
- **邮箱**: ${user.email || '未设置'}
- **状态**: ${user.state || '初始'}
- **创建时间**: ${user.createdAt}
- **最后登录**: ${user.lastLoginAt || '从未登录'}
- **活跃凭证**: ${activeCredentials.length} 个
- **已撤销凭证**: ${revokedCredentials.length} 个

`;

      if (activeCredentials.length > 0) {
        report += `#### 活跃凭证

| 设备名称 | 类型 | 注册时间 | 最后使用 |
|----------|------|----------|----------|
`;
        activeCredentials.forEach(cred => {
          const deviceType = cred.deviceType === 'platform' ? '内置设备' : '跨平台';
          report += `| ${cred.deviceName || '未知'} | ${deviceType} | ${cred.registeredAt || '-'} | ${cred.lastUsedAt || '-'} |\n`;
        });
        report += '\n';
      }

      if (revokedCredentials.length > 0) {
        report += `#### 已撤销凭证

| 设备名称 | 撤销时间 | 撤销原因 |
|----------|----------|----------|
`;
        revokedCredentials.forEach(cred => {
          report += `| ${cred.deviceName || '未知'} | ${cred.revokedAt || '-'} | ${cred.revocationReason || '-'} |\n`;
        });
        report += '\n';
      }

      report += '---\n\n';
    });

    report += `
## 5. 安全建议

基于本次演练数据，提供以下安全建议：

1. **凭证管理**
   - 建议每个用户至少注册 2 个设备，以防单一设备丢失
   - 定期审计已撤销的凭证，确认撤销原因

2. **备用码**
   - 确保用户安全保存备用码
   - 建议在设备更换后重新生成备用码

3. **监控建议**
   - 关注异常的认证失败次数
   - 监控凭证撤销操作，确保是用户主动行为

---

*本报告由"无密码登录彩排台"自动生成*
`;

    return report;
  }

  exportAuditPackage(options = {}) {
    const auditLogs = stateMachine.getAuditLogs(options);
    const users = storage.getUsers();
    const credentials = storage.getCredentials();
    const stats = stateMachine.getStatistics();

    const packageData = {
      metadata: {
        exportedAt: new Date().toISOString(),
        version: '1.0',
        filters: options
      },
      statistics: stats,
      users: users.map(u => ({
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        email: u.email,
        state: u.state,
        hasCredentials: u.hasCredentials,
        createdAt: u.createdAt,
        lastLoginAt: u.lastLoginAt
      })),
      credentials: credentials.map(c => ({
        id: c.id,
        userId: c.userId,
        deviceName: c.deviceName,
        deviceType: c.deviceType,
        isActive: c.isActive,
        backedUp: c.backedUp,
        registeredAt: c.registeredAt,
        lastUsedAt: c.lastUsedAt,
        revokedAt: c.revokedAt,
        revocationReason: c.revocationReason
      })),
      auditLogs: auditLogs
    };

    return JSON.stringify(packageData, null, 2);
  }

  generateSampleCSV() {
    const sampleData = [
      { username: 'zhangsan', displayName: '张三', email: 'zhangsan@example.com' },
      { username: 'lisi', displayName: '李四', email: 'lisi@example.com' },
      { username: 'wangwu', displayName: '王五', email: 'wangwu@example.com' }
    ];

    const headers = ['username', 'displayName', 'email'];
    let csvContent = headers.join(',') + '\n';
    
    sampleData.forEach(row => {
      csvContent += `${row.username},${row.displayName},${row.email}\n`;
    });

    return csvContent;
  }
}

module.exports = new ImportExport();
