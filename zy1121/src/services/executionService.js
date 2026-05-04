const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const Migration = require('../models/migration');
const ExecutionHistory = require('../models/executionHistory');
const PlanGenerator = require('./planGenerator');
const DryRunChecker = require('./dryRunChecker');
const HealthChecker = require('./healthChecker');
const MigrationParser = require('./migrationParser');
const { BadRequestError, NotFoundError, ValidationError } = require('../middleware/errorHandler');

class ExecutionService {
  static async executeMigrationOnDb(dbPath, sql) {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(dbPath);
      const statements = MigrationParser.parseSqlContent(sql);
      const results = [];
      
      db.serialize(() => {
        db.run('BEGIN TRANSACTION;');
        db.run('PRAGMA foreign_keys = ON;');
        
        for (const statement of statements) {
          db.run(statement, function(err) {
            if (err) {
              db.run('ROLLBACK;');
              db.close();
              reject({
                success: false,
                statement: statement,
                error: err.message,
                code: err.code
              });
              return;
            }
            results.push({
              success: true,
              statement: statement,
              changes: this.changes || 0
            });
          });
        }
        
        db.run('COMMIT;', (err) => {
          db.close();
          if (err) reject(err);
          else resolve(results);
        });
      });
    });
  }

  static async applyMigrations(projectId, plan, options = {}) {
    const Project = require('../models/project');
    const project = await Project.findById(projectId);
    
    if (!project) {
      throw new NotFoundError(`Project with id ${projectId} not found`);
    }
    
    if (plan.migrations.length === 0) {
      return {
        success: true,
        message: 'No migrations to apply',
        execution: null
      };
    }
    
    const validation = await PlanGenerator.validatePlan(plan);
    if (!validation.valid && !options.force) {
      throw new ValidationError('Plan validation failed', 'PLAN_VALIDATION_FAILED', validation.issues);
    }
    
    const execution = await ExecutionHistory.create(
      projectId,
      plan.migrations.map(m => m.id),
      'up',
      'running'
    );
    
    try {
      const dbPath = project.db_path;
      
      for (const migration of plan.migrations) {
        try {
          await this.executeMigrationOnDb(dbPath, migration.up_sql);
          await ExecutionHistory.recordAppliedMigration(
            projectId,
            migration.id,
            execution.id
          );
        } catch (err) {
          await ExecutionHistory.updateStatus(
            execution.id,
            'failed',
            `Migration ${migration.version} failed: ${err.error || err.message}`
          );
          throw new BadRequestError(
            `Migration ${migration.version} failed`,
            'MIGRATION_FAILED',
            err
          );
        }
      }
      
      await ExecutionHistory.updateStatus(execution.id, 'success');
      
      return {
        success: true,
        message: `Successfully applied ${plan.migrations.length} migrations`,
        execution: await ExecutionHistory.findById(execution.id),
        migrations_applied: plan.migrations.map(m => ({
          id: m.id,
          version: m.version,
          name: m.name
        }))
      };
      
    } catch (err) {
      const currentExec = await ExecutionHistory.findById(execution.id);
      if (currentExec && currentExec.status === 'running') {
        await ExecutionHistory.updateStatus(execution.id, 'failed', err.message);
      }
      throw err;
    }
  }

  static async rollbackMigrations(projectId, plan, options = {}) {
    const Project = require('../models/project');
    const project = await Project.findById(projectId);
    
    if (!project) {
      throw new NotFoundError(`Project with id ${projectId} not found`);
    }
    
    if (plan.migrations.length === 0) {
      return {
        success: true,
        message: 'No migrations to rollback',
        execution: null
      };
    }
    
    const migrationsWithoutDown = plan.migrations.filter(m => !m.down_sql);
    if (migrationsWithoutDown.length > 0 && !options.force) {
      const versions = migrationsWithoutDown.map(m => m.version).join(', ');
      throw new BadRequestError(
        `Cannot rollback: migrations ${versions} have no down scripts`,
        'MISSING_DOWN_SCRIPTS'
      );
    }
    
    const execution = await ExecutionHistory.create(
      projectId,
      plan.migrations.map(m => m.id),
      'down',
      'running'
    );
    
    try {
      const dbPath = project.db_path;
      
      for (const migration of plan.migrations) {
        if (!migration.down_sql) {
          continue;
        }
        
        try {
          await this.executeMigrationOnDb(dbPath, migration.down_sql);
          await ExecutionHistory.removeAppliedMigration(
            projectId,
            migration.id
          );
        } catch (err) {
          await ExecutionHistory.updateStatus(
            execution.id,
            'failed',
            `Rollback of migration ${migration.version} failed: ${err.error || err.message}`
          );
          throw new BadRequestError(
            `Rollback of migration ${migration.version} failed`,
            'ROLLBACK_FAILED',
            err
          );
        }
      }
      
      await ExecutionHistory.updateStatus(execution.id, 'success');
      
      return {
        success: true,
        message: `Successfully rolled back ${plan.migrations.length} migrations`,
        execution: await ExecutionHistory.findById(execution.id),
        migrations_rolled_back: plan.migrations.map(m => ({
          id: m.id,
          version: m.version,
          name: m.name
        })),
        new_version: plan.new_version
      };
      
    } catch (err) {
      const currentExec = await ExecutionHistory.findById(execution.id);
      if (currentExec && currentExec.status === 'running') {
        await ExecutionHistory.updateStatus(execution.id, 'failed', err.message);
      }
      throw err;
    }
  }

  static async dryRunApply(projectId, plan) {
    const Project = require('../models/project');
    const project = await Project.findById(projectId);
    
    if (!project) {
      throw new NotFoundError(`Project with id ${projectId} not found`);
    }
    
    const report = await DryRunChecker.dryRunApply(
      project.db_path,
      plan,
      { keep_temp_db: false, continue_on_error: true }
    );
    
    return report;
  }

  static async dryRunRollback(projectId, plan) {
    const Project = require('../models/project');
    const project = await Project.findById(projectId);
    
    if (!project) {
      throw new NotFoundError(`Project with id ${projectId} not found`);
    }
    
    const report = await DryRunChecker.dryRunRollback(
      project.db_path,
      plan,
      { keep_temp_db: false, continue_on_error: true }
    );
    
    return report;
  }

  static async checkProjectHealth(projectId) {
    const Project = require('../models/project');
    const project = await Project.findById(projectId);
    
    if (!project) {
      throw new NotFoundError(`Project with id ${projectId} not found`);
    }
    
    const dbPath = project.db_path;
    
    if (!fs.existsSync(dbPath)) {
      throw new NotFoundError(`Database file not found: ${dbPath}`, 'DB_FILE_NOT_FOUND');
    }
    
    const state = await HealthChecker.getDatabaseState(dbPath);
    const healthCheck = await HealthChecker.checkAll(dbPath);
    
    const migrationValidation = await MigrationParser.validateMigrations(projectId);
    
    return {
      project_id: projectId,
      database_path: dbPath,
      database_state: state,
      health_check: healthCheck,
      migration_validation: migrationValidation
    };
  }

  static async exportReport(projectId, format = 'json') {
    const Project = require('../models/project');
    const project = await Project.findById(projectId);
    
    if (!project) {
      throw new NotFoundError(`Project with id ${projectId} not found`);
    }
    
    const migrations = await Migration.findByProject(projectId);
    const applied = await Migration.getAppliedMigrations(projectId);
    const pending = await Migration.getPendingMigrations(projectId);
    const history = await ExecutionHistory.findByProject(projectId);
    
    const healthCheck = await this.checkProjectHealth(projectId);
    const migrationReport = await PlanGenerator.generateMigrationReport(projectId);
    
    const reportData = {
      generated_at: new Date().toISOString(),
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        database_path: project.db_path
      },
      migration_summary: {
        total: migrations.length,
        applied: applied.length,
        pending: pending.length,
        current_version: applied.length > 0 ? applied[applied.length - 1].version : null
      },
      migrations: migrations.map(m => ({
        id: m.id,
        version: m.version,
        name: m.name,
        status: applied.some(a => a.id === m.id) ? 'applied' : 'pending',
        has_down: !!m.down_sql,
        dependencies: m.dependencies,
        description: m.description,
        up_sql: m.up_sql.substring(0, 200) + (m.up_sql.length > 200 ? '...' : ''),
        down_sql_preview: m.down_sql ? m.down_sql.substring(0, 200) + (m.down_sql.length > 200 ? '...' : '') : null
      })),
      execution_history: history.slice(0, 50).map(h => ({
        id: h.id,
        direction: h.direction,
        status: h.status,
        started_at: h.started_at,
        completed_at: h.completed_at,
        migration_count: h.migration_ids.length
      })),
      health_check: healthCheck.health_check,
      issues: [
        ...healthCheck.health_check.warnings.map(w => ({
          ...w,
          source: 'database'
        })),
        ...healthCheck.migration_validation.errors.map(e => ({
          ...e,
          severity: 'critical',
          source: 'migration_validation'
        })),
        ...healthCheck.migration_validation.warnings.map(w => ({
          ...w,
          severity: 'medium',
          source: 'migration_validation'
        }))
      ]
    };
    
    switch (format.toLowerCase()) {
      case 'json':
        return {
          format: 'json',
          content: JSON.stringify(reportData, null, 2),
          contentType: 'application/json'
        };
      
      case 'csv':
        return this.exportToCsv(reportData);
      
      case 'markdown':
      case 'md':
        return this.exportToMarkdown(reportData);
      
      default:
        throw new BadRequestError(`Unsupported format: ${format}`, 'UNSUPPORTED_FORMAT');
    }
  }

  static exportToCsv(reportData) {
    const lines = [];
    
    lines.push('Section,Version,Name,Status,Has Down Script,Dependencies,Description');
    for (const m of reportData.migrations) {
      lines.push([
        'Migrations',
        m.version,
        m.name,
        m.status,
        m.has_down ? 'Yes' : 'No',
        m.dependencies.join(';'),
        m.description || ''
      ].join(','));
    }
    
    lines.push('');
    lines.push('Issue Type,Severity,Message,Source,Table/Version');
    for (const issue of reportData.issues) {
      lines.push([
        issue.type || 'Unknown',
        issue.severity || 'medium',
        (issue.message || '').replace(/,/g, ';'),
        issue.source || 'unknown',
        (issue.table || issue.version || '').replace(/,/g, ';')
      ].join(','));
    }
    
    lines.push('');
    lines.push('Execution ID,Direction,Status,Started At,Completed At,Migration Count');
    for (const h of reportData.execution_history) {
      lines.push([
        h.id,
        h.direction,
        h.status,
        h.started_at || '',
        h.completed_at || '',
        h.migration_count
      ].join(','));
    }
    
    return {
      format: 'csv',
      content: lines.join('\n'),
      contentType: 'text/csv'
    };
  }

  static exportToMarkdown(reportData) {
    const lines = [];
    
    lines.push(`# Migration Health Report`);
    lines.push('');
    lines.push(`> Generated at: ${reportData.generated_at}`);
    lines.push('');
    lines.push(`## Project: ${reportData.project.name}`);
    lines.push(`- **ID**: ${reportData.project.id}`);
    lines.push(`- **Database**: ${reportData.project.database_path}`);
    if (reportData.project.description) {
      lines.push(`- **Description**: ${reportData.project.description}`);
    }
    lines.push('');
    
    lines.push(`## Summary`);
    lines.push(`| Metric | Value |`);
    lines.push(`|--------|-------|`);
    lines.push(`| Total Migrations | ${reportData.migration_summary.total} |`);
    lines.push(`| Applied | ${reportData.migration_summary.applied} |`);
    lines.push(`| Pending | ${reportData.migration_summary.pending} |`);
    lines.push(`| Current Version | ${reportData.migration_summary.current_version || 'None'} |`);
    lines.push(`| Health Issues | ${reportData.issues.length} |`);
    lines.push('');
    
    lines.push(`## Issues Found`);
    if (reportData.issues.length === 0) {
      lines.push('✅ No issues found.');
    } else {
      lines.push(`| Severity | Type | Message | Source |`);
      lines.push(`|----------|------|---------|--------|`);
      
      for (const issue of reportData.issues) {
        const severityEmoji = {
          critical: '🔴',
          high: '🟠',
          medium: '🟡',
          low: '⚪'
        }[issue.severity] || '⚪';
        
        lines.push(`| ${severityEmoji} ${issue.severity} | ${issue.type || 'Unknown'} | ${issue.message} | ${issue.source} |`);
      }
    }
    lines.push('');
    
    lines.push(`## Migrations`);
    lines.push(`| Version | Name | Status | Down Script | Dependencies |`);
    lines.push(`|---------|------|--------|-------------|--------------|`);
    
    for (const m of reportData.migrations) {
      const statusEmoji = m.status === 'applied' ? '✅' : '⏳';
      const hasDown = m.has_down ? '✅' : '❌';
      lines.push(`| ${m.version} | ${m.name} | ${statusEmoji} ${m.status} | ${hasDown} | ${m.dependencies.join(', ') || '-'} |`);
    }
    lines.push('');
    
    lines.push(`## Recent Execution History`);
    if (reportData.execution_history.length === 0) {
      lines.push('No execution history found.');
    } else {
      lines.push(`| Direction | Status | Started At | Migrations |`);
      lines.push(`|-----------|--------|------------|------------|`);
      
      for (const h of reportData.execution_history.slice(0, 10)) {
        const statusEmoji = h.status === 'success' ? '✅' : h.status === 'failed' ? '❌' : '⏳';
        const dirEmoji = h.direction === 'up' ? '⬆️' : '⬇️';
        lines.push(`| ${dirEmoji} ${h.direction} | ${statusEmoji} ${h.status} | ${h.started_at} | ${h.migration_count} |`);
      }
    }
    
    return {
      format: 'markdown',
      content: lines.join('\n'),
      contentType: 'text/markdown'
    };
  }
}

module.exports = ExecutionService;
