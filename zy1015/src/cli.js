#!/usr/bin/env node

const { program } = require('commander');
const path = require('path');

const parser = require('./parser');
const executor = require('./executor');
const rules = require('./rules');
const reporter = require('./reporter');

program
  .name('sqlite-migrate-check')
  .description('SQLite 迁移体检 CLI - 检查迁移文件顺序、执行错误、破坏性操作等')
  .version('1.0.0');

program
  .option('--schema <path>', '初始 schema.sql 文件路径')
  .option('--migrations <dir>', 'migrations 目录路径')
  .option('--output <dir>', '报告输出目录 (默认: ./reports)', './reports')
  .option('--no-stop-on-error', '遇到错误时继续执行后续迁移')
  .option('--json-only', '只生成 JSON 报告，不生成 Markdown')
  .option('--md-only', '只生成 Markdown 报告，不生成 JSON')
  .action(async (options) => {
    try {
      await runCheck(options);
    } catch (error) {
      console.error('执行出错:', error.message);
      process.exit(1);
    }
  });

program.parse(process.argv);

async function runCheck(options) {
  const schemaPath = options.schema ? path.resolve(options.schema) : null;
  const migrationsDir = options.migrations ? path.resolve(options.migrations) : null;
  const outputDir = path.resolve(options.output);
  const stopOnError = options.stopOnError !== false;

  if (!schemaPath || !migrationsDir) {
    console.error('错误: 必须提供 --schema 和 --migrations 参数');
    program.help();
    return;
  }

  console.log('📋 SQLite 迁移体检工具');
  console.log('='.repeat(50));
  console.log(`Schema: ${schemaPath}`);
  console.log(`Migrations: ${migrationsDir}`);
  console.log(`输出目录: ${outputDir}`);
  console.log();

  console.log('1️⃣  解析文件...');
  const schemaData = parser.readSchemaFile(schemaPath);
  if (!schemaData.exists) {
    console.error(`错误: Schema 文件不存在: ${schemaPath}`);
    process.exit(1);
  }

  const migrationsData = parser.readMigrationsDirectory(migrationsDir);
  if (!migrationsData.exists) {
    console.error(`错误: Migrations 目录不存在: ${migrationsDir}`);
    process.exit(1);
  }

  console.log(`   找到 ${migrationsData.files.length} 个迁移文件`);
  if (migrationsData.validNumberFiles) {
    console.log(`   ${migrationsData.validNumberFiles.length} 个文件命名规范`);
  }
  if (migrationsData.invalidNumberFiles && migrationsData.invalidNumberFiles.length > 0) {
    console.log(`   ${migrationsData.invalidNumberFiles.length} 个文件命名不规范`);
  }
  console.log();

  console.log('2️⃣  检查迁移文件顺序...');
  const orderingIssues = parser.checkMigrationOrdering(migrationsData);
  if (orderingIssues.length > 0) {
    console.log(`   发现 ${orderingIssues.length} 个顺序相关问题`);
  } else {
    console.log('   ✓ 顺序检查通过');
  }
  console.log();

  console.log('3️⃣  在临时数据库中执行迁移...');
  let tempDb = null;
  let schemaBefore = null;
  let schemaAfter = null;
  let schemaChanges = null;
  let executionResults = { success: true, results: [] };
  let ruleIssues = [];

  try {
    tempDb = await executor.createTemporaryDatabase();
    console.log(`   临时数据库: ${tempDb.dbPath}`);

    console.log('   执行初始 Schema...');
    const schemaResult = executor.executeSchema(tempDb.db, schemaData.statements);
    if (!schemaResult.success) {
      console.error('   ✗ Schema 执行失败!');
      for (const r of schemaResult.results) {
        if (!r.success) {
          console.error(`     错误: ${r.error}`);
        }
      }
      throw new Error('Schema 执行失败');
    }
    console.log('   ✓ Schema 执行成功');

    schemaBefore = executor.getDatabaseSchema(tempDb.db);
    console.log(`   初始表数量: ${schemaBefore.tableNames.length}`);

    if (migrationsData.orderedFiles && migrationsData.orderedFiles.length > 0) {
      console.log(`   执行 ${migrationsData.orderedFiles.length} 个迁移...`);
      executionResults = executor.executeMigrations(
        tempDb.db, 
        migrationsData.orderedFiles,
        stopOnError
      );

      if (executionResults.success) {
        console.log('   ✓ 所有迁移执行成功');
      } else {
        console.log('   ✗ 部分迁移执行失败');
      }
    } else {
      console.log('   没有可执行的迁移文件');
    }

    schemaAfter = executor.getDatabaseSchema(tempDb.db);
    schemaChanges = executor.compareSchemas(schemaBefore, schemaAfter);

    if (schemaChanges.hasChanges) {
      console.log(`   Schema 变化: 新增 ${schemaChanges.addedTables.length} 表, 删除 ${schemaChanges.removedTables.length} 表, 修改 ${Object.keys(schemaChanges.modifiedTables).length} 表`);
    } else {
      console.log('   Schema 无变化');
    }

  } finally {
    if (tempDb) {
      tempDb.cleanup();
      console.log('   临时数据库已清理');
    }
  }
  console.log();

  console.log('4️⃣  检查规则...');
  ruleIssues = rules.checkAllRules(migrationsData, executionResults, schemaChanges);
  
  const groupedRuleIssues = rules.groupIssuesBySeverity(ruleIssues);
  const totalRuleIssues = ruleIssues.length;
  
  if (totalRuleIssues > 0) {
    console.log(`   发现 ${totalRuleIssues} 个规则问题`);
    if (groupedRuleIssues.critical.length > 0) console.log(`     严重: ${groupedRuleIssues.critical.length}`);
    if (groupedRuleIssues.error.length > 0) console.log(`     错误: ${groupedRuleIssues.error.length}`);
    if (groupedRuleIssues.high.length > 0) console.log(`     高风险: ${groupedRuleIssues.high.length}`);
    if (groupedRuleIssues.warning.length > 0) console.log(`     警告: ${groupedRuleIssues.warning.length}`);
  } else {
    console.log('   ✓ 规则检查通过');
  }
  console.log();

  console.log('5️⃣  生成报告...');
  const timestamp = new Date().toISOString();
  
  const report = reporter.generateReport({
    schemaPath,
    migrationsDir,
    schemaData,
    migrationsData,
    orderingIssues,
    executionResults,
    schemaBefore,
    schemaAfter,
    schemaChanges,
    ruleIssues,
    outputDir,
    timestamp
  });

  reporter.ensureOutputDir(outputDir);

  let jsonPath = null;
  let mdPath = null;

  if (!options.mdOnly) {
    jsonPath = path.join(outputDir, 'report.json');
    reporter.writeJSONReport(report, jsonPath);
    console.log(`   JSON 报告: ${jsonPath}`);
  }

  if (!options.jsonOnly) {
    mdPath = path.join(outputDir, 'report.md');
    reporter.writeMarkdownReport(report, mdPath);
    console.log(`   Markdown 报告: ${mdPath}`);
  }
  console.log();

  reporter.printConsoleSummary(report);

  const hasBlockingIssues = 
    report.groupedIssues.critical.length > 0 || 
    report.groupedIssues.error.length > 0;

  if (hasBlockingIssues) {
    process.exit(1);
  }
}
