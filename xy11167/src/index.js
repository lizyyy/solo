#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

const DEFAULT_CONFIG = {
  normalTemperatureMax: 37.3,
  abnormalTemperatureMax: 37.5,
  requireHandFootMouthCheck: true,
  requireSkinCheck: true,
  siblingSameGarden: 'recheck',
  allowRerun: true
};

function loadConfig(configPath) {
  if (configPath && fs.existsSync(configPath)) {
    try {
      const userConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return { ...DEFAULT_CONFIG, ...userConfig };
    } catch (e) {
      console.warn(`⚠️  配置文件读取失败，使用默认配置: ${e.message}`);
      return DEFAULT_CONFIG;
    }
  }
  return DEFAULT_CONFIG;
}

function validateRow(row, rowNum, filename, config) {
  const issues = [];
  const warnings = [];
  
  const studentName = row['幼儿姓名'] || row['姓名'] || '';
  const className = row['班级'] || row['所在班级'] || '';
  const temperature = parseFloat(row['体温']) || 36.5;
  const handFootMouth = row['手足口检查'] || row['手足口'] || '';
  const skinCondition = row['皮肤状况'] || row['皮肤'] || '';
  const hasSibling = (row['兄妹同园'] || row['兄弟姐妹'] || '否') === '是';
  const needRecheck = (row['需复测'] || row['复测'] || '否') === '是';
  
  if (!studentName.trim()) {
    issues.push({
      type: 'error',
      field: '幼儿姓名',
      message: '幼儿姓名不能为空',
      rowNum,
      filename,
      value: studentName
    });
  }
  
  if (!className.trim()) {
    issues.push({
      type: 'error',
      field: '班级',
      message: '班级信息缺失',
      rowNum,
      filename,
      value: className
    });
  }
  
  if (temperature > config.abnormalTemperatureMax) {
    issues.push({
      type: 'critical',
      field: '体温',
      message: `体温异常(${temperature}℃，超过${config.abnormalTemperatureMax}℃上限`,
      rowNum,
      filename,
      value: temperature
    });
  } else if (temperature > config.normalTemperatureMax) {
    warnings.push({
      type: 'warning',
      field: '体温',
      message: `体温偏高(${temperature}℃)，建议复测`,
      rowNum,
      filename,
      value: temperature,
      category: '体温复测'
    });
  }
  
  if (config.requireHandFootMouthCheck && handFootMouth && 
      (handFootMouth.includes('异常') || handFootMouth.includes('有') || handFootMouth.includes('是'))) {
    issues.push({
      type: 'warning',
      field: '手足口检查',
      message: `手足口检查异常: ${handFootMouth}`,
      rowNum,
      filename,
      value: handFootMouth,
      category: '健康异常'
    });
  }
  
  if (config.requireSkinCheck && skinCondition && 
      (skinCondition.includes('异常') || skinCondition.includes('皮疹') || skinCondition.includes('红肿'))) {
    issues.push({
      type: 'warning',
      field: '皮肤状况',
      message: `皮肤状况异常: ${skinCondition}`,
      rowNum,
      filename,
      value: skinCondition,
      category: '健康异常'
    });
  }
  
  if (hasSibling) {
    warnings.push({
      type: 'info',
      field: '兄妹同园',
      message: '该幼儿有兄弟姐妹在本园，请关注',
      rowNum,
      filename,
      value: '是',
      category: '兄妹同园'
    });
  }
  
  if (needRecheck) {
    warnings.push({
      type: 'info',
      field: '需复测',
      message: '该幼儿需要进行复测确认',
      rowNum,
      filename,
      value: '是',
      category: '可复跑'
    });
  }
  
  return { issues, warnings };
}

function processFile(filepath, config, verbose) {
  const results = [];
  const allIssues = [];
  const allWarnings = [];
  
  try {
    const content = fs.readFileSync(filepath, 'utf8');
    const filename = path.basename(filepath);
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });
    
    records.forEach((record, index) => {
      const rowNum = index + 2;
      const { issues, warnings } = validateRow(record, rowNum, filename, config);
      
      const result = {
        ...record,
        _原始行号: rowNum,
        _源文件: filename,
        _处理状态: issues.some(i => i.type === 'critical') ? '不通过' : '通过',
        _异常数量: issues.length,
        _提醒数量: warnings.length
      };
      
      results.push(result);
      allIssues.push(...issues);
      allWarnings.push(...warnings);
      
      if (verbose && (issues.length > 0 || warnings.length > 0)) {
        console.log(`📝 行${rowNum} (${record['幼儿姓名'] || '未命名'}):`);
        issues.forEach(i => console.log(`   ❌ ${i.message}`));
        warnings.forEach(w => console.log(`   ⚠️  ${w.message}`));
      }
    });
    
    return { results, issues: allIssues, warnings: allWarnings, success: true, filename };
  } catch (error) {
    return { 
      results: [], 
      issues: [{ 
        type: 'fatal', 
        message: `文件读取失败: ${error.message}`,
        filename: path.basename(filepath)
      }], 
      warnings: [], 
      success: false,
      filename: path.basename(filepath)
    };
  }
}

function generateReport(results, issues, warnings, config) {
  const criticalIssues = issues.filter(i => i.type === 'critical');
  const errors = issues.filter(i => i.type === 'error');
  const healthWarnings = warnings.filter(w => w.category === '健康异常');
  const tempRechecks = warnings.filter(w => w.category === '体温复测');
  const siblings = warnings.filter(w => w.category === '兄妹同园');
  const reruns = warnings.filter(w => w.category === '可复跑');
  
  const report = [];
  report.push('=' .repeat(60));
  report.push('           托育园保健室晨检汇总报告');
  report.push('=' .repeat(60));
  report.push(`统计时间: ${new Date().toLocaleString('zh-CN')}`);
  report.push('');
  
  report.push('【基本统计');
  report.push(`  总记录数: ${results.length} 条`);
  report.push(`  通过: ${results.filter(r => r._处理状态 === '通过').length} 人`);
  report.push(`  不通过: ${results.filter(r => r._处理状态 === '不通过').length} 人`);
  report.push('');
  
  report.push('【异常详情】');
  report.push(`  严重异常总数: ${criticalIssues.length}`);
  criticalIssues.forEach((issue, idx) => {
    report.push(`    ${idx + 1}. [${issue.filename}:行${issue.rowNum}] ${issue.message}`);
  });
  
  report.push(`  数据错误总数: ${errors.length}`);
  errors.forEach((issue, idx) => {
    report.push(`    ${idx + 1}. [${issue.filename}:行${issue.rowNum}] ${issue.field}: ${issue.message}`);
  });
  report.push('');
  
  report.push('【特殊情况提醒】（不影响通过状态）');
  report.push(`  体温需复测: ${tempRechecks.length} 人`);
  tempRechecks.forEach((w, idx) => {
    report.push(`    ${idx + 1}. [${w.filename}:行${w.rowNum}] ${results.find(r => r._原始行号 === w.rowNum)['幼儿姓名']}: ${w.message}`);
  });
  
  report.push(`  兄妹同园: ${siblings.length} 人`);
  siblings.forEach((w, idx) => {
    report.push(`    ${idx + 1}. [${w.filename}:行${w.rowNum}] ${results.find(r => r._原始行号 === w.rowNum)['幼儿姓名']}: ${w.message}`);
  });
  
  report.push(`  可复跑确认: ${reruns.length} 人`);
  reruns.forEach((w, idx) => {
    report.push(`    ${idx + 1}. [${w.filename}:行${w.rowNum}] ${results.find(r => r._原始行号 === w.rowNum)['幼儿姓名']}: ${w.message}`);
  });
  report.push('');
  
  report.push('【规则配置】');
  report.push(`  正常体温上限: ${config.normalTemperatureMax}℃`);
  report.push(`  异常体温上限: ${config.abnormalTemperatureMax}℃`);
  report.push(`  手足口检查启用: ${config.requireHandFootMouthCheck ? '是' : '否'}`);
  report.push(`  皮肤检查启用: ${config.requireSkinCheck ? '是' : '否'}`);
  report.push(`  兄妹同园策略: ${config.siblingSameGarden}`);
  report.push(`  允许复跑: ${config.allowRerun ? '是' : '否'}`);
  report.push('=' .repeat(60));
  
  return report.join('\n');
}

async function main() {
  const argv = yargs(hideBin(process.argv))
    .option('input', {
      alias: 'i',
      type: 'string',
      describe: '输入CSV文件路径',
      demandOption: true
    })
    .option('output', {
      alias: 'o',
      type: 'string',
      describe: '输出CSV文件路径',
      demandOption: true
    })
    .option('config', {
      alias: 'c',
      type: 'string',
      describe: '规则配置文件路径(JSON)'
    })
    .option('verbose', {
      alias: 'v',
      type: 'boolean',
      describe: '显示详细处理过程',
      default: false
    })
    .help()
    .argv;
  
  const config = loadConfig(argv.config);
  
  if (!fs.existsSync(argv.input)) {
    console.error(`❌ 输入文件不存在: ${argv.input}`);
    process.exit(1);
  }
  
  console.log('🚀 开始处理托育晨检数据...');
  console.log(`📂 输入文件: ${argv.input}`);
  console.log(`📂 输出文件: ${argv.output}`);
  console.log('');
  
  const { results, issues, warnings, success, filename } = processFile(argv.input, config, argv.verbose);
  
  if (!success) {
    console.error(`❌ 文件处理失败`);
    console.error(issues[0].message);
    process.exit(1);
  }
  
  const outputDir = path.dirname(argv.output);
  if (outputDir && !fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const csvOutput = stringify(results, {
    header: true,
    quoted_string: true
  });
  fs.writeFileSync(argv.output, csvOutput, 'utf8');
  
  const report = generateReport(results, issues, warnings, config);
  const outputExt = path.extname(argv.output);
  const reportPath = argv.output.slice(0, -outputExt.length) + '-report.txt';
  fs.writeFileSync(reportPath, report, 'utf8');
  
  console.log(report);
  console.log('');
  console.log(`✅ 处理完成!`);
  console.log(`📊 结果文件: ${argv.output}`);
  console.log(`📋 报告文件: ${reportPath}`);
  
  const hasCritical = issues.some(i => i.type === 'critical');
  if (hasCritical) {
    console.log('⚠️  注意: 存在严重异常，请查看报告详情');
  }
}

main().catch(console.error);