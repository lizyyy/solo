#!/usr/bin/env node

const { Command } = require('commander');
const fs = require('fs');
const { format } = require('date-fns');
const { addRecord, updateRecord, getRecord, queryRecords, loadConfig } = require('./storage');
const { processRecord, checkTimeoutEscalation, handleReinspectionFailure, generateSummary } = require('./rules');
const { exportToCSV, exportToJSON, exportSummary } = require('./exporter');

const program = new Command();

program
  .name('pump-inspect')
  .description('小区地下泵房巡检记录管理工具')
  .version('1.0.0');

program
  .command('add')
  .description('添加巡检记录')
  .requiredOption('-p, --pump-room <name>', '泵房名称')
  .option('-a, --anomaly-type <type>', '异常类型')
  .option('-d, --description <text>', '问题描述')
  .option('-h, --handler <name>', '负责人')
  .action(async (options) => {
    const record = {
      pumpRoom: options.pumpRoom,
      anomalyType: options.anomalyType || '设备故障',
      description: options.description || '',
      handler: options.handler || '',
      status: 'open',
      escalationLevel: 0
    };

    const result = processRecord(record);
    
    if (result.action === 'blocked') {
      console.log('\n❌ 记录被拦截');
      console.log(`原因: ${result.reason}`);
      console.log(`关联记录ID: ${result.details.duplicateIds.join(', ')}`);
    } else {
      const saved = addRecord({ ...record, processingResult: result.reason });
      console.log('\n✅ 记录已添加');
      console.log(`ID: ${saved.id}`);
      console.log(`泵房: ${saved.pumpRoom}`);
      console.log(`状态: ${saved.status}`);
      console.log(`处理结果: ${result.reason}`);
    }
    console.log('');
  });

program
  .command('import')
  .description('从JSON文件批量导入记录')
  .argument('<file>', 'JSON文件路径')
  .action(async (file) => {
    const content = fs.readFileSync(file, 'utf8');
    const records = JSON.parse(content);
    let imported = 0;
    let blocked = 0;

    console.log('\n=== 批量导入结果 ===\n');

    for (const record of records) {
      const result = processRecord(record);
      
      if (result.action === 'blocked') {
        blocked++;
        console.log(`❌ 拦截 - ${record.pumpRoom}: ${result.reason}`);
      } else {
        addRecord({ ...record, processingResult: result.reason });
        imported++;
        console.log(`✅ 导入 - ${record.pumpRoom}`);
      }
    }

    console.log(`\n总计: 导入${imported}条, 拦截${blocked}条\n`);
  });

program
  .command('review')
  .description('复核/复测记录')
  .argument('<id>', '记录ID')
  .option('-p, --passed', '复测通过')
  .option('-r, --reason <text>', '复测不通过原因')
  .option('-i, --inspector <name>', '复核人')
  .action((id, options) => {
    const record = getRecord(id);
    if (!record) {
      console.log('\n❌ 未找到该记录\n');
      return;
    }

    const result = handleReinspectionFailure(id, {
      passed: options.passed || false,
      reason: options.reason || '',
      inspector: options.inspector || ''
    });

    console.log('\n✅ 复核完成');
    console.log(`记录ID: ${result.id}`);
    console.log(`泵房: ${result.pumpRoom}`);
    console.log(`新状态: ${result.status}`);
    if (result.reinspection) {
      console.log(`复测结果: ${result.reinspection.passed ? '通过' : '不通过'}`);
    }
    console.log('');
  });

program
  .command('list')
  .description('查询记录列表')
  .option('-H, --handler <name>', '按负责人筛选')
  .option('-s, --status <status>', '按状态筛选 (open/closed/reopen)')
  .option('-a, --anomaly-type <type>', '按异常类型筛选')
  .option('-p, --pump-room <name>', '按泵房筛选')
  .option('--start-date <date>', '开始日期 (YYYY-MM-DD)')
  .option('--end-date <date>', '结束日期 (YYYY-MM-DD)')
  .action((options) => {
    const records = queryRecords(options);
    
    if (records.length === 0) {
      console.log('\n没有找到匹配的记录\n');
      return;
    }

    console.log(`\n=== 查询结果 (共${records.length}条) ===\n`);
    
    records.forEach(r => {
      const escalation = r.escalationLevel > 0 ? ` ⚠️ L${r.escalationLevel}` : '';
      console.log(`[${r.id}] ${r.pumpRoom} | ${r.status}${escalation}`);
      console.log(`    负责人: ${r.handler || '-'} | 异常: ${r.anomalyType || '-'}`);
      console.log(`    创建时间: ${format(new Date(r.createdAt), 'yyyy-MM-dd HH:mm')}`);
      if (r.processingResult) {
        console.log(`    处理说明: ${r.processingResult}`);
      }
      console.log('');
    });
  });

program
  .command('summary')
  .description('查看统计摘要')
  .action(() => {
    const summary = generateSummary();
    
    console.log('\n=== 泵房巡检记录汇总 ===\n');
    console.log('📊 统计数据:');
    console.log(`  总记录数: ${summary.stats.total}`);
    console.log(`  进行中: ${summary.stats.open}`);
    console.log(`  已关闭: ${summary.stats.closed}`);
    console.log(`  已重开: ${summary.stats.reopen}`);
    console.log(`  已升级: ${summary.stats.escalated}`);
    console.log(`  ⚠️  需关注(超时24h): ${summary.stats.needsAttention}`);
    
    console.log('\n🏢 按泵房统计:');
    Object.entries(summary.byPumpRoom).forEach(([k, v]) => {
      console.log(`  ${k}: ${v}条`);
    });
    
    console.log('\n👤 按负责人统计:');
    Object.entries(summary.byHandler).forEach(([k, v]) => {
      console.log(`  ${k}: ${v}条`);
    });
    
    console.log('\n🔧 按异常类型统计:');
    Object.entries(summary.byAnomalyType).forEach(([k, v]) => {
      console.log(`  ${k}: ${v}条`);
    });
    
    console.log('');
  });

program
  .command('escalate')
  .description('检查并执行超时升级')
  .action(() => {
    const escalated = checkTimeoutEscalation();
    
    if (escalated.length === 0) {
      console.log('\n没有需要升级的记录\n');
      return;
    }

    console.log(`\n=== 已升级${escalated.length}条记录 ===\n`);
    
    escalated.forEach(r => {
      const lastEscalation = r.escalationHistory[r.escalationHistory.length - 1];
      console.log(`[${r.id}] ${r.pumpRoom}`);
      console.log(`    升级至: ${lastEscalation.escalatedTo}`);
      console.log(`    原因: ${lastEscalation.reason}`);
      console.log('');
    });
  });

program
  .command('export')
  .description('导出记录')
  .option('-f, --format <type>', '导出格式 (csv/json/txt)', 'csv')
  .option('-o, --output <path>', '输出文件路径')
  .option('-H, --handler <name>', '按负责人筛选')
  .option('-s, --status <status>', '按状态筛选')
  .option('-a, --anomaly-type <type>', '按异常类型筛选')
  .option('--summary', '导出汇总报告')
  .action(async (options) => {
    const records = queryRecords({
      handler: options.handler,
      status: options.status,
      anomalyType: options.anomalyType
    });

    const format = options.format;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const defaultPath = options.summary 
      ? `summary-${timestamp}.txt`
      : `records-${timestamp}.${format}`;
    const outputPath = options.output || defaultPath;

    if (options.summary) {
      const summary = generateSummary();
      exportSummary(summary, outputPath);
    } else if (format === 'csv') {
      await exportToCSV(records, outputPath);
    } else if (format === 'json') {
      exportToJSON(records, outputPath);
    }

    console.log(`\n✅ 已导出到: ${outputPath}\n`);
  });

program
  .command('config')
  .description('查看配置')
  .action(() => {
    const config = loadConfig();
    console.log('\n=== 当前配置 ===\n');
    console.log(`超时升级时间: ${config.timeoutHours}小时`);
    console.log(`重复报修检测窗口: ${config.duplicateWindowHours}小时`);
    console.log(`升级级别: ${config.escalationLevels.join(' -> ')}`);
    console.log('');
  });

program.parse();
