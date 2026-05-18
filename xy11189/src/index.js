import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import { createObjectCsvWriter } from 'csv-writer';
import moment from 'moment';
import { program } from 'commander';

export async function main(defaultConfig) {
  program
    .option('-i, --input <dir>', '输入目录路径', defaultConfig.inputDir)
    .option('-o, --output <dir>', '输出目录路径', defaultConfig.outputDir)
    .option('-c, --config <path>', '规则配置文件路径', defaultConfig.configPath)
    .parse(process.argv);

  const options = program.opts();
  
  const rules = loadRules(options.config);
  ensureDirectory(options.output);
  
  const results = {
    normal: [],
    abnormal: [],
    logs: []
  };

  const files = getInputFiles(options.input);
  
  for (const file of files) {
    await processFile(file, rules, results, options.output);
  }

  await writeResults(results, options.output);
  writeLogs(results.logs, options.output);
  
  console.log(`处理完成: 正常 ${results.normal.length} 条, 异常 ${results.abnormal.length} 条`);
}

function loadRules(configPath) {
  const defaultRules = {
    requiredFields: ['teamName', 'licenseNumber', 'licenseType', 'issueDate', 'expiryDate', 'insuranceExpiry', 'workerType'],
    insuranceExpiryDays: 30,
    allowedWorkerTypes: ['正式工', '合同工'],
    allowedLicenseTypes: ['户外广告安装资质', '高空作业证', '电工证', '焊工证'],
    dateFormat: 'YYYY-MM-DD',
    skipOnErrors: ['INSURANCE_EXPIRED', 'TEMP_WORKER', 'RETRY_RECORD']
  };

  if (fs.existsSync(configPath)) {
    const userRules = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return { ...defaultRules, ...userRules };
  }
  
  return defaultRules;
}

function ensureDirectory(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getInputFiles(inputDir) {
  if (!fs.existsSync(inputDir)) {
    console.warn(`输入目录不存在: ${inputDir}`);
    return [];
  }
  
  return fs.readdirSync(inputDir)
    .filter(f => f.endsWith('.csv'))
    .map(f => path.join(inputDir, f));
}

async function processFile(filePath, rules, results, outputDir) {
  const fileName = path.basename(filePath);
  const records = [];

  return new Promise((resolve) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => records.push({ ...data, sourceFile: fileName }))
      .on('end', async () => {
        for (const record of records) {
          await validateRecord(record, rules, results, fileName);
        }
        resolve();
      });
  });
}

async function validateRecord(record, rules, results, sourceFile) {
  const errors = [];
  const warnings = [];

  for (const field of rules.requiredFields) {
    if (!record[field] || String(record[field]).trim() === '') {
      errors.push(`缺少必填字段: ${field}`);
    }
  }

  if (record.licenseType && !rules.allowedLicenseTypes.includes(record.licenseType)) {
    errors.push(`证照类型不合法: ${record.licenseType}`);
  }

  if (record.insuranceExpiry) {
    try {
      const expiryDate = moment(record.insuranceExpiry, rules.dateFormat);
      const today = moment();
      const daysUntilExpiry = expiryDate.diff(today, 'days');
      
      if (daysUntilExpiry < 0) {
        warnings.push({
          type: 'INSURANCE_EXPIRED',
          message: `保险已过期 ${Math.abs(daysUntilExpiry)} 天`,
          continue: rules.skipOnErrors.includes('INSURANCE_EXPIRED')
        });
      } else if (daysUntilExpiry <= rules.insuranceExpiryDays) {
        warnings.push({
          type: 'INSURANCE_SOON_EXPIRE',
          message: `保险将在 ${daysUntilExpiry} 天后过期`,
          continue: true
        });
      }
    } catch (e) {
      errors.push(`保险日期格式错误: ${record.insuranceExpiry}`);
    }
  }

  if (record.workerType && !rules.allowedWorkerTypes.includes(record.workerType)) {
    warnings.push({
      type: 'TEMP_WORKER',
      message: `用工类型异常: ${record.workerType}`,
      continue: rules.skipOnErrors.includes('TEMP_WORKER')
    });
  }

  if (record.retry && record.retry === 'true') {
    warnings.push({
      type: 'RETRY_RECORD',
      message: '可复跑记录标记',
      continue: rules.skipOnErrors.includes('RETRY_RECORD')
    });
  }

  const shouldContinue = warnings.every(w => w.continue);

  if (errors.length > 0) {
    results.abnormal.push({
      ...record,
      errorType: 'VALIDATION_ERROR',
      errorMessages: errors.join('; '),
      processTime: moment().format()
    });
    results.logs.push({
      time: moment().format(),
      file: sourceFile,
      record: record.teamName || '未知',
      level: 'ERROR',
      message: errors.join('; ')
    });
  } else if (!shouldContinue) {
    results.abnormal.push({
      ...record,
      errorType: 'WARNING_BLOCKED',
      errorMessages: warnings.map(w => w.message).join('; '),
      processTime: moment().format()
    });
    results.logs.push({
      time: moment().format(),
      file: sourceFile,
      record: record.teamName || '未知',
      level: 'WARN',
      message: warnings.map(w => w.message).join('; ')
    });
  } else {
    results.normal.push({
      ...record,
      warnings: warnings.map(w => w.message).join('; '),
      processTime: moment().format()
    });
    if (warnings.length > 0) {
      results.logs.push({
        time: moment().format(),
        file: sourceFile,
        record: record.teamName || '未知',
        level: 'INFO',
        message: warnings.map(w => w.message).join('; ') + ' (继续处理)'
      });
    }
  }
}

async function writeResults(results, outputDir) {
  if (results.normal.length > 0) {
    const normalWriter = createObjectCsvWriter({
      path: path.join(outputDir, 'normal_records.csv'),
      header: Object.keys(results.normal[0]).map(key => ({ id: key, title: key }))
    });
    await normalWriter.writeRecords(results.normal);
  }

  if (results.abnormal.length > 0) {
    const abnormalWriter = createObjectCsvWriter({
      path: path.join(outputDir, 'abnormal_records.csv'),
      header: Object.keys(results.abnormal[0]).map(key => ({ id: key, title: key }))
    });
    await abnormalWriter.writeRecords(results.abnormal);
  }
}

function writeLogs(logs, outputDir) {
  const logContent = logs.map(log => 
    `[${log.time}] [${log.level}] [${log.file}] [${log.record}] ${log.message}`
  ).join('\n');
  
  fs.writeFileSync(path.join(outputDir, 'process.log'), logContent, 'utf8');
}
