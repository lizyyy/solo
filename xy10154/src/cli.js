const { Command } = require('commander');
const path = require('path');
const fs = require('fs');
const LogisticsDatabase = require('./database');
const LogisticsAnalyzer = require('./analyzer');
const Exporter = require('./exporter');
const { formatDate, formatDuration } = require('./utils');
const { STATUS_NAMES, ANOMALY_NAMES } = require('./constants');

const program = new Command();
program
  .name('logistics')
  .description('物流轨迹异常归因 CLI - 检测签收后揽收、跨城市跳点、重复扫描等异常')
  .version('1.0.0');

let db, analyzer, exporter;
let initialized = false;

async function initServices() {
  if (initialized) return;
  
  db = new LogisticsDatabase();
  await db.init();
  analyzer = new LogisticsAnalyzer(db);
  exporter = new Exporter(db);
  initialized = true;
}

function closeServices() {
  if (db) {
    db.close();
    db = null;
    analyzer = null;
    exporter = null;
    initialized = false;
  }
}

function printSeparator() {
  console.log('─'.repeat(60));
}

function printResult(result) {
  const map = { valid: '✓ 正常', warning: '⚠ 警告', error: '✗ 异常' };
  console.log(map[result] || result);
}

program
  .command('validate <trackingNumber>')
  .description('校验单个包裹轨迹异常')
  .option('-f, --file <file>', '轨迹数据文件 (JSON格式)')
  .option('--force', '强制重新校验（忽略缓存）')
  .option('--json', '输出 JSON 格式')
  .action(async (trackingNumber, options) => {
    await initServices();
    
    try {
      let traces;
      
      if (options.file) {
        const filePath = path.resolve(process.cwd(), options.file);
        if (!fs.existsSync(filePath)) {
          console.error(`文件不存在: ${filePath}`);
          process.exit(1);
        }
        const content = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(content);
        traces = Array.isArray(data) ? data : data.traces;
      } else {
        const pkg = db.getPackage(trackingNumber);
        if (!pkg) {
          console.error(`包裹不存在: ${trackingNumber}`);
          console.log('提示: 使用 -f 选项指定轨迹数据文件，或先使用 import 命令导入');
          process.exit(1);
        }
        traces = db.getPackageTraces(pkg.id);
      }
      
      if (!traces || traces.length === 0) {
        console.error('未找到轨迹数据');
        process.exit(1);
      }
      
      const result = analyzer.importAndValidatePackage(trackingNumber, traces, {}, {
        force: options.force
      });
      
      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        printSeparator();
        console.log(`运单号: ${trackingNumber}`);
        printSeparator();
        console.log(`校验结果: `);
        printResult(result.result);
        console.log(`轨迹数量: ${result.summary ? (result.summary.total + result.summary.high + result.summary.medium + result.summary.low > 0 ? 
          (result.traceCount || 0) : '未知') : '未知'}`);
        
        if (result.summary) {
          console.log(`\n异常统计:`);
          console.log(`  高危: ${result.summary.high}`);
          console.log(`  中危: ${result.summary.medium}`);
          console.log(`  低危: ${result.summary.low}`);
        }
        
        if (result.anomalies && result.anomalies.length > 0) {
          console.log(`\n异常详情:`);
          result.anomalies.forEach((a, i) => {
            console.log(`\n  ${i + 1}. [${a.actionPriority}] ${a.name}`);
            console.log(`     描述: ${a.message}`);
            console.log(`     严重程度: ${a.severity} | 置信度: ${a.confidence}`);
            
            if (a.causes && a.causes.length > 0) {
              console.log(`     可能原因: ${a.causes.join('; ')}`);
            }
            if (a.suggestions && a.suggestions.length > 0) {
              console.log(`     建议: ${a.suggestions[0]}`);
            }
          });
        } else {
          console.log(`\n✓ 未检测到异常`);
        }
        
        printSeparator();
      }
    } finally {
      closeServices();
    }
  });

program
  .command('batch')
  .description('批量校验多个包裹')
  .option('-f, --file <file>', '批量数据文件 (JSON格式)')
  .option('-n, --name <name>', '批次名称')
  .option('--force', '强制重新校验所有包裹')
  .option('--json', '输出 JSON 格式')
  .action(async (options) => {
    await initServices();
    
    try {
      if (!options.file) {
        console.error('请指定批量数据文件: -f <file>');
        process.exit(1);
      }
      
      const filePath = path.resolve(process.cwd(), options.file);
      if (!fs.existsSync(filePath)) {
        console.error(`文件不存在: ${filePath}`);
        process.exit(1);
      }
      
      const content = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(content);
      const packages = Array.isArray(data) ? data : data.packages;
      
      if (!packages || packages.length === 0) {
        console.error('未找到包裹数据');
        process.exit(1);
      }
      
      const result = analyzer.analyzeBatch(packages, {
        name: options.name,
        force: options.force
      });
      
      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        printSeparator();
        console.log(`批次名称: ${result.runName}`);
        console.log(`批次 ID: ${result.runId}`);
        printSeparator();
        console.log(`处理耗时: ${result.durationFormatted}`);
        console.log(`总包裹数: ${result.total}`);
        console.log(`  正常: ${result.valid}`);
        console.log(`  警告: ${result.warning}`);
        console.log(`  异常: ${result.error}`);
        console.log(`  跳过: ${result.skipped}`);
        
        if (result.totalAnomalies > 0) {
          console.log(`\n异常总数: ${result.totalAnomalies}`);
          console.log(`  高危: ${result.bySeverity.high}`);
          console.log(`  中危: ${result.bySeverity.medium}`);
          console.log(`  低危: ${result.bySeverity.low}`);
          
          console.log(`\n异常类型分布:`);
          Object.entries(result.byType).forEach(([type, count]) => {
            console.log(`  ${ANOMALY_NAMES[type] || type}: ${count}`);
          });
        }
        
        printSeparator();
      }
    } finally {
      closeServices();
    }
  });

program
  .command('history')
  .description('查看校验历史')
  .option('-l, --limit <limit>', '返回数量限制', '50')
  .option('--failed', '只显示失败的校验')
  .option('--json', '输出 JSON 格式')
  .action(async (options) => {
    await initServices();
    
    try {
      const limit = parseInt(options.limit) || 50;
      const history = options.failed 
        ? db.getFailedValidations(limit)
        : db.getValidationHistory(limit);
      
      if (options.json) {
        console.log(JSON.stringify(history, null, 2));
      } else {
        printSeparator();
        console.log(options.failed ? '失败校验记录:' : '校验历史记录:');
        printSeparator();
        
        if (history.length === 0) {
          console.log('暂无记录');
        } else {
          history.forEach((h, i) => {
            const resultStr = h.result === 'valid' ? '✓' : h.result === 'warning' ? '⚠' : '✗';
            console.log(`${String(i + 1).padStart(3)}. [${resultStr}] ${h.tracking_number}`);
            console.log(`       结果: ${h.result.toUpperCase()} | 轨迹: ${h.trace_count} | 异常: ${h.anomalies_total}`);
            console.log(`       时间: ${h.started_at}`);
            if (h.anomalies_total > 0) {
              console.log(`       异常: 高危${h.anomalies_high} 中危${h.anomalies_medium} 低危${h.anomalies_low}`);
            }
          });
        }
        
        printSeparator();
      }
    } finally {
      closeServices();
    }
  });

program
  .command('revalidate <trackingNumber>')
  .description('重新校验包裹')
  .option('--json', '输出 JSON 格式')
  .action(async (trackingNumber, options) => {
    await initServices();
    
    try {
      const result = analyzer.revalidatePackage(trackingNumber);
      
      if (result.error) {
        console.error(`错误: ${result.error}`);
        process.exit(1);
      }
      
      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        printSeparator();
        console.log(`运单号: ${trackingNumber}`);
        printSeparator();
        console.log(`校验结果: `);
        printResult(result.result);
        
        if (result.summary) {
          console.log(`\n异常统计:`);
          console.log(`  高危: ${result.summary.high}`);
          console.log(`  中危: ${result.summary.medium}`);
          console.log(`  低危: ${result.summary.low}`);
        }
        
        if (result.anomalies && result.anomalies.length > 0) {
          console.log(`\n异常详情:`);
          result.anomalies.forEach((a, i) => {
            console.log(`\n  ${i + 1}. [${a.actionPriority}] ${a.name}`);
            console.log(`     描述: ${a.message}`);
          });
        }
        
        printSeparator();
      }
    } finally {
      closeServices();
    }
  });

program
  .command('revalidate-all')
  .description('重新校验所有包裹')
  .option('--json', '输出 JSON 格式')
  .action(async (options) => {
    await initServices();
    
    try {
      const result = analyzer.revalidateAll();
      
      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        printSeparator();
        console.log(`重新校验完成`);
        printSeparator();
        console.log(`总包裹数: ${result.total}`);
        
        let valid = 0, warning = 0, error = 0;
        result.results.forEach(r => {
          if (r.result === 'valid') valid++;
          else if (r.result === 'warning') warning++;
          else if (r.result === 'error') error++;
        });
        
        console.log(`  正常: ${valid}`);
        console.log(`  警告: ${warning}`);
        console.log(`  异常: ${error}`);
        printSeparator();
      }
    } finally {
      closeServices();
    }
  });

program
  .command('export <type>')
  .description('导出报告')
  .option('-i, --id <id>', '运行ID或运单号')
  .option('-o, --output <output>', '输出路径')
  .option('-f, --format <format>', '输出格式: json|md|csv', 'json')
  .action(async (type, options) => {
    await initServices();
    
    try {
      if (!options.id) {
        console.error('请指定 ID: -i <id>');
        process.exit(1);
      }
      
      let outputPath;
      
      const format = options.format.toLowerCase();
      
      if (type === 'run') {
        outputPath = options.output || `exports/run_${options.id}.${format}`;
        const validations = db.getRunValidations(options.id);
        const run = db.getRun(options.id);
        
        if (format === 'csv') {
          await exporter.exportRunToCSV(options.id, outputPath);
        } else if (format === 'md' || format === 'markdown') {
          exporter.exportRunToMarkdown({ run, validations }, outputPath);
        } else {
          exporter.exportToJSON({ run, validations }, outputPath);
        }
      } else if (type === 'package') {
        outputPath = options.output || `exports/package_${options.id}.${format}`;
        const validations = db.getPackageValidations(options.id, 1);
        if (validations.length === 0) {
          console.error(`未找到包裹校验记录: ${options.id}`);
          process.exit(1);
        }
        const anomalies = db.getValidationAnomalies(validations[0].id);
        const pkg = db.getPackage(options.id);
        const traces = db.getPackageTraces(pkg.id);
        const fullReport = {
          package: pkg,
          validation: validations[0],
          traces,
          anomalies
        };
        
        if (format === 'csv') {
          await exporter.exportPackageAnomaliesToCSV(options.id, outputPath);
        } else if (format === 'md' || format === 'markdown') {
          exporter.exportPackageToMarkdown(fullReport, outputPath);
        } else {
          exporter.exportToJSON(fullReport, outputPath);
        }
      } else {
        console.error(`未知导出类型: ${type}`);
        process.exit(1);
      }
      
      console.log(`导出成功: ${outputPath}`);
    } finally {
      closeServices();
    }
  });

program
  .command('import <file>')
  .description('导入轨迹数据')
  .option('--force', '强制覆盖已存在的数据')
  .option('--json', '输出 JSON 格式')
  .action(async (filePath, options) => {
    await initServices();
    
    try {
      const fullPath = path.resolve(process.cwd(), filePath);
      if (!fs.existsSync(fullPath)) {
        console.error(`文件不存在: ${fullPath}`);
        process.exit(1);
      }
      
      const content = fs.readFileSync(fullPath, 'utf8');
      const data = JSON.parse(content);
      const packages = Array.isArray(data) ? data : data.packages || [data];
      
      const results = [];
      
      for (const pkg of packages) {
        if (!pkg.trackingNumber && !pkg.tracking_number) {
          console.error('缺少运单号');
          continue;
        }
        
        const trackingNumber = pkg.trackingNumber || pkg.tracking_number;
        const traces = pkg.traces || [];
        
        const pkgResult = db.upsertPackage(trackingNumber, {
          source: pkg.source,
          carrier: pkg.carrier
        });
        
        if (options.force) {
          db.deletePackageTraces(pkgResult.id);
        }
        
        const inserted = db.insertTraces(pkgResult.id, traces);
        
        results.push({
          trackingNumber,
          isNew: pkgResult.isNew,
          updated: pkgResult.updated,
          tracesCount: inserted.filter(i => i.inserted).length,
          duplicates: inserted.filter(i => !i.inserted).length
        });
      }
      
      if (options.json) {
        console.log(JSON.stringify(results, null, 2));
      } else {
        printSeparator();
        console.log(`导入结果:`);
        printSeparator();
        
        results.forEach(r => {
          const status = r.isNew ? '[新增]' : r.updated ? '[更新]' : '[跳过]';
          console.log(`${status} ${r.trackingNumber}`);
          console.log(`   新增轨迹: ${r.tracesCount} | 重复: ${r.duplicates}`);
        });
        
        printSeparator();
      }
    } finally {
      closeServices();
    }
  });

program
  .command('report <trackingNumber>')
  .description('生成详细分析报告')
  .option('-o, --output <output>', '输出路径')
  .option('-f, --format <format>', '输出格式: json|md', 'md')
  .action(async (trackingNumber, options) => {
    await initServices();
    
    try {
      const validations = db.getPackageValidations(trackingNumber, 1);
      if (validations.length === 0) {
        console.error(`未找到包裹校验记录: ${trackingNumber}`);
        console.log('提示: 先使用 validate 命令进行校验');
        process.exit(1);
      }
      
      const validation = validations[0];
      const pkg = db.getPackage(trackingNumber);
      const traces = db.getPackageTraces(pkg.id);
      const anomalies = db.getValidationAnomalies(validation.id);
      
      const parsedAnomalies = anomalies.map(a => ({
        ...a,
        causes: JSON.parse(a.causes || '[]'),
        evidence: JSON.parse(a.evidence || '[]'),
        suggestions: JSON.parse(a.suggestions || '[]')
      }));
      
      const analysis = {
        result: validation.result,
        traceCount: validation.trace_count,
        summary: {
          total: validation.anomalies_total,
          high: validation.anomalies_high,
          medium: validation.anomalies_medium,
          low: validation.anomalies_low
        },
        durationMs: validation.duration_ms,
        sortedTraces: traces,
        anomalies: parsedAnomalies
      };
      
      const outputPath = options.output || `reports/${trackingNumber}.${options.format}`;
      exporter.exportReport(analysis, outputPath, { format: options.format });
      
      console.log(`报告已生成: ${outputPath}`);
    } finally {
      closeServices();
    }
  });

program.parseAsync(process.argv);
