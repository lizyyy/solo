const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const sqlite3 = require('sqlite3').verbose();
const MigrationParser = require('./migrationParser');
const HealthChecker = require('./healthChecker');

class DryRunChecker {
  static createTempDbPath() {
    const tempDir = process.env.TEMP_DIR || './temp';
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    return path.join(tempDir, `dry-run-${uuidv4()}.db`);
  }

  static async copyDatabase(sourcePath, destPath) {
    return new Promise((resolve, reject) => {
      fs.copyFile(sourcePath, destPath, (err) => {
        if (err) reject(err);
        else resolve(destPath);
      });
    });
  }

  static async createEmptyDb(destPath) {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(destPath, (err) => {
        if (err) {
          reject(err);
          return;
        }
        db.close((closeErr) => {
          if (closeErr) reject(closeErr);
          else resolve(destPath);
        });
      });
    });
  }

  static async executeMigration(dbPath, sqlStatements) {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(dbPath);
      const results = [];
      
      db.serialize(() => {
        db.run('PRAGMA foreign_keys = ON;');
        
        for (const statement of sqlStatements) {
          try {
            db.run(statement, function(err) {
              if (err) {
                results.push({
                  success: false,
                  statement: statement,
                  error: err.message,
                  code: err.code
                });
              } else {
                results.push({
                  success: true,
                  statement: statement,
                  changes: this.changes || 0,
                  lastID: this.lastID
                });
              }
            });
          } catch (syncErr) {
            results.push({
              success: false,
              statement: statement,
              error: syncErr.message
            });
          }
        }
      });
      
      db.close((err) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
  }

  static async executeInTransaction(dbPath, sqlStatements) {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(dbPath);
      const results = [];
      let hasError = false;
      
      db.serialize(() => {
        db.run('BEGIN TRANSACTION;');
        db.run('PRAGMA foreign_keys = ON;');
        
        for (const statement of sqlStatements) {
          if (hasError) continue;
          
          db.run(statement, function(err) {
            if (err) {
              hasError = true;
              results.push({
                success: false,
                statement: statement,
                error: err.message,
                code: err.code
              });
              db.run('ROLLBACK;');
            } else {
              results.push({
                success: true,
                statement: statement,
                changes: this.changes || 0
              });
            }
          });
        }
        
        if (!hasError) {
          db.run('COMMIT;', (err) => {
            if (err) {
              reject(err);
            }
          });
        }
      });
      
      db.close((err) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
  }

  static async dryRunApply(projectDbPath, plan, checkOptions = {}) {
    const tempDbPath = this.createTempDbPath();
    const report = {
      temp_db_path: tempDbPath,
      action: 'apply',
      success: true,
      errors: [],
      warnings: [],
      migration_results: [],
      before_state: null,
      after_state: null
    };
    
    try {
      if (fs.existsSync(projectDbPath)) {
        await this.copyDatabase(projectDbPath, tempDbPath);
      } else {
        await this.createEmptyDb(tempDbPath);
      }
      
      report.before_state = await HealthChecker.getDatabaseState(tempDbPath);
      
      for (const migration of plan.migrations) {
        const statements = MigrationParser.parseSqlContent(migration.up_sql);
        const migrationReport = {
          migration_id: migration.id,
          version: migration.version,
          name: migration.name,
          statements: statements,
          results: [],
          success: true,
          warnings: [],
          errors: []
        };
        
        if (statements.length === 0) {
          migrationReport.warnings.push({
            type: 'empty_migration',
            message: `Migration ${migration.version} has no SQL statements`
          });
          report.migration_results.push(migrationReport);
          continue;
        }
        
        const analysis = MigrationParser.analyzeMigration(migration);
        
        if (analysis.has_destructive_up) {
          migrationReport.warnings.push({
            type: 'destructive_operations',
            message: 'Migration contains destructive operations',
            detail: analysis.up_statements.filter(s => s.destructive).map(s => s.type)
          });
        }
        
        const results = await this.executeInTransaction(tempDbPath, statements);
        migrationReport.results = results;
        
        const failedResults = results.filter(r => !r.success);
        if (failedResults.length > 0) {
          migrationReport.success = false;
          migrationReport.errors = failedResults.map(r => ({
            statement: r.statement,
            error: r.error,
            code: r.code
          }));
          
          report.errors.push({
            migration_version: migration.version,
            errors: migrationReport.errors
          });
          report.success = false;
        }
        
        report.migration_results.push(migrationReport);
        
        if (!migrationReport.success && !checkOptions.continue_on_error) {
          break;
        }
      }
      
      if (report.success) {
        report.after_state = await HealthChecker.getDatabaseState(tempDbPath);
        
        const healthCheck = await HealthChecker.checkAll(tempDbPath, report.before_state);
        report.warnings = [...report.warnings, ...healthCheck.warnings];
        report.health_check = healthCheck;
        
        const dataCheck = await HealthChecker.checkDataCompatibility(tempDbPath, report.before_state);
        if (dataCheck.issues.length > 0) {
          report.warnings = [...report.warnings, ...dataCheck.issues];
          report.data_check = dataCheck;
        }
      }
      
      return report;
      
    } finally {
      if (!checkOptions.keep_temp_db) {
        try {
          if (fs.existsSync(tempDbPath)) {
            fs.unlinkSync(tempDbPath);
          }
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    }
  }

  static async dryRunRollback(projectDbPath, plan, checkOptions = {}) {
    const tempDbPath = this.createTempDbPath();
    const report = {
      temp_db_path: tempDbPath,
      action: 'rollback',
      success: true,
      errors: [],
      warnings: [],
      migration_results: [],
      before_state: null,
      after_state: null
    };
    
    try {
      if (fs.existsSync(projectDbPath)) {
        await this.copyDatabase(projectDbPath, tempDbPath);
      } else {
        throw new Error('Cannot rollback on non-existent database');
      }
      
      report.before_state = await HealthChecker.getDatabaseState(tempDbPath);
      
      for (const migration of plan.migrations) {
        if (!migration.down_sql) {
          report.errors.push({
            migration_version: migration.version,
            error: `Migration ${migration.version} has no down script`
          });
          report.success = false;
          continue;
        }
        
        const statements = MigrationParser.parseSqlContent(migration.down_sql);
        const migrationReport = {
          migration_id: migration.id,
          version: migration.version,
          name: migration.name,
          statements: statements,
          results: [],
          success: true,
          warnings: [],
          errors: []
        };
        
        const analysis = MigrationParser.analyzeMigration({
          up_sql: migration.down_sql,
          version: migration.version,
          name: migration.name,
          id: migration.id
        });
        
        if (analysis.has_destructive_up) {
          migrationReport.warnings.push({
            type: 'destructive_rollback',
            message: 'Rollback contains destructive operations',
            detail: analysis.up_statements.filter(s => s.destructive).map(s => s.type)
          });
          report.warnings.push({
            migration_version: migration.version,
            message: 'Rollback contains destructive operations'
          });
        }
        
        const results = await this.executeInTransaction(tempDbPath, statements);
        migrationReport.results = results;
        
        const failedResults = results.filter(r => !r.success);
        if (failedResults.length > 0) {
          migrationReport.success = false;
          migrationReport.errors = failedResults.map(r => ({
            statement: r.statement,
            error: r.error,
            code: r.code
          }));
          
          report.errors.push({
            migration_version: migration.version,
            errors: migrationReport.errors
          });
          report.success = false;
        }
        
        report.migration_results.push(migrationReport);
        
        if (!migrationReport.success && !checkOptions.continue_on_error) {
          break;
        }
      }
      
      if (report.success) {
        report.after_state = await HealthChecker.getDatabaseState(tempDbPath);
      }
      
      return report;
      
    } finally {
      if (!checkOptions.keep_temp_db) {
        try {
          if (fs.existsSync(tempDbPath)) {
            fs.unlinkSync(tempDbPath);
          }
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    }
  }

  static async validateMigrationSyntax(sql) {
    const tempDbPath = this.createTempDbPath();
    
    try {
      await this.createEmptyDb(tempDbPath);
      const statements = MigrationParser.parseSqlContent(sql);
      
      const results = [];
      for (const statement of statements) {
        try {
          const db = new sqlite3.Database(tempDbPath);
          
          await new Promise((resolve, reject) => {
            db.serialize(() => {
              db.run('BEGIN TRANSACTION;');
              db.run(statement, function(err) {
                if (err) {
                  results.push({
                    success: false,
                    statement: statement,
                    error: err.message,
                    code: err.code
                  });
                } else {
                  results.push({
                    success: true,
                    statement: statement
                  });
                }
                db.run('ROLLBACK;', (rollbackErr) => {
                  if (rollbackErr) reject(rollbackErr);
                  else resolve();
                });
              });
            });
          });
          
          db.close();
        } catch (err) {
          results.push({
            success: false,
            statement: statement,
            error: err.message
          });
        }
      }
      
      return {
        valid: results.every(r => r.success),
        results,
        errors: results.filter(r => !r.success)
      };
      
    } finally {
      try {
        if (fs.existsSync(tempDbPath)) {
          fs.unlinkSync(tempDbPath);
        }
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }
}

module.exports = DryRunChecker;
