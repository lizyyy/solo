const fs = require('fs');
const { stringify } = require('csv-stringify/sync');
const { CheckInStatus } = require('./models');

class ReportExporter {
  constructor(checkInEngine) {
    this.engine = checkInEngine;
  }
  
  generateJSONReport() {
    const statuses = this.engine.getAllCheckInStatuses();
    const stats = this.engine.getStatistics();
    
    return {
      summary: {
        totalAthletes: stats.total,
        approved: stats.byStatus.approved,
        pending: stats.byStatus.pending,
        pendingEquipment: stats.byStatus.pendingEquipment,
        waived: stats.byStatus.waived,
        rejected: stats.byStatus.rejected,
        bibIssued: stats.bibIssued,
        supplyIssued: stats.supplyIssued,
        hasWaiving: stats.hasWaiving,
        withMissingEquipment: stats.withMissingEquipment,
        approvalRate: stats.approvalRate,
        anomaliesCount: stats.anomalies.length
      },
      anomalies: stats.anomalies.map(s => ({
        bib: s.bib,
        name: s.athlete?.name,
        status: s.status,
        issues: s.issues,
        warnings: s.warnings
      })),
      details: statuses.map(s => ({
        bib: s.bib,
        name: s.athlete?.name,
        category: s.athlete?.category,
        gender: s.athlete?.gender,
        status: s.status,
        statusText: this._getStatusText(s.status),
        hasBib: s.hasBib,
        hasSupply: s.hasSupply,
        missingEquipment: s.missingEquipment.map(e => ({
          id: e.id,
          name: e.name
        })),
        hasWaiving: s.hasWaiving,
        issues: s.issues,
        warnings: s.warnings
      }))
    };
  }
  
  _getStatusText(status) {
    const texts = {
      [CheckInStatus.VALUES.APPROVED]: '允许通过',
      [CheckInStatus.VALUES.PENDING]: '待检录',
      [CheckInStatus.VALUES.PENDING_EQUIPMENT]: '待补装备',
      [CheckInStatus.VALUES.WAIVED]: '人工豁免',
      [CheckInStatus.VALUES.REJECTED]: '拒绝通过'
    };
    return texts[status] || status;
  }
  
  exportToJSON(filePath) {
    const report = this.generateJSONReport();
    fs.writeFileSync(filePath, JSON.stringify(report, null, 2));
    return report;
  }
  
  exportToCSV(filePath) {
    const report = this.generateJSONReport();
    
    const summaryLines = [
      ['=== 检录报告汇总 ==='],
      ['总选手数', report.summary.totalAthletes],
      ['允许通过', report.summary.approved],
      ['待检录', report.summary.pending],
      ['待补装备', report.summary.pendingEquipment],
      ['人工豁免', report.summary.waived],
      ['拒绝通过', report.summary.rejected],
      ['号码布已发放', report.summary.bibIssued],
      ['补给包已发放', report.summary.supplyIssued],
      ['有人工豁免', report.summary.hasWaiving],
      ['有缺项装备', report.summary.withMissingEquipment],
      ['通过率(含豁免)', `${report.summary.approvalRate}%`],
      ['异常记录数', report.summary.anomaliesCount],
      ['']
    ];
    
    const anomalyHeaders = ['异常记录', '号码布', '姓名', '状态', '问题', '警告'];
    const anomalyLines = report.anomalies.map(a => [
      '',
      a.bib,
      a.name || '',
      this._getStatusText(a.status),
      (a.issues || []).join('; '),
      (a.warnings || []).join('; ')
    ]);
    
    const detailHeaders = ['明细', '号码布', '姓名', '组别', '性别', '状态', '号码布已发', '补给包已发', '缺项装备', '问题', '警告'];
    const detailLines = report.details.map(d => [
      '',
      d.bib,
      d.name || '',
      d.category || '',
      d.gender || '',
      d.statusText,
      d.hasBib ? '是' : '否',
      d.hasSupply ? '是' : '否',
      d.missingEquipment.map(e => e.name).join(', '),
      (d.issues || []).join('; '),
      (d.warnings || []).join('; ')
    ]);
    
    const allLines = [
      ...summaryLines,
      [''],
      ['=== 异常记录 ==='],
      anomalyHeaders,
      ...anomalyLines,
      [''],
      ['=== 详细记录 ==='],
      detailHeaders,
      ...detailLines
    ];
    
    const csv = stringify(allLines);
    fs.writeFileSync(filePath, csv);
    return report;
  }
  
  exportToText(filePath) {
    const report = this.generateJSONReport();
    
    let text = '='.repeat(60) + '\n';
    text += '         赛 事 装 备 检 录 报 告\n';
    text += '='.repeat(60) + '\n\n';
    
    text += '【一、汇总统计】\n';
    text += '-'.repeat(40) + '\n';
    text += `总选手数: ${report.summary.totalAthletes}\n`;
    text += `允许通过: ${report.summary.approved}\n`;
    text += `待检录: ${report.summary.pending}\n`;
    text += `待补装备: ${report.summary.pendingEquipment}\n`;
    text += `人工豁免: ${report.summary.waived}\n`;
    text += `拒绝通过: ${report.summary.rejected}\n`;
    text += `\n号码布已发放: ${report.summary.bibIssued}\n`;
    text += `补给包已发放: ${report.summary.supplyIssued}\n`;
    text += `有人工豁免: ${report.summary.hasWaiving}\n`;
    text += `有缺项装备: ${report.summary.withMissingEquipment}\n`;
    text += `通过率(含豁免): ${report.summary.approvalRate}%\n`;
    text += `异常记录数: ${report.summary.anomaliesCount}\n\n`;
    
    if (report.anomalies.length > 0) {
      text += '【二、异常记录】\n';
      text += '-'.repeat(40) + '\n';
      report.anomalies.forEach((a, i) => {
        text += `\n${i + 1}. 号码布: ${a.bib}, 姓名: ${a.name || '未知'}\n`;
        text += `   状态: ${this._getStatusText(a.status)}\n`;
        if (a.issues && a.issues.length > 0) {
          text += `   问题: ${a.issues.join('; ')}\n`;
        }
        if (a.warnings && a.warnings.length > 0) {
          text += `   警告: ${a.warnings.join('; ')}\n`;
        }
      });
      text += '\n';
    }
    
    text += '【三、详细记录】\n';
    text += '-'.repeat(40) + '\n';
    report.details.forEach((d, i) => {
      text += `\n${i + 1}. 号码布: ${d.bib}, 姓名: ${d.name || '未知'}\n`;
      text += `   组别: ${d.category || '-'} | 性别: ${d.gender || '-'}\n`;
      text += `   状态: ${d.statusText}\n`;
      text += `   号码布: ${d.hasBib ? '已发放' : '未发放'} | 补给包: ${d.hasSupply ? '已发放' : '未发放'}\n`;
      if (d.missingEquipment.length > 0) {
        text += `   缺项装备: ${d.missingEquipment.map(e => e.name).join(', ')}\n`;
      }
      if (d.issues && d.issues.length > 0) {
        text += `   问题: ${d.issues.join('; ')}\n`;
      }
      if (d.warnings && d.warnings.length > 0) {
        text += `   警告: ${d.warnings.join('; ')}\n`;
      }
    });
    
    text += '\n' + '='.repeat(60) + '\n';
    text += `报告生成时间: ${new Date().toLocaleString('zh-CN')}\n`;
    text += '='.repeat(60) + '\n';
    
    fs.writeFileSync(filePath, text);
    return report;
  }
}

module.exports = ReportExporter;
