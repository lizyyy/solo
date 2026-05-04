const Migration = require('../models/migration');

class MigrationParser {
  static parseVersion(versionStr) {
    if (/^\d{14}$/.test(versionStr)) {
      const year = versionStr.slice(0, 4);
      const month = versionStr.slice(4, 6);
      const day = versionStr.slice(6, 8);
      const hour = versionStr.slice(8, 10);
      const minute = versionStr.slice(10, 12);
      const second = versionStr.slice(12, 14);
      return {
        type: 'timestamp',
        value: versionStr,
        date: `${year}-${month}-${day}T${hour}:${minute}:${second}Z`,
        numeric: parseInt(versionStr, 10)
      };
    }
    
    const semverMatch = versionStr.match(/^v?(\d+)\.(\d+)\.(\d+)$/);
    if (semverMatch) {
      return {
        type: 'semver',
        value: versionStr,
        major: parseInt(semverMatch[1], 10),
        minor: parseInt(semverMatch[2], 10),
        patch: parseInt(semverMatch[3], 10),
        numeric: parseInt(semverMatch[1], 10) * 1000000 + parseInt(semverMatch[2], 10) * 1000 + parseInt(semverMatch[3], 10)
      };
    }
    
    const numericMatch = versionStr.match(/^0*(\d+)$/);
    if (numericMatch) {
      return {
        type: 'numeric',
        value: versionStr,
        numeric: parseInt(numericMatch[1], 10)
      };
    }
    
    return {
      type: 'string',
      value: versionStr,
      numeric: -1
    };
  }

  static compareVersions(version1, version2) {
    const v1 = this.parseVersion(version1);
    const v2 = this.parseVersion(version2);
    
    if (v1.type === v2.type) {
      if (v1.type === 'semver') {
        if (v1.major !== v2.major) return v1.major - v2.major;
        if (v1.minor !== v2.minor) return v1.minor - v2.minor;
        return v1.patch - v2.patch;
      }
      if (v1.numeric >= 0 && v2.numeric >= 0) {
        return v1.numeric - v2.numeric;
      }
    }
    
    return version1.localeCompare(version2);
  }

  static sortMigrations(migrations, direction = 'asc') {
    const sorted = [...migrations].sort((a, b) => {
      return this.compareVersions(a.version, b.version);
    });
    
    return direction === 'desc' ? sorted.reverse() : sorted;
  }

  static parseSqlContent(content) {
    const statements = [];
    const lines = content.split('\n');
    let currentStatement = '';
    let inMultiLineComment = false;
    let inString = false;
    let stringChar = null;
    
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      let processedLine = '';
      
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        const nextChar = line[j + 1] || '';
        
        if (inString) {
          processedLine += char;
          if (char === stringChar && line[j - 1] !== '\\') {
            inString = false;
            stringChar = null;
          }
          continue;
        }
        
        if (inMultiLineComment) {
          if (char === '*' && nextChar === '/') {
            inMultiLineComment = false;
            j++;
          }
          continue;
        }
        
        if (char === '-' && nextChar === '-') {
          break;
        }
        
        if (char === '/' && nextChar === '*') {
          inMultiLineComment = true;
          j++;
          continue;
        }
        
        if (char === '"' || char === "'") {
          inString = true;
          stringChar = char;
        }
        
        processedLine += char;
      }
      
      if (processedLine.trim()) {
        currentStatement += (currentStatement ? ' ' : '') + processedLine.trim();
        
        if (currentStatement.endsWith(';')) {
          statements.push(currentStatement);
          currentStatement = '';
        }
      }
    }
    
    if (currentStatement.trim()) {
      if (!currentStatement.endsWith(';')) {
        currentStatement += ';';
      }
      statements.push(currentStatement);
    }
    
    return statements;
  }

  static extractUpDownFromFile(content) {
    const upMatch = content.match(/--\s*UP\s*([\s\S]*?)(?=--\s*DOWN|$)/i);
    const downMatch = content.match(/--\s*DOWN\s*([\s\S]*)$/i);
    
    let upSql = '';
    let downSql = '';
    
    if (upMatch) {
      upSql = upMatch[1].trim();
    } else {
      upSql = content.trim();
    }
    
    if (downMatch) {
      downSql = downMatch[1].trim();
    }
    
    return { upSql, downSql };
  }

  static detectOperationType(statement) {
    const upper = statement.toUpperCase().trim();
    
    if (upper.includes('CREATE TABLE')) {
      return { type: 'create_table', destructive: false };
    }
    if (upper.includes('ALTER TABLE')) {
      if (upper.includes('DROP COLUMN') || upper.includes('DROP CONSTRAINT')) {
        return { type: 'alter_table_drop', destructive: true };
      }
      if (upper.includes('ADD COLUMN') || upper.includes('ALTER COLUMN') || upper.includes('MODIFY COLUMN')) {
        if (upper.includes('SET NOT NULL') || upper.includes('NOT NULL') && upper.includes('ADD')) {
          return { type: 'alter_table_add_constraint', destructive: false, risky: true };
        }
        return { type: 'alter_table_add', destructive: false };
      }
      if (upper.includes('RENAME')) {
        return { type: 'alter_table_rename', destructive: true };
      }
      return { type: 'alter_table', destructive: false };
    }
    if (upper.includes('DROP TABLE')) {
      return { type: 'drop_table', destructive: true };
    }
    if (upper.includes('CREATE INDEX')) {
      return { type: 'create_index', destructive: false };
    }
    if (upper.includes('DROP INDEX')) {
      return { type: 'drop_index', destructive: false, risky: true };
    }
    if (upper.includes('INSERT INTO')) {
      return { type: 'insert', destructive: false };
    }
    if (upper.includes('UPDATE')) {
      return { type: 'update', destructive: false, risky: true };
    }
    if (upper.includes('DELETE FROM') || upper.includes('TRUNCATE')) {
      return { type: 'delete', destructive: true };
    }
    if (upper.includes('CREATE VIEW') || upper.includes('CREATE TRIGGER') || upper.includes('CREATE FUNCTION')) {
      return { type: 'create_object', destructive: false };
    }
    if (upper.includes('DROP VIEW') || upper.includes('DROP TRIGGER') || upper.includes('DROP FUNCTION')) {
      return { type: 'drop_object', destructive: false, risky: true };
    }
    
    return { type: 'unknown', destructive: false };
  }

  static analyzeMigration(migration) {
    const upStatements = this.parseSqlContent(migration.up_sql || '');
    const downStatements = this.parseSqlContent(migration.down_sql || '');
    
    const upAnalysis = upStatements.map(stmt => ({
      statement: stmt,
      ...this.detectOperationType(stmt)
    }));
    
    const downAnalysis = downStatements.map(stmt => ({
      statement: stmt,
      ...this.detectOperationType(stmt)
    }));
    
    const hasDestructiveUp = upAnalysis.some(a => a.destructive);
    const hasRiskyUp = upAnalysis.some(a => a.risky);
    const hasDown = downStatements.length > 0;
    
    return {
      migration_id: migration.id,
      version: migration.version,
      name: migration.name,
      up_statements: upAnalysis,
      down_statements: downAnalysis,
      has_destructive_up: hasDestructiveUp,
      has_risky_up: hasRiskyUp,
      has_down: hasDown,
      warnings: []
    };
  }

  static async validateMigrations(projectId) {
    const migrations = await Migration.findByProject(projectId);
    const errors = [];
    const warnings = [];
    
    const versions = new Map();
    for (const migration of migrations) {
      if (versions.has(migration.version)) {
        errors.push({
          type: 'duplicate_version',
          version: migration.version,
          message: `Duplicate version ${migration.version} found`,
          migration_ids: [versions.get(migration.version), migration.id]
        });
      } else {
        versions.set(migration.version, migration.id);
      }
    }
    
    const applied = await Migration.getAppliedMigrations(projectId);
    const appliedVersions = new Set(applied.map(m => m.version));
    
    const allVersions = migrations.map(m => this.parseVersion(m.version));
    const hasSemver = allVersions.some(v => v.type === 'semver');
    const hasTimestamp = allVersions.some(v => v.type === 'timestamp');
    const hasNumeric = allVersions.some(v => v.type === 'numeric');
    
    if ([hasSemver, hasTimestamp, hasNumeric].filter(Boolean).length > 1) {
      warnings.push({
        type: 'mixed_version_format',
        message: 'Migrations use mixed version formats (semver, timestamp, numeric)',
        detail: 'Consider using a consistent version format for predictable ordering'
      });
    }
    
    for (const migration of migrations) {
      const analysis = this.analyzeMigration(migration);
      
      if (!analysis.has_down) {
        warnings.push({
          type: 'missing_down',
          version: migration.version,
          migration_id: migration.id,
          message: `Migration ${migration.version} (${migration.name}) has no down script`,
          detail: 'Rollback will not be possible for this migration'
        });
      }
      
      if (analysis.has_destructive_up) {
        const destructiveOps = analysis.up_statements.filter(s => s.destructive);
        warnings.push({
          type: 'destructive_operations',
          version: migration.version,
          migration_id: migration.id,
          message: `Migration ${migration.version} contains destructive operations`,
          detail: destructiveOps.map(o => o.type).join(', '),
          statements: destructiveOps.map(o => o.statement)
        });
      }
      
      for (const depVersion of migration.dependencies) {
        const depMigration = migrations.find(m => m.version === depVersion);
        if (!depMigration) {
          errors.push({
            type: 'missing_dependency',
            version: migration.version,
            migration_id: migration.id,
            dependency_version: depVersion,
            message: `Migration ${migration.version} depends on non-existent version ${depVersion}`
          });
        } else if (this.compareVersions(depVersion, migration.version) > 0) {
          errors.push({
            type: 'invalid_dependency_order',
            version: migration.version,
            migration_id: migration.id,
            dependency_version: depVersion,
            message: `Migration ${migration.version} depends on higher version ${depVersion}`
          });
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}

module.exports = MigrationParser;
