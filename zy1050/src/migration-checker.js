import MigrationScanner from './migration-scanner.js';
import DbEngine from './db-engine.js';
import SchemaDiff from './schema-diff.js';
import ConfigLoader from './config-loader.js';
import ReportGenerator from './report-generator.js';
import logger from './utils/logger.js';

export class MigrationChecker {
  constructor(options = {}) {
    this.migrationsDir = options.migrationsDir;
    this.configPath = options.configPath;
    this.outputDir = options.outputDir || './report';
    this.verbose = options.verbose || false;
    this.inMemory = options.inMemory !== false;
    this.formats = options.formats || ['json', 'markdown', 'html'];
    this.skipRollback = options.skipRollback || false;
  }

  async run() {
    const report = {
      timestamp: new Date().toISOString(),
      migrationsDir: this.migrationsDir,
      configPath: this.configPath,
      status: 'running',
      scanIssues: [],
      migrationResults: [],
      schemaDiffs: [],
      dataSnapshots: [],
      riskyChanges: [],
      rollbackTest: null,
      assertionResults: [],
      seedResults: [],
      totalMigrations: 0,
      successfulMigrations: 0,
      failedMigrations: 0,
      withRollback: 0
    };

    try {
      logger.info('开始 SQLite 迁移体检...');

      const configLoader = new ConfigLoader({ verbose: this.verbose });
      const config = this.configPath ? configLoader.load(this.configPath) : configLoader.getDefaultConfig();
      logger.debug('配置文件加载完成');

      const scanner = new MigrationScanner(this.migrationsDir, { verbose: this.verbose });
      const scanResult = scanner.scan();
      
      report.totalMigrations = scanResult.count;
      report.withRollback = scanResult.rollbackCount;
      report.scanIssues = scanResult.issues;

      for (const issue of scanResult.issues) {
        if (issue.type === 'duplicate') {
          report.riskyChanges.push({
            type: 'duplicate_version',
            severity: 'error',
            message: issue.message,
            details: issue.details
          });
        } else if (issue.type === 'gap') {
          report.riskyChanges.push({
            type: 'version_gap',
            severity: 'warning',
            message: issue.message,
            details: issue.details
          });
        } else if (issue.type === 'missing_rollback') {
          for (const version of issue.details) {
            report.riskyChanges.push({
              type: 'missing_rollback',
              severity: 'warning',
              version,
              message: `迁移 v${version} 缺少回滚脚本`
            });
          }
        }
      }

      if (scanResult.issues.some(i => i.severity === 'error')) {
        logger.error('迁移扫描发现严重错误，无法继续执行');
        report.status = 'failed';
        return report;
      }

      const db = new DbEngine({ 
        inMemory: this.inMemory,
        verbose: this.verbose 
      });
      db.init();

      try {
        const initialSchema = db.getSchemaSnapshot();
        const initialData = db.getTableDataSnapshot();

        if (config.seed && config.seed.length > 0) {
          logger.info('执行 seed 数据...');
          const seedResults = configLoader.executeSeed(db, config.seed);
          report.seedResults = seedResults;
          
          const seedFailed = seedResults.some(r => !r.success);
          if (seedFailed) {
            logger.error('部分 seed 执行失败');
          }
        }

        const schemaDiff = new SchemaDiff({ verbose: this.verbose });
        let prevSchema = db.getSchemaSnapshot();
        let prevData = db.getTableDataSnapshot(config.watchTables);

        report.dataSnapshots.push({
          version: 0,
          label: 'initial',
          schema: prevSchema,
          data: prevData
        });

        logger.info(`开始执行 ${scanResult.migrations.length} 个迁移...`);

        for (const migration of scanResult.migrations) {
          logger.step(report.migrationResults.length + 1, scanResult.migrations.length, `执行迁移 v${migration.version}: ${migration.name}`);
          
          const result = db.executeMigration(migration.version, migration.content, migration.name);
          report.migrationResults.push(result);

          if (result.success) {
            report.successfulMigrations++;

            const currentSchema = db.getSchemaSnapshot();
            const currentData = db.getTableDataSnapshot(config.watchTables);

            const diff = schemaDiff.compare(prevSchema, currentSchema);
            report.schemaDiffs.push({
              fromVersion: prevSchema === initialSchema ? 0 : migration.version - 1,
              toVersion: migration.version,
              diff: diff
            });

            if (diff.summary.riskyChanges && diff.summary.riskyChanges.length > 0) {
              for (const change of diff.summary.riskyChanges) {
                report.riskyChanges.push({
                  ...change,
                  migrationVersion: migration.version
                });
              }
            }

            report.dataSnapshots.push({
              version: migration.version,
              schema: currentSchema,
              data: currentData
            });

            prevSchema = currentSchema;
            prevData = currentData;
          } else {
            report.failedMigrations++;
            report.status = 'failed';
            logger.error(`迁移 v${migration.version} 执行失败，停止继续执行`);
            break;
          }
        }

        if (config.assertions && config.assertions.length > 0 && report.failedMigrations === 0) {
          logger.info('执行断言...');
          const assertionResults = configLoader.executeAssertions(db, config.assertions);
          report.assertionResults = assertionResults;
          
          const assertionsFailed = assertionResults.some(r => !r.success);
          if (assertionsFailed) {
            report.status = 'failed';
            logger.error('部分断言失败');
          }
        }

        if (!this.skipRollback && report.failedMigrations === 0) {
          logger.info('开始回滚测试...');
          report.rollbackTest = await this.testRollback(
            scanResult.migrations, 
            initialSchema, 
            schemaDiff
          );

          if (!report.rollbackTest.success) {
            report.status = 'failed';
            for (const issue of report.rollbackTest.issues || []) {
              report.riskyChanges.push({
                type: 'rollback_failed',
                severity: 'high',
                message: issue.message
              });
            }
            if (report.rollbackTest.schemaMismatch) {
              report.riskyChanges.push({
                type: 'rollback_schema_mismatch',
                severity: 'high',
                message: '回滚后 Schema 与初始状态不一致'
              });
            }
          }
        }

        if (report.status === 'running') {
          report.status = 'success';
        }

      } finally {
        db.close();
      }

      report.riskSummary = {
        high: report.riskyChanges.filter(c => c.severity === 'high').length,
        medium: report.riskyChanges.filter(c => c.severity === 'medium').length,
        low: report.riskyChanges.filter(c => c.severity === 'low').length,
        warning: report.riskyChanges.filter(c => c.severity === 'warning').length,
        error: report.riskyChanges.filter(c => c.severity === 'error').length
      };

      if (report.status === 'success') {
        logger.success('迁移体检完成！');
      } else {
        logger.warn('迁移体检发现问题');
      }

      return report;

    } catch (error) {
      report.status = 'error';
      report.error = error.message;
      logger.error(`迁移体检出错: ${error.message}`);
      return report;
    }
  }

  async testRollback(migrations, initialSchema, schemaDiff) {
    const result = {
      success: true,
      issues: [],
      schemaMismatch: false
    };

    const rollbackDb = new DbEngine({ 
      inMemory: true,
      verbose: this.verbose 
    });
    rollbackDb.init();

    try {
      logger.info('  重新执行所有迁移...');
      for (const migration of migrations) {
        const migrateResult = rollbackDb.executeMigration(migration.version, migration.content, migration.name);
        if (!migrateResult.success) {
          result.success = false;
          result.issues.push({
            type: 'migration_failed',
            version: migration.version,
            message: `迁移 v${migration.version} 在回滚测试中执行失败: ${migrateResult.error?.message}`
          });
          return result;
        }
      }

      const afterMigrateSchema = rollbackDb.getSchemaSnapshot();
      const migrateDiff = schemaDiff.compare(initialSchema, afterMigrateSchema);
      
      if (migrateDiff.summary.totalChanges === 0) {
        logger.warn('  迁移后 Schema 无变化，跳过回滚测试');
        return result;
      }

      logger.info('  执行回滚脚本...');
      const migrationsWithRollback = migrations.filter(m => m.hasRollback);
      
      if (migrationsWithRollback.length === 0) {
        logger.warn('  没有找到任何回滚脚本');
        result.success = false;
        result.issues.push({
          type: 'no_rollback_scripts',
          message: '没有回滚脚本可执行'
        });
        return result;
      }

      const reversedMigrations = [...migrationsWithRollback].reverse();

      for (const migration of reversedMigrations) {
        logger.info(`    回滚 v${migration.version}: ${migration.rollback.name}`);
        
        const rollbackResult = rollbackDb.executeRollback(
          migration.version, 
          migration.rollback.content, 
          migration.rollback.name
        );

        if (!rollbackResult.success) {
          result.success = false;
          result.issues.push({
            type: 'rollback_failed',
            version: migration.version,
            message: `回滚 v${migration.version} 执行失败: ${rollbackResult.error?.message}`
          });
        }
      }

      logger.info('  验证回滚后 Schema...');
      const afterRollbackSchema = rollbackDb.getSchemaSnapshot();
      const rollbackDiff = schemaDiff.compare(afterRollbackSchema, initialSchema);

      if (rollbackDiff.summary.totalChanges > 0) {
        result.schemaMismatch = true;
        result.success = false;
        result.issues.push({
          type: 'schema_mismatch',
          message: `回滚后 Schema 与初始状态不一致，存在 ${rollbackDiff.summary.totalChanges} 处差异`,
          diff: rollbackDiff
        });
      }

      if (result.success) {
        logger.success('  回滚测试通过');
      } else {
        logger.error('  回滚测试失败');
      }

      return result;

    } finally {
      rollbackDb.close();
    }
  }

  generateReport(reportData) {
    const generator = new ReportGenerator({ 
      verbose: this.verbose,
      outputDir: this.outputDir
    });

    logger.info('生成报告...');
    const outputs = generator.generate(reportData, { formats: this.formats });
    
    if (this.outputDir) {
      return generator.save(outputs, this.outputDir);
    }
    
    return outputs;
  }
}

export default MigrationChecker;
