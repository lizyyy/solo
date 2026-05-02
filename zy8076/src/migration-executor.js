const fs = require('fs');
const path = require('path');

class MigrationExecutor {
  constructor(migrationDir) {
    this.migrationDir = migrationDir;
    this.migrations = {};
    this.loadMigrations();
  }

  loadMigrations() {
    if (!fs.existsSync(this.migrationDir)) {
      throw new Error(`Migration directory not found: ${this.migrationDir}`);
    }

    const files = fs.readdirSync(this.migrationDir)
      .filter(f => f.endsWith('.js'))
      .sort();

    for (const file of files) {
      const filePath = path.join(this.migrationDir, file);
      const migration = require(filePath);
      const match = file.match(/^(\d+)_/);
      if (!match) {
        throw new Error(`Migration file must be named with version prefix: ${file}`);
      }
      const version = parseInt(match[1], 10);
      this.migrations[version] = migration;
    }
  }

  getMigrationVersions() {
    return Object.keys(this.migrations).map(Number).sort((a, b) => a - b);
  }

  buildVersionChain(fromVersion, toVersion) {
    const chain = [];
    const availableVersions = this.getMigrationVersions();

    for (let v = fromVersion; v < toVersion; v++) {
      const nextVersion = v + 1;
      if (this.migrations[nextVersion]) {
        chain.push(nextVersion);
      }
    }

    return chain;
  }

  async executeMigration(version, data, context = {}) {
    const migration = this.migrations[version];
    if (!migration) {
      throw new Error(`Migration for version ${version} not found`);
    }

    const snapshot = JSON.parse(JSON.stringify(data));

    try {
      const result = await migration.up(data, context);

      return {
        success: true,
        version,
        before: snapshot,
        after: result || data,
        error: null
      };
    } catch (error) {
      const rollbackData = await this.safeRollback(snapshot, version, context);

      return {
        success: false,
        version,
        before: snapshot,
        after: rollbackData,
        error: error.message,
        rollbackTriggered: true
      };
    }
  }

  async safeRollback(data, version, context) {
    const migration = this.migrations[version];
    if (!migration || !migration.down) {
      return data;
    }

    try {
      return await migration.down(data, context);
    } catch (error) {
      return data;
    }
  }

  async executeChain(snapshots, fromVersion, toVersion, context = {}) {
    const results = [];
    const chain = this.buildVersionChain(fromVersion, toVersion);

    let currentData = null;
    let startSnapshot = null;

    if (snapshots[fromVersion]) {
      startSnapshot = snapshots[fromVersion];
      currentData = JSON.parse(JSON.stringify(startSnapshot.data));
    } else {
      const nearestLower = Math.max(...Object.keys(snapshots).map(Number).filter(v => v <= fromVersion));
      if (nearestLower && snapshots[nearestLower]) {
        startSnapshot = snapshots[nearestLower];
        currentData = JSON.parse(JSON.stringify(startSnapshot.data));
      }
    }

    if (currentData === null) {
      throw new Error(`No starting snapshot found for version ${fromVersion}`);
    }

    const skippedVersions = [];
    for (let v = fromVersion + 1; v < toVersion; v++) {
      if (!this.migrations[v]) {
        skippedVersions.push(v);
      }
    }

    for (const version of chain) {
      const result = await this.executeMigration(version, currentData, context);

      results.push({
        ...result,
        skippedVersions: skippedVersions.filter(v => v < version)
      });

      if (!result.success) {
        return {
          completed: false,
          failedAtVersion: version,
          results,
          finalData: result.after,
          error: result.error
        };
      }

      currentData = result.after;
    }

    return {
      completed: true,
      fromVersion,
      toVersion,
      results,
      finalData: currentData,
      skippedVersions
    };
  }
}

module.exports = MigrationExecutor;
