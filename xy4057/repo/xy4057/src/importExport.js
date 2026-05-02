const fs = require('fs');
const csv = require('csv-parser');
const { Readable } = require('stream');
const models = require('./models');
const stateMachine = require('./stateMachine');
const db = require('./database');

const importExport = {};

importExport.importCsvPackages = async function(csvContent, performedBy) {
  const results = [];
  const errors = [];
  let rowIndex = 0;

  return new Promise((resolve, reject) => {
    const stream = Readable.from(csvContent);
    
    stream
      .pipe(csv())
      .on('data', (row) => {
        rowIndex++;
        try {
          const packageData = parseCsvRow(row, rowIndex);
          
          const existing = models.packages.getByNumber(packageData.package_number);
          if (existing) {
            errors.push({
              row: rowIndex,
              error: `包编号 ${packageData.package_number} 已存在`,
              code: 'DUPLICATE_PACKAGE_NUMBER'
            });
            return;
          }

          const created = models.packages.create(packageData);
          
          models.audit.log(
            'IMPORT_CREATE',
            'INSTRUMENT_PACKAGE',
            created.id,
            { source: 'CSV_IMPORT', row: rowIndex, data: packageData },
            performedBy
          );

          results.push({
            row: rowIndex,
            success: true,
            package_id: created.id,
            package_number: created.package_number
          });
        } catch (err) {
          errors.push({
            row: rowIndex,
            error: err.message,
            code: err.code || 'IMPORT_ERROR'
          });
        }
      })
      .on('end', () => {
        resolve({
          total: rowIndex,
          success: results.length,
          failed: errors.length,
          results,
          errors
        });
      })
      .on('error', (err) => {
        reject(err);
      });
  });
};

importExport.importCsvCycles = async function(csvContent, performedBy) {
  const results = [];
  const errors = [];
  let rowIndex = 0;

  return new Promise((resolve, reject) => {
    const stream = Readable.from(csvContent);
    
    stream
      .pipe(csv())
      .on('data', (row) => {
        rowIndex++;
        try {
          const cycleData = parseCycleCsvRow(row, rowIndex);
          
          const existing = models.cycles.getByNumber(cycleData.cycle_number);
          if (existing) {
            errors.push({
              row: rowIndex,
              error: `锅次编号 ${cycleData.cycle_number} 已存在`,
              code: 'DUPLICATE_CYCLE_NUMBER'
            });
            return;
          }

          const created = models.cycles.create(cycleData);
          
          models.audit.log(
            'IMPORT_CREATE',
            'STERILIZATION_CYCLE',
            created.id,
            { source: 'CSV_IMPORT', row: rowIndex, data: cycleData },
            performedBy
          );

          results.push({
            row: rowIndex,
            success: true,
            cycle_id: created.id,
            cycle_number: created.cycle_number
          });
        } catch (err) {
          errors.push({
            row: rowIndex,
            error: err.message,
            code: err.code || 'IMPORT_ERROR'
          });
        }
      })
      .on('end', () => {
        resolve({
          total: rowIndex,
          success: results.length,
          failed: errors.length,
          results,
          errors
        });
      })
      .on('error', (err) => {
        reject(err);
      });
  });
};

function parseCsvRow(row, rowIndex) {
  const requiredFields = ['package_number', 'name'];
  const missing = requiredFields.filter(f => !row[f]);
  
  if (missing.length > 0) {
    const err = new Error(`缺少必需字段: ${missing.join(', ')}`);
    err.code = 'MISSING_REQUIRED_FIELDS';
    throw err;
  }

  const packageData = {
    package_number: row.package_number.trim(),
    name: row.name.trim(),
    description: row.description ? row.description.trim() : null,
    instruments: row.instruments ? row.instruments.split(',').map(s => s.trim()).filter(Boolean) : null,
    expiration_date: row.expiration_date ? parseDateField(row.expiration_date) : null
  };

  return packageData;
}

function parseCycleCsvRow(row, rowIndex) {
  const requiredFields = ['cycle_number', 'sterilizer_id', 'cycle_type', 'target_temperature', 'target_duration'];
  const missing = requiredFields.filter(f => !row[f]);
  
  if (missing.length > 0) {
    const err = new Error(`缺少必需字段: ${missing.join(', ')}`);
    err.code = 'MISSING_REQUIRED_FIELDS';
    throw err;
  }

  const cycleTypeMap = {
    '高温': 'HIGH_TEMP',
    '低温': 'LOW_TEMP',
    '环氧乙烷': 'EO_GAS',
    'HIGH_TEMP': 'HIGH_TEMP',
    'LOW_TEMP': 'LOW_TEMP',
    'EO_GAS': 'EO_GAS'
  };

  const cycleType = cycleTypeMap[row.cycle_type.trim()];
  if (!cycleType) {
    const err = new Error(`无效的灭菌类型: ${row.cycle_type}`);
    err.code = 'INVALID_CYCLE_TYPE';
    throw err;
  }

  const targetTemp = parseFloat(row.target_temperature);
  if (isNaN(targetTemp)) {
    const err = new Error(`目标温度必须是数字: ${row.target_temperature}`);
    err.code = 'INVALID_TEMPERATURE';
    throw err;
  }

  const targetDuration = parseInt(row.target_duration);
  if (isNaN(targetDuration)) {
    const err = new Error(`目标时长必须是整数: ${row.target_duration}`);
    err.code = 'INVALID_DURATION';
    throw err;
  }

  return {
    cycle_number: row.cycle_number.trim(),
    sterilizer_id: row.sterilizer_id.trim(),
    cycle_type: cycleType,
    start_time: row.start_time ? parseDateField(row.start_time) : null,
    target_temperature: targetTemp,
    target_duration: targetDuration
  };
}

function parseDateField(dateStr) {
  const formats = [
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/,
    /^\d{4}-\d{2}-\d{2}/
  ];

  for (const format of formats) {
    if (format.test(dateStr.trim())) {
      const parsed = new Date(dateStr.trim());
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString();
      }
    }
  }

  const err = new Error(`无法解析日期格式: ${dateStr}`);
  err.code = 'INVALID_DATE_FORMAT';
  throw err;
}

importExport.exportMarkdownReport = function(packageId) {
  const pkg = models.packages.getById(packageId);
  if (!pkg) {
    return null;
  }

  const qualityChecks = models.qualityChecks.getByPackage(packageId);
  const usageRecords = models.usage.getByPackage(packageId);
  const auditLogs = models.audit.getAll({ entity_type: 'INSTRUMENT_PACKAGE', entity_id: packageId });

  const report = generateMarkdownReport(pkg, qualityChecks, usageRecords, auditLogs);
  return report;
};

function generateMarkdownReport(pkg, qualityChecks, usageRecords, auditLogs) {
  const now = new Date().toLocaleString('zh-CN');
  
  let md = `# 灭菌包追溯报告\n\n`;
  md += `**生成时间**: ${now}\n\n`;
  md += `---\n\n`;
  
  md += `## 1. 器械包基本信息\n\n`;
  md += `| 项目 | 内容 |\n`;
  md += `|------|------|\n`;
  md += `| 包编号 | ${pkg.package_number} |\n`;
  md += `| 名称 | ${pkg.name} |\n`;
  md += `| 当前状态 | ${stateMachine.getStatusLabel(pkg.current_status)} |\n`;
  if (pkg.description) {
    md += `| 描述 | ${pkg.description} |\n`;
  }
  if (pkg.instruments && pkg.instruments.length > 0) {
    md += `| 器械清单 | ${pkg.instruments.join(', ')} |\n`;
  }
  if (pkg.expiration_date) {
    md += `| 有效期 | ${new Date(pkg.expiration_date).toLocaleString('zh-CN')} |\n`;
  }
  md += `| 创建时间 | ${new Date(pkg.created_at).toLocaleString('zh-CN')} |\n`;
  md += `| 更新时间 | ${new Date(pkg.updated_at).toLocaleString('zh-CN')} |\n\n`;

  md += `## 2. 质检记录\n\n`;
  if (qualityChecks.length === 0) {
    md += `暂无质检记录\n\n`;
  } else {
    md += `| 时间 | 类型 | 结果 | 检查人 | 备注 |\n`;
    md += `|------|------|------|--------|------|\n`;
    for (const check of qualityChecks) {
      const checkTypeLabels = {
        'BIOLOGICAL': '生物监测',
        'CHEMICAL': '化学监测',
        'PHYSICAL': '物理监测',
        'BOWIE_DICK': 'Bowie-Dick测试'
      };
      const resultLabels = {
        'PASS': '合格',
        'FAIL': '不合格',
        'INCONCLUSIVE': '不确定'
      };
      md += `| ${new Date(check.checked_at).toLocaleString('zh-CN')} | ${checkTypeLabels[check.check_type] || check.check_type} | ${resultLabels[check.result] || check.result} | ${check.checked_by || '-'} | ${check.notes || '-'} |\n`;
    }
    md += `\n`;
  }

  md += `## 3. 领用记录\n\n`;
  if (usageRecords.length === 0) {
    md += `暂无领用记录\n\n`;
  } else {
    md += `| 时间 | 科室 | 领用人 | 备注 |\n`;
    md += `|------|------|--------|------|\n`;
    for (const usage of usageRecords) {
      md += `| ${new Date(usage.usage_time).toLocaleString('zh-CN')} | ${usage.department} | ${usage.user_name || '-'} | ${usage.notes || '-'} |\n`;
    }
    md += `\n`;
  }

  md += `## 4. 审计日志\n\n`;
  if (auditLogs.length === 0) {
    md += `暂无审计日志\n\n`;
  } else {
    md += `| 时间 | 操作 | 操作人 | 详情 |\n`;
    md += `|------|------|--------|------|\n`;
    for (const log of auditLogs) {
      let details = '-';
      if (log.details) {
        if (typeof log.details === 'string') {
          details = log.details;
        } else {
          details = JSON.stringify(log.details);
        }
      }
      md += `| ${new Date(log.performed_at).toLocaleString('zh-CN')} | ${log.action} | ${log.performed_by || '-'} | ${details.substring(0, 50)}... |\n`;
    }
    md += `\n`;
  }

  md += `---\n\n`;
  md += `*本报告由灭菌包放行追溯站系统自动生成*\n`;

  return md;
}

importExport.exportAuditPackage = function(filters = {}) {
  return models.audit.getExportPackage(filters);
};

importExport.exportBatchReport = function(packageIds) {
  const reports = [];
  
  for (const id of packageIds) {
    const report = this.exportMarkdownReport(id);
    if (report) {
      reports.push(report);
    }
  }
  
  return reports.join('\n\n---\n\n');
};

module.exports = importExport;
