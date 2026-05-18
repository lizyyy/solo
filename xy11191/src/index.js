#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const chalk = require('chalk');
const { Command } = require('commander');
const program = new Command();

const DATA_DIR = path.join(__dirname, '../data');
const OUTPUT_DIR = path.join(__dirname, '../output');

function ensureDirs() {
  const dirs = [
    path.join(OUTPUT_DIR, 'normal'),
    path.join(OUTPUT_DIR, 'abnormal'),
    path.join(OUTPUT_DIR, 'split-medicine'),
    path.join(OUTPUT_DIR, 'family-brought'),
    path.join(OUTPUT_DIR, 're-runnable')
  ];
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

function getLatestDataFile() {
  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.csv'));
  if (files.length === 0) {
    console.log(chalk.red('错误：data 目录下没有找到 CSV 文件'));
    process.exit(1);
  }
  return path.join(DATA_DIR, files[0]);
}

function classifyRecord(record) {
  const today = new Date();
  const expiryDate = new Date(record.有效期);
  const daysToExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));

  if (record.药品类型 === '拆零药品') {
    return { category: 'split-medicine', status: 'special', reason: '拆零药品需单独复核' };
  }
  if (record.药品类型 === '家属自带药') {
    return { category: 'family-brought', status: 'special', reason: '家属自带药需单独登记' };
  }
  if (record.需复核 === '是') {
    return { category: 're-runnable', status: 'special', reason: '需人工复核后可复跑' };
  }

  if (daysToExpiry < 0) {
    return { category: 'abnormal', status: 'expired', reason: '药品已过期', daysToExpiry };
  }
  if (daysToExpiry <= 30) {
    return { category: 'abnormal', status: 'warning', reason: '30天内即将过期', daysToExpiry };
  }
  if (daysToExpiry <= 90) {
    return { category: 'abnormal', status: 'attention', reason: '90天内即将过期', daysToExpiry };
  }
  if (!record.批号 || !record.生产厂家) {
    return { category: 'abnormal', status: 'incomplete', reason: '药品信息不完整' };
  }
  if (record.库存数量 < 0) {
    return { category: 'abnormal', status: 'invalid', reason: '库存数量异常' };
  }

  return { category: 'normal', status: 'ok', reason: '正常有效期药品', daysToExpiry };
}

async function processData(isPreview = false) {
  ensureDirs();
  const inputFile = getLatestDataFile();
  console.log(chalk.blue(`处理文件: ${path.basename(inputFile)}`));

  const records = [];
  const classified = {
    normal: [],
    abnormal: [],
    'split-medicine': [],
    'family-brought': [],
    're-runnable': []
  };

  return new Promise((resolve, reject) => {
    fs.createReadStream(inputFile)
      .pipe(csv())
      .on('data', (data) => records.push(data))
      .on('end', async () => {
        console.log(chalk.yellow(`共读取 ${records.length} 条记录`));

        records.forEach(record => {
          const result = classifyRecord(record);
          record.分类原因 = result.reason;
          record.状态 = result.status;
          classified[result.category].push(record);
        });

        console.log('\n' + chalk.green('=== 分类统计 ==='));
        console.log(chalk.white(`正常药品: ${classified.normal.length} 条`));
        console.log(chalk.red(`异常药品: ${classified.abnormal.length} 条`));
        console.log(chalk.cyan(`拆零药品: ${classified['split-medicine'].length} 条`));
        console.log(chalk.magenta(`家属自带药: ${classified['family-brought'].length} 条`));
        console.log(chalk.yellow(`可复跑记录: ${classified['re-runnable'].length} 条`));

        if (!isPreview) {
          await writeResults(classified);
          console.log('\n' + chalk.green('处理完成！结果已保存到 output 目录'));
        } else {
          console.log('\n' + chalk.blue('预览模式，未写入文件'));
        }
        resolve();
      })
      .on('error', reject);
  });
}

async function writeResults(classified) {
  const headers = [
    { id: '药品名称', title: '药品名称' },
    { id: '规格', title: '规格' },
    { id: '批号', title: '批号' },
    { id: '生产厂家', title: '生产厂家' },
    { id: '有效期', title: '有效期' },
    { id: '库存数量', title: '库存数量' },
    { id: '药品类型', title: '药品类型' },
    { id: '存放位置', title: '存放位置' },
    { id: '状态', title: '状态' },
    { id: '分类原因', title: '分类原因' }
  ];

  const writers = {
    normal: createCsvWriter({ path: path.join(OUTPUT_DIR, 'normal/正常药品.csv'), header: headers }),
    abnormal: createCsvWriter({ path: path.join(OUTPUT_DIR, 'abnormal/异常药品.csv'), header: [...headers, { id: '距过期天数', title: '距过期天数' }] }),
    'split-medicine': createCsvWriter({ path: path.join(OUTPUT_DIR, 'split-medicine/拆零药品.csv'), header: headers }),
    'family-brought': createCsvWriter({ path: path.join(OUTPUT_DIR, 'family-brought/家属自带药.csv'), header: headers }),
    're-runnable': createCsvWriter({ path: path.join(OUTPUT_DIR, 're-runnable/可复跑记录.csv'), header: headers })
  };

  await writers.normal.writeRecords(classified.normal);
  await writers.abnormal.writeRecords(classified.abnormal.map(r => ({ ...r, '距过期天数': r.daysToExpiry || '' })));
  await writers['split-medicine'].writeRecords(classified['split-medicine']);
  await writers['family-brought'].writeRecords(classified['family-brought']);
  await writers['re-runnable'].writeRecords(classified['re-runnable']);
}

function generateReport() {
  console.log(chalk.blue('\n=== 养老院药事组药品效期复核报告\n'));
  
  const categories = [
    { name: '正常药品', dir: 'normal', color: chalk.green },
    { name: '异常药品', dir: 'abnormal', color: chalk.red },
    { name: '拆零药品', dir: 'split-medicine', color: chalk.cyan },
    { name: '家属自带药', dir: 'family-brought', color: chalk.magenta },
    { name: '可复跑记录', dir: 're-runnable', color: chalk.yellow }
  ];

  categories.forEach(cat => {
    const dirPath = path.join(OUTPUT_DIR, cat.dir);
    if (fs.existsSync(dirPath)) {
      const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.csv'));
      files.forEach(file => {
        const filePath = path.join(dirPath, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n').filter(l => l.trim());
        console.log(cat.color(`${cat.name}: ${lines.length - 1} 条记录`));
        console.log(`  文件: ${file}`);
        console.log(`  路径: ${filePath}`);
      });
    }
  });

  console.log(chalk.yellow('\n复核指引:'));
  console.log('1. 先查看异常药品.csv - 重点关注过期和临期药品');
  console.log('2. 复核拆零药品和家属自带药 - 单独管理');
  console.log('3. 处理可复跑记录 - 人工确认后重新跑批');
  console.log('4. 正常药品作为存档备查');
}

program
  .name('medicine-expiry')
  .description('养老院药事组养老药品效期管理 CLI');

program
  .command('preview')
  .description('预览数据分类结果，不写入文件')
  .action(() => processData(true));

program
  .command('run')
  .description('正式执行药品效期分类，写入输出文件')
  .action(() => processData(false));

program
  .command('report')
  .description('查看分类报告和复核指引')
  .action(generateReport);

program.parse();
