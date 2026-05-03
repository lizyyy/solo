#!/usr/bin/env node

const { program } = require('commander');
const path = require('path');
const fs = require('fs');
const SQLParser = require('./sqlParser');
const RiskAssessor = require('./riskAssessor');
const SchemaParser = require('./schemaParser');
const TrafficParser = require('./trafficParser');
const ReportGenerator = require('./reportGenerator');

program
  .name('pg-migration-risk-check')
  .description('PostgreSQL 迁移脚本锁表风险预检 CLI 工具')
  .option('--migrations <path>', '迁移脚本目录 (migrations/*.sql)', 'migrations')
  .option('--schema <path>', 'Schema 快照文件 (schema_snapshot.json)', 'schema_snapshot.json')
  .option('--traffic <path>', '流量窗口配置 (traffic_windows.yaml)', 'traffic_windows.yaml')
  .option('--output <path>', '输出目录', '.')
  .action((options) => {
    runRiskCheck(options);
  });

program.parse(process.argv);

function runRiskCheck(options) {
  console.log('=== PostgreSQL 迁移脚本锁表风险预检 ===');
  console.log('');
  
  // 解析参数
  const migrationsDir = path.resolve(options.migrations);
  const schemaPath = path.resolve(options.schema);
  const trafficPath = path.resolve(options.traffic);
  const outputDir = path.resolve(options.output);
  
  console.log(`迁移脚本目录: ${migrationsDir}`);
  console.log(`Schema 快照文件: ${schemaPath}`);
  console.log(`流量窗口配置: ${trafficPath}`);
  console.log(`输出目录: ${outputDir}`);
  console.log('');
  
  // 检查文件是否存在
  if (!fs.existsSync(migrationsDir)) {
    console.error(`错误: 迁移脚本目录不存在: ${migrationsDir}`);
    process.exit(1);
  }
  
  if (!fs.existsSync(schemaPath)) {
    console.error(`错误: Schema 快照文件不存在: ${schemaPath}`);
    process.exit(1);
  }
  
  if (!fs.existsSync(trafficPath)) {
    console.error(`错误: 流量窗口配置文件不存在: ${trafficPath}`);
    process.exit(1);
  }
  
  // 确保输出目录存在
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  try {
    // 1. 解析 Schema 快照
    console.log('1. 解析 Schema 快照...');
    const schemaParser = new SchemaParser();
    const schema = schemaParser.parse(schemaPath);
    console.log(`   ✓ 解析完成，共 ${schema.tables.length} 张表`);
    
    // 2. 解析流量窗口配置
    console.log('2. 解析流量窗口配置...');
    const trafficParser = new TrafficParser();
    const trafficWindows = trafficParser.parse(trafficPath);
    console.log(`   ✓ 解析完成，共 ${trafficWindows.length} 个流量窗口`);
    
    // 3. 解析迁移脚本
    console.log('3. 解析迁移脚本...');
    const sqlParser = new SQLParser();
    const migrationFiles = sqlParser.getMigrationFiles(migrationsDir);
    console.log(`   ✓ 找到 ${migrationFiles.length} 个迁移文件`);
    
    const migrations = [];
    const warnings = [];
    
    for (const file of migrationFiles) {
      console.log(`   解析: ${path.basename(file)}`);
      const result = sqlParser.parseFile(file);
      migrations.push(result);
      
      // 收集警告
      if (result.warnings && result.warnings.length > 0) {
        warnings.push(...result.warnings.map(w => ({ file: path.basename(file), ...w })));
      }
    }
    
    // 4. 评估锁表风险
    console.log('4. 评估锁表风险...');
    const riskAssessor = new RiskAssessor(schema, trafficWindows);
    const riskAssessment = riskAssessor.assess(migrations);
    console.log(`   ✓ 评估完成`);
    
    // 5. 生成报告
    console.log('5. 生成报告...');
    const reportGenerator = new ReportGenerator(riskAssessment, warnings, outputDir);
    
    // 生成 Markdown 报告
    const mdPath = reportGenerator.generateMarkdown();
    console.log(`   ✓ 生成: ${mdPath}`);
    
    // 生成 CSV 报告
    const csvPath = reportGenerator.generateCSV();
    console.log(`   ✓ 生成: ${csvPath}`);
    
    // 生成 HTML 时间线
    const htmlPath = reportGenerator.generateHTML();
    console.log(`   ✓ 生成: ${htmlPath}`);
    
    console.log('');
    console.log('=== 风险预检完成 ===');
    console.log('');
    
    // 输出概要
    const { highRisk, mediumRisk, lowRisk, noRisk } = riskAssessment.summary;
    console.log(`风险概要:`);
    console.log(`  高风险操作: ${highRisk} 个`);
    console.log(`  中风险操作: ${mediumRisk} 个`);
    console.log(`  低风险操作: ${lowRisk} 个`);
    console.log(`  无风险操作: ${noRisk} 个`);
    
    if (warnings.length > 0) {
      console.log('');
      console.log(`检测到 ${warnings.length} 个警告:`);
      for (const warning of warnings.slice(0, 5)) {
        console.log(`  - [${warning.file}] ${warning.message}`);
      }
      if (warnings.length > 5) {
        console.log(`  ... 还有 ${warnings.length - 5} 个警告`);
      }
    }
    
    console.log('');
    console.log(`详细报告请查看:`);
    console.log(`  - ${mdPath}`);
    console.log(`  - ${csvPath}`);
    console.log(`  - ${htmlPath}`);
    
  } catch (error) {
    console.error('错误:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}