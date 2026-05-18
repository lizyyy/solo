#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

const CONFIG = {
  REQUIRED_COLUMNS: ['任务编号', '任务名称', '客户姓名', '手机号码', '外呼时间'],
  BLACKLIST_NUMBERS: new Set(['13800000000', '13900000000', '17000000000']),
  EMPTY_NUMBER_PATTERNS: ['', '-', '0', '无', '未填写', '暂无']
};

function normalizePhoneNumber(phone) {
  if (!phone) return '';
  let normalized = String(phone).trim();
  normalized = normalized.replace(/[\s\-\+\(\)]/g, '');
  if (normalized.startsWith('86')) {
    normalized = normalized.substring(2);
  }
  if (normalized.startsWith('+86')) {
    normalized = normalized.substring(3);
  }
  if (normalized.length === 11 && /^1[3-9]\d{9}$/.test(normalized)) {
    return normalized;
  }
  return normalized;
}

function isEmptyNumber(phone) {
  const normalized = normalizePhoneNumber(phone);
  if (!normalized) return true;
  if (CONFIG.EMPTY_NUMBER_PATTERNS.includes(normalized)) return true;
  if (normalized.length < 7) return true;
  return false;
}

function isBlacklistNumber(phone) {
  const normalized = normalizePhoneNumber(phone);
  return CONFIG.BLACKLIST_NUMBERS.has(normalized);
}

function formatTimestamp() {
  const now = new Date();
  return now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

async function processFile(filePath, results, errors) {
  return new Promise((resolve, reject) => {
    const records = [];
    let headerChecked = false;
    let missingColumns = [];
    
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('headers', (headers) => {
        headerChecked = true;
        missingColumns = CONFIG.REQUIRED_COLUMNS.filter(col => !headers.includes(col));
      })
      .on('data', (data) => {
        records.push({ ...data, _sourceFile: path.basename(filePath) });
      })
      .on('end', () => {
        if (!headerChecked) {
          errors.push({
            type: '文件格式错误',
            file: path.basename(filePath),
            message: '文件为空或不是有效的CSV格式'
          });
          resolve([]);
          return;
        }
        if (missingColumns.length > 0) {
          errors.push({
            type: '缺少必要列',
            file: path.basename(filePath),
            message: `缺少列: ${missingColumns.join(', ')}`
          });
        }
        resolve(records);
      })
      .on('error', (err) => {
        errors.push({
          type: '文件读取错误',
          file: path.basename(filePath),
          message: err.message
        });
        resolve([]);
      });
  });
}

async function processDirectory(inputDir, outputDir) {
  const timestamp = formatTimestamp();
  const resultDir = path.join(outputDir, `result-${timestamp}`);
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.mkdirSync(resultDir);

  const stats = {
    外呼任务记录重复呼叫拦截: {
      总文件数: 0,
      处理成功文件数: 0,
      处理失败文件数: 0,
      总记录数: 0,
      空号记录数: 0,
      黑名单记录数: 0,
      重复号码记录数: 0,
      最终保留记录数: 0
    }
  };

  const allRecords = [];
  const errors = [];

  let files = [];
  try {
    files = fs.readdirSync(inputDir)
      .filter(f => f.toLowerCase().endsWith('.csv'))
      .map(f => path.join(inputDir, f));
  } catch (err) {
    errors.push({
      type: '目录读取错误',
      file: inputDir,
      message: err.message
    });
  }

  stats.外呼任务记录重复呼叫拦截.总文件数 = files.length;

  if (files.length === 0) {
    errors.push({
      type: '空目录警告',
      file: inputDir,
      message: '目录中没有找到CSV文件'
    });
  }

  for (const file of files) {
    try {
      const records = await processFile(file, allRecords, errors);
      allRecords.push(...records);
      stats.外呼任务记录重复呼叫拦截.处理成功文件数++;
    } catch (err) {
      stats.外呼任务记录重复呼叫拦截.处理失败文件数++;
      errors.push({
        type: '文件处理失败',
        file: path.basename(file),
        message: err.message
      });
    }
  }

  stats.外呼任务记录重复呼叫拦截.总记录数 = allRecords.length;

  const phoneFirstSeen = new Map();
  const finalRecords = [];
  const duplicateRecords = [];
  const emptyNumberRecords = [];
  const blacklistRecords = [];

  for (const record of allRecords) {
    const phone = record['手机号码'] || '';
    const normalizedPhone = normalizePhoneNumber(phone);
    const taskId = record['任务编号'] || '未知任务';
    const recordKey = `${normalizedPhone}@${taskId}`;

    if (isEmptyNumber(phone)) {
      emptyNumberRecords.push({
        ...record,
        '_拦截原因': '空号/无效号码',
        '_拦截详情': `原始号码: ${phone || '(空)'}`
      });
      stats.外呼任务记录重复呼叫拦截.空号记录数++;
      continue;
    }

    if (isBlacklistNumber(phone)) {
      blacklistRecords.push({
        ...record,
        '_拦截原因': '黑名单号码',
        '_拦截详情': `号码 ${normalizedPhone} 在黑名单中`
      });
      stats.外呼任务记录重复呼叫拦截.黑名单记录数++;
      continue;
    }

    const crossTaskKey = normalizedPhone;
    if (phoneFirstSeen.has(crossTaskKey)) {
      const firstSeen = phoneFirstSeen.get(crossTaskKey);
      duplicateRecords.push({
        ...record,
        '_拦截原因': '跨任务重复号码',
        '_拦截详情': `首次出现于任务 ${firstSeen.taskId} (文件: ${firstSeen.file}, 时间: ${firstSeen.time})`
      });
      stats.外呼任务记录重复呼叫拦截.重复号码记录数++;
      continue;
    }

    phoneFirstSeen.set(crossTaskKey, {
      taskId: taskId,
      file: record._sourceFile,
      time: record['外呼时间'] || '未知时间'
    });
    finalRecords.push(record);
    stats.外呼任务记录重复呼叫拦截.最终保留记录数++;
  }

  await writeResults(resultDir, finalRecords, duplicateRecords, emptyNumberRecords, blacklistRecords, errors, stats);

  return { resultDir, stats, errors };
}

async function writeResults(resultDir, finalRecords, duplicateRecords, emptyNumberRecords, blacklistRecords, errors, stats) {
  const extraColumns = ['_sourceFile', '_拦截原因', '_拦截详情'];
  
  const allColumns = [...new Set([
    ...CONFIG.REQUIRED_COLUMNS,
    ...Object.keys(finalRecords[0] || {}),
    ...extraColumns
  ])];

  const createCsvHeaders = (cols) => cols.map(col => ({ id: col, title: col }));

  const csvWriter = createCsvWriter({
    path: path.join(resultDir, '可外呼-号码清单.csv'),
    header: createCsvHeaders(CONFIG.REQUIRED_COLUMNS)
  });
  await csvWriter.writeRecords(finalRecords);

  const dupeWriter = createCsvWriter({
    path: path.join(resultDir, '已拦截-跨任务重复号码.csv'),
    header: createCsvHeaders([...CONFIG.REQUIRED_COLUMNS, '_sourceFile', '_拦截原因', '_拦截详情'])
  });
  await dupeWriter.writeRecords(duplicateRecords);

  const emptyWriter = createCsvWriter({
    path: path.join(resultDir, '已拦截-空号无效号码.csv'),
    header: createCsvHeaders([...CONFIG.REQUIRED_COLUMNS, '_sourceFile', '_拦截原因', '_拦截详情'])
  });
  await emptyWriter.writeRecords(emptyNumberRecords);

  const blacklistWriter = createCsvWriter({
    path: path.join(resultDir, '已拦截-黑名单号码.csv'),
    header: createCsvHeaders([...CONFIG.REQUIRED_COLUMNS, '_sourceFile', '_拦截原因', '_拦截详情'])
  });
  await blacklistWriter.writeRecords(blacklistRecords);

  const summary = generateSummary(stats, errors, resultDir);
  fs.writeFileSync(path.join(resultDir, '处理结果报告.txt'), summary, 'utf8');

  console.log(summary);
}

function generateSummary(stats, errors, resultDir) {
  const s = stats.外呼任务记录重复呼叫拦截;
  let summary = `
╔════════════════════════════════════════════════════════════════╗
║           外呼任务记录重复呼叫拦截 - 处理结果报告                ║
╚════════════════════════════════════════════════════════════════╝

【处理概要】
  总文件数: ${s.总文件数} 个
  处理成功: ${s.处理成功文件数} 个
  处理失败: ${s.处理失败文件数} 个

【记录统计】
  总记录数: ${s.总记录数} 条
  空号/无效号码: ${s.空号记录数} 条 (已拦截)
  黑名单号码: ${s.黑名单记录数} 条 (已拦截)
  跨任务重复号码: ${s.重复号码记录数} 条 (已拦截)
  ─────────────────────────────────
  最终保留可外呼: ${s.最终保留记录数} 条

【输出文件】
  结果目录: ${resultDir}
  ├─ 可外呼-号码清单.csv          (${s.最终保留记录数} 条)
  ├─ 已拦截-跨任务重复号码.csv    (${s.重复号码记录数} 条)
  ├─ 已拦截-空号无效号码.csv      (${s.空号记录数} 条)
  ├─ 已拦截-黑名单号码.csv        (${s.黑名单记录数} 条)
  └─ 处理结果报告.txt
`;

  if (errors.length > 0) {
    summary += `
【异常与警告】
`;
    errors.forEach((err, idx) => {
      summary += `  ${idx + 1}. [${err.type}] ${err.file}: ${err.message}\n`;
    });
  }

  const totalBlocked = s.空号记录数 + s.黑名单记录数 + s.重复号码记录数;
  const blockRate = s.总记录数 > 0 ? ((totalBlocked / s.总记录数) * 100).toFixed(1) : 0;
  
  summary += `
【拦截效率】
  总计拦截: ${totalBlocked} 条 (${blockRate}%)
  重复号码占拦截比例: ${totalBlocked > 0 ? ((s.重复号码记录数 / totalBlocked) * 100).toFixed(1) : 0}%
`;

  return summary;
}

function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
外呼任务记录重复呼叫拦截 CLI

用法:
  outbound-dedupe <输入目录> <输出目录>

示例:
  outbound-dedupe ./samples ./output

业务规则:
  1. 号码归一化: 自动去除 +86、空格、横杠等格式
  2. 空号拦截: 识别空号、无效号码、格式错误号码
  3. 黑名单拦截: 拦截预设黑名单号码
  4. 跨任务去重: 同一号码出现在多个任务时仅保留首次出现的记录

输入CSV必需列:
  任务编号, 任务名称, 客户姓名, 手机号码, 外呼时间

输出文件:
  - 可外呼-号码清单.csv          (通过所有检查的记录)
  - 已拦截-跨任务重复号码.csv    (跨任务重复的号码)
  - 已拦截-空号无效号码.csv      (空号或格式无效的号码)
  - 已拦截-黑名单号码.csv        (黑名单号码)
  - 处理结果报告.txt             (详细统计报告)
`);
    process.exit(0);
  }

  const inputDir = args[0];
  const outputDir = args[1] || './output';

  if (!fs.existsSync(inputDir)) {
    console.error(`错误: 输入目录不存在: ${inputDir}`);
    process.exit(1);
  }

  processDirectory(inputDir, outputDir)
    .then(({ errors }) => {
      if (errors.some(e => e.type !== '空目录警告')) {
        process.exit(1);
      }
      process.exit(0);
    })
    .catch(err => {
      console.error('处理失败:', err);
      process.exit(1);
    });
}

if (require.main === module) {
  main();
}

module.exports = {
  normalizePhoneNumber,
  isEmptyNumber,
  isBlacklistNumber,
  processDirectory,
  CONFIG
};
