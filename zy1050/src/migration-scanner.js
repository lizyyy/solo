import fs from 'fs';
import path from 'path';
import logger from './utils/logger.js';

export class MigrationScanner {
  constructor(migrationsDir, options = {}) {
    this.migrationsDir = migrationsDir;
    this.migrationPattern = options.migrationPattern || /^(\d+)_.*\.sql$/;
    this.rollbackPattern = options.rollbackPattern || /^(\d+)_.*_rollback\.sql$/;
    this.verbose = options.verbose || false;
  }

  scan() {
    logger.debug(`扫描迁移目录: ${this.migrationsDir}`);

    if (!fs.existsSync(this.migrationsDir)) {
      throw new Error(`迁移目录不存在: ${this.migrationsDir}`);
    }

    const files = fs.readdirSync(this.migrationsDir);
    const migrations = [];
    const rollbacks = [];

    for (const file of files) {
      const fullPath = path.join(this.migrationsDir, file);
      const stat = fs.statSync(fullPath);

      if (!stat.isFile()) continue;

      const rollbackMatch = file.match(this.rollbackPattern);
      if (rollbackMatch) {
        const version = parseInt(rollbackMatch[1], 10);
        const content = fs.readFileSync(fullPath, 'utf-8');
        
        rollbacks.push({
          version,
          name: file,
          path: fullPath,
          content,
          type: 'rollback'
        });
        continue;
      }

      const migrationMatch = file.match(this.migrationPattern);
      if (migrationMatch) {
        const version = parseInt(migrationMatch[1], 10);
        const content = fs.readFileSync(fullPath, 'utf-8');
        
        migrations.push({
          version,
          name: file,
          path: fullPath,
          content,
          type: 'migration'
        });
      }
    }

    return this.processMigrations(migrations, rollbacks);
  }

  processMigrations(migrations, rollbacks) {
    const sortedMigrations = migrations.sort((a, b) => a.version - b.version);
    const rollbackMap = new Map(rollbacks.map(r => [r.version, r]));

    const issues = [];
    const versions = sortedMigrations.map(m => m.version);

    const gaps = this.findGaps(versions);
    if (gaps.length > 0) {
      issues.push({
        type: 'gap',
        severity: 'warning',
        message: `检测到迁移版本号跳号: ${gaps.map(g => `v${g.start}-v${g.end}`).join(', ')}`,
        details: gaps
      });
    }

    const duplicates = this.findDuplicates(versions);
    if (duplicates.length > 0) {
      issues.push({
        type: 'duplicate',
        severity: 'error',
        message: `检测到重复的迁移版本号: ${duplicates.join(', ')}`,
        details: duplicates
      });
    }

    const migrationsWithoutRollback = sortedMigrations
      .filter(m => !rollbackMap.has(m.version))
      .map(m => m.version);

    if (migrationsWithoutRollback.length > 0) {
      issues.push({
        type: 'missing_rollback',
        severity: 'warning',
        message: `以下迁移缺少回滚脚本: v${migrationsWithoutRollback.join(', v')}`,
        details: migrationsWithoutRollback
      });
    }

    const processedMigrations = sortedMigrations.map(migration => ({
      ...migration,
      hasRollback: rollbackMap.has(migration.version),
      rollback: rollbackMap.get(migration.version)
    }));

    return {
      migrations: processedMigrations,
      count: processedMigrations.length,
      rollbackCount: rollbacks.length,
      issues,
      versions: processedMigrations.map(m => m.version)
    };
  }

  findGaps(versions) {
    if (versions.length === 0) return [];

    const gaps = [];
    let expected = versions[0];

    for (const version of versions) {
      if (version > expected) {
        gaps.push({
          start: expected,
          end: version - 1
        });
      }
      expected = version + 1;
    }

    return gaps;
  }

  findDuplicates(versions) {
    const seen = new Set();
    const duplicates = [];

    for (const version of versions) {
      if (seen.has(version)) {
        if (!duplicates.includes(version)) {
          duplicates.push(version);
        }
      } else {
        seen.add(version);
      }
    }

    return duplicates;
  }
}

export default MigrationScanner;
