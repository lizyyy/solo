#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const yargs = require('yargs');
const { hideBin } = require('yargs/helpers');

const OUTPUT_COLUMNS = [
  '流水号',
  '交易日期',
  '经销商名称',
  '酒水产品编码',
  '酒水产品名称',
  '规格',
  '交易类型',
  '数量',
  '单价',
  '金额',
  '返利比例',
  '返利金额',
  '搭赠品编码',
  '搭赠品名称',
  '搭赠品数量',
  '原交易流水号',
  '跨月标记',
  '处理状态',
  '备注'
];

const STABLE_SORT_KEYS = ['交易日期', '经销商名称', '流水号'];

function stableSort(data) {
  return [...data].sort((a, b) => {
    for (const key of STABLE_SORT_KEYS) {
      const valA = a[key] || '';
      const valB = b[key] || '';
      if (valA !== valB) {
        return valA.localeCompare(valB);
      }
    }
    return 0;
  });
}

function parseAmount(amountStr) {
  if (!amountStr) return 0;
  const cleaned = String(amountStr).replace(/[￥,，]/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function parseDate(dateStr) {
  if (!dateStr) return '';
  const cleaned = String(dateStr).trim();
  const match = cleaned.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (match) {
    return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
  }
  return cleaned;
}

function getMonth(dateStr) {
  const parsed = parseDate(dateStr);
  return parsed.substring(0, 7);
}

function processRebateRecord(record, rawRecords, processedRecordsMap, errorLog) {
  const currentTxId = record['流水号'] || record['订单号'] || record['id'] || '';
  
  const result = {
    '流水号': currentTxId,
    '交易日期': parseDate(record['交易日期'] || record['日期'] || record['date'] || ''),
    '经销商名称': record['经销商名称'] || record['经销商'] || record['客户'] || '',
    '酒水产品编码': record['酒水产品编码'] || record['产品编码'] || record['sku'] || '',
    '酒水产品名称': record['酒水产品名称'] || record['产品名称'] || record['商品名称'] || '',
    '规格': record['规格'] || record['包装'] || '',
    '交易类型': record['交易类型'] || record['类型'] || '正常销售',
    '数量': parseInt(record['数量']) || 0,
    '单价': parseAmount(record['单价'] || record['单位价格']),
    '金额': parseAmount(record['金额'] || record['总金额']),
    '返利比例': parseFloat(record['返利比例'] || record['返点比例']) || 0,
    '返利金额': parseAmount(record['返利金额'] || record['返点金额']),
    '搭赠品编码': record['搭赠品编码'] || record['赠品编码'] || '',
    '搭赠品名称': record['搭赠品名称'] || record['赠品名称'] || '',
    '搭赠品数量': parseInt(record['搭赠品数量'] || record['赠品数量']) || 0,
    '原交易流水号': record['原交易流水号'] || record['原订单号'] || '',
    '跨月标记': '',
    '处理状态': '待处理',
    '备注': ''
  };

  const amount = result['金额'] || result['数量'] * result['单价'];
  result['金额'] = amount;

  if (result['返利比例'] > 0 && result['返利金额'] === 0) {
    result['返利金额'] = Math.round(amount * result['返利比例'] * 100) / 100;
  }

  const transType = String(result['交易类型']).trim();
  if (['退货', '退款', '退回', '销售退回'].includes(transType)) {
    result['数量'] = -Math.abs(result['数量']);
    result['金额'] = -Math.abs(result['金额']);
    result['返利金额'] = -Math.abs(result['返利金额']);

    const originalTxId = result['原交易流水号'];
    if (originalTxId) {
      let originalTx = processedRecordsMap.get(originalTxId);
      if (!originalTx) {
        const rawOriginal = rawRecords.find(r => 
          (r['流水号'] || r['订单号'] || r['id'] || '') === originalTxId
        );
        if (rawOriginal) {
          originalTx = {
            '交易日期': parseDate(rawOriginal['交易日期'] || rawOriginal['日期'] || '')
          };
        }
      }
      
      if (originalTx) {
        const originalMonth = getMonth(originalTx['交易日期']);
        const returnMonth = getMonth(result['交易日期']);
        if (originalMonth !== returnMonth) {
          result['跨月标记'] = '是';
          result['备注'] = `跨月退货: 原交易月份 ${originalMonth}, 退货月份 ${returnMonth}`;
          errorLog.push({
            type: '跨月退货',
            流水号: result['流水号'],
            原因: result['备注']
          });
        } else {
          result['跨月标记'] = '否';
        }
      } else {
        result['备注'] = `未找到原交易记录: ${originalTxId}`;
      }
    }
  }

  if (result['搭赠品名称'] || result['搭赠品编码']) {
    result['备注'] = result['备注'] ? 
      `${result['备注']}; 含搭赠品: ${result['搭赠品名称']} x${result['搭赠品数量']}` :
      `含搭赠品: ${result['搭赠品名称']} x${result['搭赠品数量']}`;
    errorLog.push({
      type: '搭赠品',
      流水号: result['流水号'],
      原因: `搭赠品 ${result['搭赠品名称']} 数量 ${result['搭赠品数量']}`
    });
  }

  result['处理状态'] = '已处理';
  return result;
}

async function readCsvFile(filePath) {
  const results = [];
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath, { encoding: 'utf-8' })
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

async function writeCsvFile(filePath, data, columns) {
  const csvWriter = createCsvWriter({
    path: filePath,
    header: columns.map(col => ({ id: col, title: col }))
  });
  await csvWriter.writeRecords(data);
}

async function processSingleFile(inputPath, outputDir, globalErrorLog) {
  const fileName = path.basename(inputPath);
  console.log(`处理文件: ${fileName}`);

  try {
    const rawData = await readCsvFile(inputPath);
    const processedRecordsMap = new Map();
    
    const processedData = rawData.map(record => {
      try {
        const processed = processRebateRecord(record, rawData, processedRecordsMap, globalErrorLog);
        processedRecordsMap.set(processed['流水号'], processed);
        return processed;
      } catch (err) {
        globalErrorLog.push({
          type: '处理错误',
          文件: fileName,
          流水号: record['流水号'] || record['订单号'] || '未知',
          原因: err.message
        });
        return null;
      }
    }).filter(Boolean);

    const sortedData = stableSort(processedData);

    const outputFileName = `处理后_${fileName}`;
    const outputPath = path.join(outputDir, outputFileName);
    await writeCsvFile(outputPath, sortedData, OUTPUT_COLUMNS);

    console.log(`  ✓ 已处理: ${fileName} -> ${outputFileName}`);
    console.log(`    记录数: ${sortedData.length}`);

    return {
      fileName,
      recordCount: sortedData.length,
      status: 'success'
    };
  } catch (err) {
    globalErrorLog.push({
      type: '文件错误',
      文件: fileName,
      原因: err.message
    });
    console.log(`  ✗ 处理失败: ${fileName} - ${err.message}`);
    console.log(`    继续处理剩余文件...`);
    return {
      fileName,
      error: err.message,
      status: 'failed'
    };
  }
}

async function processFiles(inputPaths, outputDir) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const globalErrorLog = [];

  for (const inputPath of inputPaths) {
    if (fs.statSync(inputPath).isDirectory()) {
      const files = fs.readdirSync(inputPath)
        .filter(f => f.toLowerCase().endsWith('.csv'))
        .map(f => path.join(inputPath, f));
      for (const file of files) {
        await processSingleFile(file, outputDir, globalErrorLog);
      }
    } else if (inputPath.toLowerCase().endsWith('.csv')) {
      await processSingleFile(inputPath, outputDir, globalErrorLog);
    }
  }

  if (globalErrorLog.length > 0) {
    const errorLogPath = path.join(outputDir, '处理日志.csv');
    await writeCsvFile(errorLogPath, globalErrorLog, [
      'type', '文件', '流水号', '原因'
    ]);
    console.log(`\n处理日志已保存: ${errorLogPath}`);
    console.log(`异常记录数: ${globalErrorLog.length}`);
  }

  console.log('\n处理完成!');
}

async function main() {
  const argv = yargs(hideBin(process.argv))
    .usage('酒类经销商酒水返利台账 CLI\n\n用法: $0 <命令> [选项]')
    .command({
      command: 'process <input...>',
      describe: '处理返利台账 CSV 文件',
      builder: (y) => y
        .positional('input', {
          describe: '输入 CSV 文件或目录路径',
          type: 'string'
        })
        .option('output', {
          alias: 'o',
          describe: '输出目录路径',
          default: './output',
          type: 'string'
        }),
      handler: async (argv) => {
        await processFiles(argv.input, argv.output);
      }
    })
    .example('$0 process ./data/*.csv', '处理 data 目录下所有 CSV 文件')
    .example('$0 process ./data -o ./result', '处理 data 目录并输出到 result 目录')
    .demandCommand(1, '请指定要执行的命令')
    .help()
    .argv;
}

main().catch(err => {
  console.error('执行出错:', err);
  process.exit(1);
});