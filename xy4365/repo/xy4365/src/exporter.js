const fs = require('fs');
const path = require('path');
const { Parser } = require('json2csv');
const moment = require('moment');

class Exporter {
  constructor(db) {
    this.db = db;
  }

  // 确保输出目录存在
  ensureOutputDir(outputPath) {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  // 导出Markdown值班提醒
  exportDutyReminder(outputPath) {
    this.ensureOutputDir(outputPath);
    
    const stats = this.getStatistics();
    const pendingViolations = this.db.all(`
      SELECT v.*, u.name as user_name
      FROM violations v
      LEFT JOIN users u ON v.user_id = u.user_id
      WHERE v.status = 'pending'
      ORDER BY v.severity DESC, v.timestamp DESC
    `);

    const confirmedViolations = this.db.all(`
      SELECT v.*, u.name as user_name
      FROM violations v
      LEFT JOIN users u ON v.user_id = u.user_id
      WHERE v.status = 'confirmed'
      ORDER BY v.severity DESC, v.timestamp DESC
    `);

    const upcomingMaintenance = this.db.all(`
      SELECT * FROM maintenance_slots 
      WHERE start_time > datetime('now')
      ORDER BY start_time ASC
      LIMIT 10
    `);

    const recentOperations = this.db.all(`
      SELECT r.*, u.name as user_name
      FROM operation_records r
      LEFT JOIN users u ON r.user_id = u.user_id
      ORDER BY r.start_time DESC
      LIMIT 20
    `);

    const markdown = this.generateMarkdownReminder(
      stats, 
      pendingViolations, 
      confirmedViolations, 
      upcomingMaintenance,
      recentOperations
    );

    fs.writeFileSync(outputPath, markdown, 'utf8');
    return { path: outputPath, success: true };
  }

  // 生成Markdown格式的值班提醒
  generateMarkdownReminder(stats, pending, confirmed, maintenance, operations) {
    const now = moment().format('YYYY-MM-DD HH:mm:ss');
    
    const severityEmoji = {
      'high': '🔴',
      'medium': '🟡',
      'low': '🟢'
    };

    const statusEmoji = {
      'pending': '⏳',
      'confirmed': '✅',
      'dismissed': '❌'
    };

    const violationTypeName = {
      'FORBIDDEN_MATERIAL': '使用禁切材料',
      'THICKNESS_POWER_MISMATCH': '厚度功率不匹配',
      'MAINTENANCE_CONFLICT': '维护时段冲突',
      'CONTINUOUS_TIMEOUT': '连续开机超时',
      'UNTRAINED_USER': '未培训人员操作'
    };

    let markdown = `# 激光切割机值班提醒

> 生成时间: ${now}

---

## 📊 今日统计

| 指标 | 数量 |
|------|------|
| 待复核违规 | ${stats.pending} |
| 已确认违规 | ${stats.confirmed} |
| 高危违规 | ${stats.high} |
| 中危违规 | ${stats.medium} |
| 低危违规 | ${stats.low} |
| **总计** | **${stats.total}** |

---

## ⏳ 待复核违规 (${pending.length}条)

${pending.length === 0 ? '> 暂无待复核违规记录' : ''}

${pending.map((v, i) => `
### ${i + 1}. ${severityEmoji[v.severity] || '⚪'} ${violationTypeName[v.violation_type] || v.violation_type}

| 项目 | 内容 |
|------|------|
| **严重程度** | ${v.severity === 'high' ? '高危' : v.severity === 'medium' ? '中危' : '低危'} |
| **用户** | ${v.user_id} ${v.user_name ? `(${v.user_name})` : ''} |
| **机器** | ${v.machine_id || '-'} |
| **时间** | ${v.timestamp ? moment(v.timestamp).format('YYYY-MM-DD HH:mm') : '-'} |
| **相关记录** | ${v.related_record_type || '-'} / ${v.related_record_id || '-'} |

**描述**: ${v.description}

`).join('')}

---

## ✅ 已确认违规 (${confirmed.length}条)

${confirmed.length === 0 ? '> 暂无已确认违规记录' : ''}

${confirmed.slice(0, 10).map((v, i) => `
### ${i + 1}. ${severityEmoji[v.severity] || '⚪'} ${violationTypeName[v.violation_type] || v.violation_type}

- **严重程度**: ${v.severity === 'high' ? '高危' : v.severity === 'medium' ? '中危' : '低危'}
- **用户**: ${v.user_id} ${v.user_name ? `(${v.user_name})` : ''}
- **机器**: ${v.machine_id || '-'}
- **时间**: ${v.timestamp ? moment(v.timestamp).format('YYYY-MM-DD HH:mm') : '-'}
- **描述**: ${v.description}
${v.review_notes ? `- **复核备注**: ${v.review_notes}` : ''}

`).join('')}

${confirmed.length > 10 ? `> ... 还有 ${confirmed.length - 10} 条已确认违规记录，请查看完整风险清单` : ''}

---

## 🔧 即将到来的维护 (${maintenance.length}条)

${maintenance.length === 0 ? '> 暂无安排的维护' : ''}

| # | 机器 | 开始时间 | 结束时间 | 类型 | 描述 |
|---|------|----------|----------|------|------|
${maintenance.map((m, i) => `| ${i + 1} | ${m.machine_id} | ${moment(m.start_time).format('MM-DD HH:mm')} | ${moment(m.end_time).format('MM-DD HH:mm')} | ${m.maintenance_type || '-'} | ${m.description || '-'} |`).join('\n')}

---

## 📋 最近开机记录 (${operations.length}条)

| # | 机器 | 用户 | 开始时间 | 结束时间 | 材料 | 功率 |
|---|------|------|----------|----------|------|------|
${operations.map((r, i) => `| ${i + 1} | ${r.machine_id} | ${r.user_id}${r.user_name ? `(${r.user_name})` : ''} | ${moment(r.start_time).format('MM-DD HH:mm')} | ${r.end_time ? moment(r.end_time).format('MM-DD HH:mm') : '-'} | ${r.material_used || '-'} | ${r.actual_power ? r.actual_power + '%' : '-'} |`).join('\n')}

---

## 📝 值班注意事项

1. **高优先级**: 请优先处理所有高危违规记录
2. **复核要求**: 所有待复核记录需在24小时内完成复核
3. **维护提醒**: 注意即将到来的维护时段，避免安排预约
4. **培训验证**: 操作前确认用户已完成激光切割机培训
5. **连续运行监控**: 监控机器连续运行时间，避免超过8小时

---

*此报告由激光切割机管理系统自动生成*
`;

    return markdown;
  }

  // 导出CSV风险清单
  exportRiskCsv(outputPath) {
    this.ensureOutputDir(outputPath);

    const violations = this.db.all(`
      SELECT 
        v.violation_id,
        v.violation_type,
        v.severity,
        v.status,
        v.description,
        v.related_record_type,
        v.related_record_id,
        v.user_id,
        u.name as user_name,
        v.machine_id,
        v.timestamp,
        v.review_notes,
        v.reviewed_by,
        v.reviewed_at
      FROM violations v
      LEFT JOIN users u ON v.user_id = u.user_id
      ORDER BY v.timestamp DESC
    `);

    const fields = [
      { label: '违规ID', value: 'violation_id' },
      { label: '违规类型', value: 'violation_type' },
      { label: '严重程度', value: 'severity' },
      { label: '状态', value: 'status' },
      { label: '描述', value: 'description' },
      { label: '相关类型', value: 'related_record_type' },
      { label: '相关ID', value: 'related_record_id' },
      { label: '用户ID', value: 'user_id' },
      { label: '用户姓名', value: 'user_name' },
      { label: '机器ID', value: 'machine_id' },
      { label: '时间', value: 'timestamp' },
      { label: '复核备注', value: 'review_notes' },
      { label: '复核人', value: 'reviewed_by' },
      { label: '复核时间', value: 'reviewed_at' }
    ];

    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(violations);

    fs.writeFileSync(outputPath, csv, 'utf8');
    return { path: outputPath, success: true, count: violations.length };
  }

  // 导出JSON审计包
  exportAuditPackage(outputPath) {
    this.ensureOutputDir(outputPath);

    const auditPackage = {
      export_time: new Date().toISOString(),
      export_version: '1.0',
      statistics: this.getStatistics(),
      users: this.db.all('SELECT * FROM users ORDER BY user_id'),
      appointments: this.db.all('SELECT * FROM appointments ORDER BY start_time'),
      materials: this.db.all('SELECT * FROM materials ORDER BY material_type'),
      maintenance_slots: this.db.all('SELECT * FROM maintenance_slots ORDER BY start_time'),
      operation_records: this.db.all('SELECT * FROM operation_records ORDER BY start_time'),
      violations: this.db.all(`
        SELECT v.*, 
               (SELECT json_group_array(json_object(
                 'review_id', r.review_id,
                 'original_status', r.original_status,
                 'new_status', r.new_status,
                 'original_severity', r.original_severity,
                 'new_severity', r.new_severity,
                 'review_notes', r.review_notes,
                 'reviewed_by', r.reviewed_by,
                 'reviewed_at', r.reviewed_at
               )) FROM reviews r WHERE r.violation_id = v.violation_id) as review_history
        FROM violations v
        ORDER BY v.timestamp DESC
      `),
      reviews: this.db.all('SELECT * FROM reviews ORDER BY reviewed_at DESC'),
      audit_logs: this.db.all('SELECT * FROM audit_logs ORDER BY performed_at DESC')
    };

    // 解析review_history JSON字符串
    for (const v of auditPackage.violations) {
      if (v.review_history && typeof v.review_history === 'string') {
        try {
          v.review_history = JSON.parse(v.review_history);
        } catch (e) {
          v.review_history = [];
        }
      }
    }

    fs.writeFileSync(outputPath, JSON.stringify(auditPackage, null, 2), 'utf8');
    return { 
      path: outputPath, 
      success: true,
      stats: {
        users: auditPackage.users.length,
        appointments: auditPackage.appointments.length,
        materials: auditPackage.materials.length,
        maintenance_slots: auditPackage.maintenance_slots.length,
        operation_records: auditPackage.operation_records.length,
        violations: auditPackage.violations.length,
        reviews: auditPackage.reviews.length
      }
    };
  }

  // 获取统计信息
  getStatistics() {
    return {
      total: this.db.get(`SELECT COUNT(*) as count FROM violations`).count,
      pending: this.db.get(`SELECT COUNT(*) as count FROM violations WHERE status = 'pending'`).count,
      confirmed: this.db.get(`SELECT COUNT(*) as count FROM violations WHERE status = 'confirmed'`).count,
      dismissed: this.db.get(`SELECT COUNT(*) as count FROM violations WHERE status = 'dismissed'`).count,
      high: this.db.get(`SELECT COUNT(*) as count FROM violations WHERE severity = 'high'`).count,
      medium: this.db.get(`SELECT COUNT(*) as count FROM violations WHERE severity = 'medium'`).count,
      low: this.db.get(`SELECT COUNT(*) as count FROM violations WHERE severity = 'low'`).count
    };
  }

  // 批量导出所有格式
  exportAll(outputDir) {
    const timestamp = moment().format('YYYYMMDD_HHmmss');
    
    const results = {};

    // 导出Markdown值班提醒
    try {
      const mdPath = path.join(outputDir, `值班提醒_${timestamp}.md`);
      results.markdown = this.exportDutyReminder(mdPath);
    } catch (error) {
      results.markdown = { success: false, error: error.message };
    }

    // 导出CSV风险清单
    try {
      const csvPath = path.join(outputDir, `风险清单_${timestamp}.csv`);
      results.csv = this.exportRiskCsv(csvPath);
    } catch (error) {
      results.csv = { success: false, error: error.message };
    }

    // 导出JSON审计包
    try {
      const jsonPath = path.join(outputDir, `审计包_${timestamp}.json`);
      results.json = this.exportAuditPackage(jsonPath);
    } catch (error) {
      results.json = { success: false, error: error.message };
    }

    return results;
  }
}

module.exports = Exporter;
