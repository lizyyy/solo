const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const chalk = require('chalk');

function loadConfig(configPath) {
  const defaultConfigPath = path.join(__dirname, '../config/rules.json');
  const targetPath = fs.existsSync(configPath) ? configPath : defaultConfigPath;
  
  if (!fs.existsSync(targetPath)) {
    throw new Error(`配置文件不存在: ${targetPath}`);
  }
  
  return JSON.parse(fs.readFileSync(targetPath, 'utf8'));
}

function logRecord(record, verbose, prefix = '') {
  if (!verbose) return;
  const lineInfo = `[行${record.lineNumber}]`;
  console.log(chalk.gray(`${prefix}${lineInfo} ${record.领用日期} - ${record.耗材名称} x ${record.数量}`));
}

function validateRecord(record, config, lineNumber) {
  const issues = [];
  const quantity = parseFloat(record.数量) || 0;
  const amount = parseFloat(record.金额) || 0;

  if (config.rules.negativeReturn.enabled && quantity < 0) {
    issues.push({
      type: 'NEGATIVE_RETURN',
      severity: config.rules.negativeReturn.severity,
      message: `数量为负数 (${quantity})，可能是退回操作`,
      field: '数量',
      value: quantity
    });
  }

  if (config.rules.missingApprover.enabled) {
    const approverFields = ['审批人', '审核人', '批准人'];
    const hasApprover = approverFields.some(field => record[field] && record[field].trim());
    if (!hasApprover) {
      issues.push({
        type: 'MISSING_APPROVER',
        severity: config.rules.missingApprover.severity,
        message: '审批人缺失',
        field: '审批人',
        value: ''
      });
    }
  }

  if (config.rules.zeroAmount.enabled && amount === 0 && quantity !== 0) {
    issues.push({
      type: 'ZERO_AMOUNT',
      severity: config.rules.zeroAmount.severity,
      message: `金额为0但数量不为0 (数量: ${quantity})`,
      field: '金额',
      value: amount
    });
  }

  if (config.rules.missingDepartment.enabled && !record.领用科室?.trim()) {
    issues.push({
      type: 'MISSING_DEPARTMENT',
      severity: config.rules.missingDepartment.severity,
      message: '领用科室缺失',
      field: '领用科室',
      value: ''
    });
  }

  if (config.rules.abnormalQuantity.enabled) {
    const threshold = config.rules.abnormalQuantity.threshold;
    if (Math.abs(quantity) > threshold) {
      issues.push({
        type: 'ABNORMAL_QUANTITY',
        severity: config.rules.abnormalQuantity.severity,
        message: `数量异常 (${quantity})，超过阈值 ${threshold}`,
        field: '数量',
        value: quantity
      });
    }
  }

  return issues;
}

async function processFile(filePath, config, verbose = false) {
  const results = [];
  const allIssues = [];
  const statistics = {
    totalRecords: 0,
    validRecords: 0,
    recordsWithIssues: 0,
    issueByType: {},
    processedAt: new Date().toISOString(),
    sourceFile: path.basename(filePath)
  };

  console.log(chalk.cyan(`\n正在处理: ${filePath}`));
  console.log(chalk.gray('─'.repeat(60)));

  let lineNumber = 1;

  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv({
        mapHeaders: ({ header }) => header.trim()
      }))
      .on('headers', (headers) => {
        if (verbose) {
          console.log(chalk.gray(`检测到列头: ${headers.join(', ')}`));
        }
      })
      .on('data', (data) => {
        lineNumber++;
        statistics.totalRecords++;
        
        const record = {
          lineNumber,
          sourceFile: path.basename(filePath),
          ...data
        };

        logRecord(record, verbose, '  ');
        
        const issues = validateRecord(record, config, lineNumber);
        
        if (issues.length > 0) {
          statistics.recordsWithIssues++;
          issues.forEach(issue => {
            statistics.issueByType[issue.type] = (statistics.issueByType[issue.type] || 0) + 1;
            allIssues.push({
              ...issue,
              lineNumber,
              record: {
                领用日期: record.领用日期,
                耗材名称: record.耗材名称,
                领用人: record.领用人,
                数量: record.数量
              }
            });
          });
          
          if (verbose) {
            issues.forEach(issue => {
              const color = issue.severity === 'high' ? chalk.red : chalk.yellow;
              console.log(color(`    ⚠ ${issue.message}`));
            });
          }
        } else {
          statistics.validRecords++;
        }
        
        results.push(record);
      })
      .on('end', () => {
        console.log(chalk.gray('─'.repeat(60)));
        console.log(chalk.cyan(`总记录数: ${statistics.totalRecords}`));
        console.log(chalk.green(`正常记录: ${statistics.validRecords}`));
        console.log(chalk.yellow(`异常记录: ${statistics.recordsWithIssues}`));
        
        resolve({
          records: results,
          issues: allIssues,
          statistics,
          config
        });
      })
      .on('error', reject);
  });
}

module.exports = {
  loadConfig,
  processFile,
  validateRecord
};
