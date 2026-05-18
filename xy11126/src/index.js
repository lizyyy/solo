#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { Command } = require('commander');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

const program = new Command();

program
  .name('wedding-pack')
  .description('婚礼策划室婚礼物料打包 CLI 工具')
  .version('1.0.0')
  .requiredOption('--input <path>', '输入CSV文件路径')
  .requiredOption('--output <dir>', '输出目录路径')
  .option('--rerun', '重跑模式，标记为重跑输出')
  .parse(process.argv);

const options = program.opts();

const VALID_MATERIAL_TYPES = ['鲜花', '喜糖', '请柬', '装饰', '酒水', '蛋糕', '礼品', '道具'];
const VALID_COLORS = ['红色', '粉色', '白色', '金色', '香槟色', '紫色', '蓝色'];
const VALID_STATUS = ['待打包', '已打包', '已出库'];

const results = [];
const anomalies = [];
const tempAdditions = [];
const colorReplacements = [];

let lineNumber = 1;
const inputFileName = path.basename(options.input);

function validateAndProcessRow(row, lineNum) {
  const issues = [];
  const warnings = [];
  const processedRow = {
    ...row,
    sourceFile: inputFileName,
    sourceLine: lineNum,
    processTime: new Date().toISOString(),
    isRerun: options.rerun || false,
    status: '正常'
  };

  if (!row.物料编号 || row.物料编号.trim() === '') {
    issues.push({
      type: '缺失字段',
      field: '物料编号',
      description: '物料编号不能为空',
      severity: 'error'
    });
  }

  if (!row.物料名称 || row.物料名称.trim() === '') {
    issues.push({
      type: '缺失字段',
      field: '物料名称',
      description: '物料名称不能为空',
      severity: 'error'
    });
  }

  if (!row.物料类型 || !VALID_MATERIAL_TYPES.includes(row.物料类型)) {
    if (!row.物料类型 || row.物料类型.trim() === '') {
      issues.push({
        type: '缺失字段',
        field: '物料类型',
        description: '物料类型不能为空',
        severity: 'error'
      });
    } else {
      issues.push({
        type: '无效物料类型',
        field: '物料类型',
        value: row.物料类型,
        description: `物料类型"${row.物料类型}"不在有效列表中: ${VALID_MATERIAL_TYPES.join(', ')}`,
        severity: 'warning'
      });
    }
  }

  if (row.颜色 && !VALID_COLORS.includes(row.颜色)) {
    const originalColor = row.颜色;
    let newColor = null;
    
    if (['酒红', '大红', '朱红'].includes(originalColor)) {
      newColor = '红色';
    } else if (['嫩粉', '桃粉', '玫粉'].includes(originalColor)) {
      newColor = '粉色';
    } else if (['米白', '乳白', '纯白'].includes(originalColor)) {
      newColor = '白色';
    } else if (['土豪金', '亮金', '黄'].includes(originalColor)) {
      newColor = '金色';
    }

    if (newColor) {
      colorReplacements.push({
        sourceFile: inputFileName,
        sourceLine: lineNum,
        物料编号: row.物料编号,
        物料名称: row.物料名称,
        原始颜色: originalColor,
        替换颜色: newColor,
        替换原因: '颜色标准化',
        processTime: new Date().toISOString()
      });
      processedRow.颜色 = newColor;
      warnings.push({
        type: '颜色替换',
        field: '颜色',
        original: originalColor,
        replaced: newColor,
        description: `颜色"${originalColor}"已自动替换为"${newColor}"`,
        severity: 'info'
      });
    } else {
      issues.push({
        type: '无效颜色',
        field: '颜色',
        value: originalColor,
        description: `颜色"${originalColor}"不在有效列表中且无法自动映射`,
        severity: 'error'
      });
    }
  }

  const quantity = parseInt(row.数量);
  if (isNaN(quantity) || quantity <= 0) {
    issues.push({
      type: '无效数量',
      field: '数量',
      value: row.数量,
      description: '数量必须为正整数',
      severity: 'error'
    });
  } else {
    processedRow.数量 = quantity;
  }

  if (!row.婚礼编号 || row.婚礼编号.trim() === '') {
    tempAdditions.push({
      sourceFile: inputFileName,
      sourceLine: lineNum,
      物料编号: row.物料编号,
      物料名称: row.物料名称,
      物料类型: row.物料类型,
      数量: row.数量,
      添加原因: '无婚礼编号关联物料',
      processTime: new Date().toISOString()
    });
    warnings.push({
      type: '临时加项',
      field: '婚礼编号',
      description: '该物料未关联婚礼编号，标记为临时加项',
      severity: 'warning'
    });
    processedRow.isTempAddition = true;
  }

  if (row.状态 && !VALID_STATUS.includes(row.状态)) {
    issues.push({
      type: '无效状态',
      field: '状态',
      value: row.状态,
      description: `状态"${row.状态}"不在有效列表中: ${VALID_STATUS.join(', ')}`,
      severity: 'warning'
    });
  }

  processedRow.issues = JSON.stringify(issues);
  processedRow.warnings = JSON.stringify(warnings);

  if (issues.some(i => i.severity === 'error')) {
    processedRow.status = '异常';
    anomalies.push({
      ...processedRow,
      anomalyDetails: JSON.stringify(issues)
    });
  } else {
    results.push(processedRow);
  }

  return processedRow;
}

function ensureOutputDir() {
  if (!fs.existsSync(options.output)) {
    fs.mkdirSync(options.output, { recursive: true });
  }
}

async function writeResults() {
  ensureOutputDir();

  const csvWriter = createCsvWriter({
    path: path.join(options.output, 'normal-results.csv'),
    header: [
      { id: '物料编号', title: '物料编号' },
      { id: '物料名称', title: '物料名称' },
      { id: '物料类型', title: '物料类型' },
      { id: '颜色', title: '颜色' },
      { id: '数量', title: '数量' },
      { id: '婚礼编号', title: '婚礼编号' },
      { id: '状态', title: '状态' },
      { id: '备注', title: '备注' },
      { id: 'sourceFile', title: '源文件' },
      { id: 'sourceLine', title: '源行号' },
      { id: 'isTempAddition', title: '是否临时加项' },
      { id: 'isRerun', title: '是否重跑输出' },
      { id: 'processTime', title: '处理时间' },
      { id: 'warnings', title: '警告信息' }
    ]
  });
  await csvWriter.writeRecords(results);

  const anomalyCsvWriter = createCsvWriter({
    path: path.join(options.output, 'anomaly-results.csv'),
    header: [
      { id: '物料编号', title: '物料编号' },
      { id: '物料名称', title: '物料名称' },
      { id: '物料类型', title: '物料类型' },
      { id: '颜色', title: '颜色' },
      { id: '数量', title: '数量' },
      { id: '婚礼编号', title: '婚礼编号' },
      { id: '状态', title: '状态' },
      { id: '备注', title: '备注' },
      { id: 'sourceFile', title: '源文件' },
      { id: 'sourceLine', title: '源行号' },
      { id: 'processTime', title: '处理时间' },
      { id: 'anomalyDetails', title: '异常详情' }
    ]
  });
  await anomalyCsvWriter.writeRecords(anomalies);

  const colorWriter = createCsvWriter({
    path: path.join(options.output, 'color-replacements.csv'),
    header: [
      { id: 'sourceFile', title: '源文件' },
      { id: 'sourceLine', title: '源行号' },
      { id: '物料编号', title: '物料编号' },
      { id: '物料名称', title: '物料名称' },
      { id: '原始颜色', title: '原始颜色' },
      { id: '替换颜色', title: '替换颜色' },
      { id: '替换原因', title: '替换原因' },
      { id: 'processTime', title: '处理时间' }
    ]
  });
  await colorWriter.writeRecords(colorReplacements);

  const tempWriter = createCsvWriter({
    path: path.join(options.output, 'temp-additions.csv'),
    header: [
      { id: 'sourceFile', title: '源文件' },
      { id: 'sourceLine', title: '源行号' },
      { id: '物料编号', title: '物料编号' },
      { id: '物料名称', title: '物料名称' },
      { id: '物料类型', title: '物料类型' },
      { id: '数量', title: '数量' },
      { id: '添加原因', title: '添加原因' },
      { id: 'processTime', title: '处理时间' }
    ]
  });
  await tempWriter.writeRecords(tempAdditions);

  const summary = {
    processTime: new Date().toISOString(),
    sourceFile: inputFileName,
    isRerun: options.rerun || false,
    statistics: {
      totalProcessed: results.length + anomalies.length,
      normalCount: results.length,
      anomalyCount: anomalies.length,
      tempAdditionCount: tempAdditions.length,
      colorReplacementCount: colorReplacements.length
    },
    normalResults: results,
    anomalies: anomalies,
    colorReplacements: colorReplacements,
    tempAdditions: tempAdditions
  };
  
  fs.writeFileSync(
    path.join(options.output, 'results.json'),
    JSON.stringify(summary, null, 2),
    'utf8'
  );

  const markdown = generateMarkdownReport(summary);
  fs.writeFileSync(
    path.join(options.output, 'report.md'),
    markdown,
    'utf8'
  );
}

function generateMarkdownReport(summary) {
  const stats = summary.statistics;
  
  let md = `# 婚礼策划室婚礼物料打包报告\n\n`;
  md += `## 基本信息\n\n`;
  md += `- **处理时间**: ${summary.processTime}\n`;
  md += `- **源文件**: ${summary.sourceFile}\n`;
  md += `- **重跑模式**: ${summary.isRerun ? '是' : '否'}\n\n`;
  
  md += `## 统计概览\n\n`;
  md += `| 指标 | 数量 |\n`;
  md += `|------|------|\n`;
  md += `| 处理总数 | ${stats.totalProcessed} |\n`;
  md += `| 正常记录 | ${stats.normalCount} |\n`;
  md += `| 异常记录 | ${stats.anomalyCount} |\n`;
  md += `| 临时加项 | ${stats.tempAdditionCount} |\n`;
  md += `| 颜色替换 | ${stats.colorReplacementCount} |\n\n`;

  if (summary.tempAdditions.length > 0) {
    md += `## 临时加项明细\n\n`;
    md += `| 源文件 | 行号 | 物料编号 | 物料名称 | 物料类型 | 数量 | 添加原因 | 处理时间 |\n`;
    md += `|--------|------|----------|----------|----------|------|----------|----------|\n`;
    summary.tempAdditions.forEach(item => {
      md += `| ${item.sourceFile} | ${item.sourceLine} | ${item.物料编号} | ${item.物料名称} | ${item.物料类型} | ${item.数量} | ${item.添加原因} | ${item.processTime} |\n`;
    });
    md += `\n`;
  }

  if (summary.colorReplacements.length > 0) {
    md += `## 颜色替换明细\n\n`;
    md += `| 源文件 | 行号 | 物料编号 | 物料名称 | 原始颜色 | 替换颜色 | 替换原因 | 处理时间 |\n`;
    md += `|--------|------|----------|----------|----------|----------|----------|----------|\n`;
    summary.colorReplacements.forEach(item => {
      md += `| ${item.sourceFile} | ${item.sourceLine} | ${item.物料编号} | ${item.物料名称} | ${item.原始颜色} | ${item.替换颜色} | ${item.替换原因} | ${item.processTime} |\n`;
    });
    md += `\n`;
  }

  if (summary.anomalies.length > 0) {
    md += `## 异常记录明细\n\n`;
    md += `| 源文件 | 行号 | 物料编号 | 物料名称 | 异常详情 |\n`;
    md += `|--------|------|----------|----------|----------|\n`;
    summary.anomalies.forEach(item => {
      const details = JSON.parse(item.anomalyDetails).map(d => d.description).join('; ');
      md += `| ${item.sourceFile} | ${item.sourceLine} | ${item.物料编号 || 'N/A'} | ${item.物料名称 || 'N/A'} | ${details} |\n`;
    });
    md += `\n`;
  }

  md += `## 人工复核说明\n\n`;
  md += `1. **临时加项**: 未关联婚礼编号的物料，需确认是否为真实临时添加或录入遗漏\n`;
  md += `2. **颜色替换**: 系统自动标准化的颜色，需确认替换是否符合业务需求\n`;
  md += `3. **异常记录**: 存在严重错误的记录，必须人工修正后重新处理\n`;
  md += `4. **重跑输出**: 带"是否重跑输出"标记的记录，需与历史版本进行比对\n\n`;

  return md;
}

console.log(`开始处理文件: ${options.input}`);

fs.createReadStream(options.input)
  .pipe(csv())
  .on('data', (row) => {
    lineNumber++;
    validateAndProcessRow(row, lineNumber);
  })
  .on('end', async () => {
    console.log(`CSV文件处理完成，共 ${lineNumber - 1} 行数据`);
    await writeResults();
    console.log(`处理结果已输出到目录: ${options.output}`);
    console.log(`  - 正常记录: ${results.length} 条`);
    console.log(`  - 异常记录: ${anomalies.length} 条`);
    console.log(`  - 临时加项: ${tempAdditions.length} 条`);
    console.log(`  - 颜色替换: ${colorReplacements.length} 条`);
  })
  .on('error', (error) => {
    console.error('处理出错:', error.message);
    process.exit(1);
  });
