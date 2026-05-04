const Migration = require('../models/migration');
const MigrationParser = require('./migrationParser');

class PlanGenerator {
  static buildDependencyGraph(migrations, direction = 'up') {
    const graph = new Map();
    const versionToId = new Map();
    const idToVersion = new Map();
    
    for (const migration of migrations) {
      versionToId.set(migration.version, migration.id);
      idToVersion.set(migration.id, migration.version);
    }
    
    for (const migration of migrations) {
      const dependencies = new Set();
      
      for (const depVersion of migration.dependencies) {
        const depId = versionToId.get(depVersion);
        if (depId) {
          dependencies.add(depId);
        }
      }
      
      const sorted = MigrationParser.sortMigrations(migrations);
      const myIndex = sorted.findIndex(m => m.id === migration.id);
      
      for (let i = 0; i < myIndex; i++) {
        const prevMigration = sorted[i];
        if (!dependencies.has(prevMigration.id)) {
          dependencies.add(prevMigration.id);
        }
      }
      
      graph.set(migration.id, {
        id: migration.id,
        version: migration.version,
        name: migration.name,
        dependencies: Array.from(dependencies),
        migration
      });
    }
    
    return { graph, versionToId, idToVersion };
  }

  static topologicalSort(graph, direction = 'up') {
    const inDegree = new Map();
    const adjacencyList = new Map();
    
    for (const [nodeId, node] of graph) {
      inDegree.set(nodeId, 0);
      adjacencyList.set(nodeId, []);
    }
    
    for (const [nodeId, node] of graph) {
      for (const depId of node.dependencies) {
        if (graph.has(depId)) {
          if (direction === 'up') {
            adjacencyList.get(depId).push(nodeId);
            inDegree.set(nodeId, (inDegree.get(nodeId) || 0) + 1);
          } else {
            adjacencyList.get(nodeId).push(depId);
            inDegree.set(depId, (inDegree.get(depId) || 0) + 1);
          }
        }
      }
    }
    
    const queue = [];
    const result = [];
    
    for (const [nodeId, degree] of inDegree) {
      if (degree === 0) {
        queue.push(nodeId);
      }
    }
    
    while (queue.length > 0) {
      const nodeId = queue.shift();
      result.push(nodeId);
      
      for (const neighbor of adjacencyList.get(nodeId)) {
        inDegree.set(neighbor, inDegree.get(neighbor) - 1);
        if (inDegree.get(neighbor) === 0) {
          queue.push(neighbor);
        }
      }
    }
    
    if (result.length !== graph.size) {
      const cycleNodes = [];
      for (const [nodeId, degree] of inDegree) {
        if (degree > 0) {
          cycleNodes.push(graph.get(nodeId).version);
        }
      }
      throw new Error(`Circular dependency detected involving versions: ${cycleNodes.join(', ')}`);
    }
    
    return result.map(id => graph.get(id).migration);
  }

  static async generateApplyPlan(projectId, targetVersion = null) {
    const allMigrations = await Migration.findByProject(projectId);
    const appliedMigrations = await Migration.getAppliedMigrations(projectId);
    
    const appliedIds = new Set(appliedMigrations.map(m => m.id));
    const pendingMigrations = allMigrations.filter(m => !appliedIds.has(m.id));
    
    if (pendingMigrations.length === 0) {
      return {
        action: 'apply',
        target_version: targetVersion,
        current_version: appliedMigrations.length > 0 ? appliedMigrations[appliedMigrations.length - 1].version : null,
        migrations: [],
        total_count: 0
      };
    }
    
    let migrationsToApply = pendingMigrations;
    if (targetVersion) {
      const targetMigration = allMigrations.find(m => m.version === targetVersion);
      if (!targetMigration) {
        throw new Error(`Target version ${targetVersion} not found`);
      }
      
      migrationsToApply = pendingMigrations.filter(m => 
        MigrationParser.compareVersions(m.version, targetVersion) <= 0
      );
    }
    
    const { graph } = this.buildDependencyGraph(migrationsToApply, 'up');
    const orderedMigrations = this.topologicalSort(graph, 'up');
    
    const finalOrder = MigrationParser.sortMigrations(orderedMigrations);
    
    return {
      action: 'apply',
      target_version: targetVersion,
      current_version: appliedMigrations.length > 0 ? appliedMigrations[appliedMigrations.length - 1].version : null,
      migrations: finalOrder.map(m => ({
        id: m.id,
        version: m.version,
        name: m.name,
        description: m.description,
        up_sql: m.up_sql,
        dependencies: m.dependencies
      })),
      total_count: finalOrder.length
    };
  }

  static async generateRollbackPlan(projectId, targetVersion = null, steps = null) {
    const appliedMigrations = await Migration.getAppliedMigrations(projectId);
    
    if (appliedMigrations.length === 0) {
      return {
        action: 'rollback',
        target_version: targetVersion,
        steps: steps,
        current_version: null,
        migrations: [],
        total_count: 0
      };
    }
    
    const reverseApplied = MigrationParser.sortMigrations(appliedMigrations, 'desc');
    
    let migrationsToRollback = [];
    
    if (targetVersion) {
      const targetMigration = appliedMigrations.find(m => m.version === targetVersion);
      if (!targetMigration) {
        throw new Error(`Target version ${targetVersion} is not applied`);
      }
      
      const targetIndex = reverseApplied.findIndex(m => m.version === targetVersion);
      migrationsToRollback = reverseApplied.slice(0, targetIndex);
    } else if (steps !== null && steps > 0) {
      migrationsToRollback = reverseApplied.slice(0, Math.min(steps, reverseApplied.length));
    } else {
      migrationsToRollback = reverseApplied;
    }
    
    const migrationsWithoutDown = migrationsToRollback.filter(m => !m.down_sql || m.down_sql.trim() === '');
    if (migrationsWithoutDown.length > 0) {
      const versions = migrationsWithoutDown.map(m => m.version).join(', ');
      throw new Error(`Cannot rollback: migrations ${versions} have no down scripts`);
    }
    
    const currentVersion = appliedMigrations.length > 0 ? appliedMigrations[appliedMigrations.length - 1].version : null;
    const newVersion = migrationsToRollback.length > 0 
      ? reverseApplied[migrationsToRollback.length]?.version || null
      : currentVersion;
    
    return {
      action: 'rollback',
      target_version: targetVersion,
      steps: steps,
      current_version: currentVersion,
      new_version: newVersion,
      migrations: migrationsToRollback.map(m => ({
        id: m.id,
        version: m.version,
        name: m.name,
        description: m.description,
        down_sql: m.down_sql,
        applied_at: m.applied_at
      })),
      total_count: migrationsToRollback.length
    };
  }

  static async validatePlan(plan) {
    const issues = [];
    
    for (const migration of plan.migrations) {
      if (plan.action === 'apply') {
        const analysis = MigrationParser.analyzeMigration({
          up_sql: migration.up_sql,
          down_sql: '',
          version: migration.version,
          name: migration.name,
          id: migration.id
        });
        
        if (analysis.has_destructive_up) {
          issues.push({
            severity: 'warning',
            type: 'destructive_operation',
            version: migration.version,
            message: `Migration ${migration.version} contains destructive operations`,
            detail: 'These operations may cause data loss. Review carefully before applying.'
          });
        }
      }
      
      if (plan.action === 'rollback') {
        if (!migration.down_sql) {
          issues.push({
            severity: 'error',
            type: 'missing_down',
            version: migration.version,
            message: `Migration ${migration.version} has no down script`,
            detail: 'Cannot rollback this migration.'
          });
        }
      }
    }
    
    return {
      valid: !issues.some(i => i.severity === 'error'),
      issues
    };
  }

  static async generateMigrationReport(projectId) {
    const allMigrations = await Migration.findByProject(projectId);
    const appliedMigrations = await Migration.getAppliedMigrations(projectId);
    const pendingMigrations = await Migration.getPendingMigrations(projectId);
    
    const appliedIds = new Set(appliedMigrations.map(m => m.id));
    
    const migrationStatuses = allMigrations.map(m => ({
      id: m.id,
      version: m.version,
      name: m.name,
      status: appliedIds.has(m.id) ? 'applied' : 'pending',
      has_down: m.down_sql && m.down_sql.trim() !== '',
      dependencies: m.dependencies,
      description: m.description,
      applied_at: appliedMigrations.find(am => am.id === m.id)?.applied_at
    }));
    
    const issues = [];
    
    for (const migration of allMigrations) {
      const analysis = MigrationParser.analyzeMigration(migration);
      
      if (!analysis.has_down) {
        issues.push({
          type: 'missing_down',
          severity: 'medium',
          version: migration.version,
          message: `Migration ${migration.version} has no down script`
        });
      }
      
      if (analysis.has_destructive_up) {
        issues.push({
          type: 'destructive_operations',
          severity: 'high',
          version: migration.version,
          message: `Migration ${migration.version} contains destructive operations`
        });
      }
    }
    
    const versions = allMigrations.map(m => m.version);
    const sortedVersions = MigrationParser.sortMigrations(allMigrations).map(m => m.version);
    
    const currentVersion = appliedMigrations.length > 0 
      ? appliedMigrations[appliedMigrations.length - 1].version 
      : null;
    
    return {
      project_id: projectId,
      summary: {
        total: allMigrations.length,
        applied: appliedMigrations.length,
        pending: pendingMigrations.length,
        current_version: currentVersion,
        issues: issues.length
      },
      migrations: migrationStatuses,
      issues,
      version_order: sortedVersions
    };
  }
}

module.exports = PlanGenerator;
