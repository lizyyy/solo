#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const yargs = require('yargs');

const INPUT_DIR = path.join(__dirname, '../data');
const OUTPUT_DIR = path.join(__dirname, '../output');

function ensureOutputDir() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

function validateRecord(record) {
  const errors = [];

  if (!record['批次号'] || !record['批次号'].trim()) {
    errors.push('批次号为空');
  }

  if (!record['SKU'] || !record['SKU'].trim()) {
    errors.push('SKU为空');
  }

  const stockNum = parseInt(record['库存数量']);
  if (isNaN(stockNum)) {
    errors.push('库存数量非数字');
  } else if (stockNum < 0) {
    errors.push('库存数量为负数');
  } else if (stockNum === 0) {
    errors.push('库存数量为0');
  }

  const expiryDays = parseInt(record['剩余保质期(天)']);
  if (isNaN(expiryDays)) {
    errors.push('剩余保质期非数字');
  } else if (expiryDays < 0) {
    errors.push('剩余保质期为负数');
  } else if (expiryDays === 0) {
    errors.push('保质期已过');
  }

  const purchasePrice = parseFloat(record['进货价']);
  if (isNaN(purchasePrice) || !record['进货价'] || !record['进货价'].trim()) {
    errors.push('进货价缺失或无效');
  }

  const originalPrice = parseFloat(record['原售价']);
  if (isNaN(originalPrice)) {
    errors.push('原售价无效');
  }

  return errors;
}

function calculateAdjustedPrice(record) {
  const expiryDays = parseInt(record['剩余保质期(天)']);
  const originalPrice = parseFloat(record['原售价']);
  const purchasePrice = parseFloat(record['进货价']);

  let discountRate = 1;

  if (expiryDays <= 7) {
    discountRate = 0.3;
  } else if (expiryDays <= 14) {
    discountRate = 0.5;
  } else if (expiryDays <= 30) {
    discountRate = 0.7;
  } else {
    discountRate = 0.85;
  }

  let adjustedPrice = originalPrice * discountRate;
  adjustedPrice = Math.max(adjustedPrice, purchasePrice * 1.1);
  adjustedPrice = Math.round(adjustedPrice * 100) / 100;

  return {
    adjustedPrice,
    discountRate: Math.round((1 - discountRate) * 100),
    pricingBasis: expiryDays <= 7 ? '紧急清仓(≤7天)' : 
                expiryDays <= 14 ? '深度折扣(≤14天)' :
                expiryDays <= 30 ? '常规临期(≤30天)' : '轻度临期(>30天)'
  };
}

function processRecord(record) {
  const errors = validateRecord(record);
  const isNormal = errors.length === 0;

  let result = {
    ...record,
    处理状态: isNormal ? '正常' : '异常',
    错误信息: errors.join('; ')
  };

  if (isNormal) {
    const priceInfo = calculateAdjustedPrice(record);
    result = {
      ...result,
      调整后售价: priceInfo.adjustedPrice,
      折扣率: priceInfo.discountRate + '%',
      定价依据: priceInfo.pricingBasis,
      业务类型: getBusinessType(record)
    };
  }

  return { result, isNormal };
}

function getBusinessType(record) {
  const salesType = record['销售类型'];
  if (salesType === '拆箱销售') return '拆箱销售';
  if (salesType === '组合装主商品' || salesType === '组合装子商品') return '组合装';
  if (salesType === '可复跑') return '可复跑';
  return '常规销售';
}

async function processFile(inputPath, isPreview = false) {
  ensureOutputDir();

  const normalRecords = [];
  const abnormalRecords = [];
  const allRecords = [];

  return new Promise((resolve, reject) => {
    fs.createReadStream(inputPath)
      .pipe(csv())
      .on('data', (data) => {
        const { result, isNormal } = processRecord(data);
        allRecords.push(result);
        if (isNormal) {
          normalRecords.push(result);
        } else {
          abnormalRecords.push(result);
        }
      })
      .on('end', async () => {
        console.log(`总记录数: ${allRecords.length}`);
        console.log(`正常记录: ${normalRecords.length}`);
        console.log(`异常记录: ${abnormalRecords.length}`);

        if (!isPreview) {
          await writeResults(normalRecords, abnormalRecords);
          console.log('\n结果文件已生成:');
          console.log(`- ${path.join(OUTPUT_DIR, 'normal_records.csv')}`);
          console.log(`- ${path.join(OUTPUT_DIR, 'abnormal_records.csv')}`);
        }

        resolve({ normalRecords, abnormalRecords, allRecords });
      })
      .on('error', reject);
  });
}

async function writeResults(normalRecords, abnormalRecords) {
  const normalHeaders = [
    { id: '批次号', title: '批次号' },
    { id: 'SKU', title: 'SKU' },
    { id: '商品名称', title: '商品名称' },
    { id: '规格', title: '规格' },
    { id: '原产国', title: '原产国' },
    { id: '进货价', title: '进货价' },
    { id: '原售价', title: '原售价' },
    { id: '库存数量', title: '库存数量' },
    { id: '剩余保质期(天)', title: '剩余保质期(天)' },
    { id: '销售类型', title: '销售类型' },
    { id: '组合关系', title: '组合关系' },
    { id: '关联SKU', title: '关联SKU' },
    { id: '调整后售价', title: '调整后售价' },
    { id: '折扣率', title: '折扣率' },
    { id: '定价依据', title: '定价依据' },
    { id: '业务类型', title: '业务类型' },
    { id: '备注', title: '备注' }
  ];

  const abnormalHeaders = [
    ...normalHeaders.slice(0, 13),
    { id: '错误信息', title: '错误信息' },
    { id: '备注', title: '备注' }
  ];

  const normalWriter = createCsvWriter({
    path: path.join(OUTPUT_DIR, 'normal_records.csv'),
    header: normalHeaders
  });

  const abnormalWriter = createCsvWriter({
    path: path.join(OUTPUT_DIR, 'abnormal_records.csv'),
    header: abnormalHeaders
  });

  await normalWriter.writeRecords(normalRecords);
  await abnormalWriter.writeRecords(abnormalRecords);
}

function generateReport() {
  const normalPath = path.join(OUTPUT_DIR, 'normal_records.csv');
  const abnormalPath = path.join(OUTPUT_DIR, 'abnormal_records.csv');

  console.log('\n========== 调价报告 ==========\n');

  if (fs.existsSync(normalPath)) {
    const normalData = fs.readFileSync(normalPath, 'utf-8');
    const lines = normalData.split('\n');
    console.log(`【正常调价记录】共 ${lines.length - 2} 条\n`);
    console.log(lines.slice(0, Math.min(6, lines.length)).join('\n'));
    console.log('...\n');
  }

  if (fs.existsSync(abnormalPath)) {
    const abnormalData = fs.readFileSync(abnormalPath, 'utf-8');
    const lines = abnormalData.split('\n');
    console.log(`【异常待复核记录】共 ${lines.length - 2} 条\n`);
    console.log(lines.slice(0, Math.min(10, lines.length)).join('\n'));
    console.log('...\n');
  }

  console.log('========== 报告结束 ==========\n');
}

yargs
  .command('preview', '预览调价结果，不生成文件', (yargs) => {
    return yargs.option('input', {
      describe: '输入文件路径',
      default: path.join(INPUT_DIR, 'input.csv')
    });
  }, async (argv) => {
    console.log('========== 预览模式 ==========\n');
    await processFile(argv.input, true);
    console.log('\n预览完成，请检查数据后执行正式调价\n');
  })
  .command('execute', '执行正式调价，生成结果文件', (yargs) => {
    return yargs.option('input', {
      describe: '输入文件路径',
      default: path.join(INPUT_DIR, 'input.csv')
    });
  }, async (argv) => {
    console.log('========== 正式执行 ==========\n');
    await processFile(argv.input, false);
    console.log('\n正式调价完成，请查看报告\n');
  })
  .command('report', '查看调价结果报告', () => {}, () => {
    generateReport();
  })
  .demandCommand(1, '请指定命令: preview, execute, report')
  .help()
  .argv;
