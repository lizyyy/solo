import { BaseAnalyzer } from './base-analyzer';
import { DBProfile, SQLTraceEntry, RoutingMetrics } from '../types';

export class RoutingAnalyzer extends BaseAnalyzer {
  private dbProfile: DBProfile;
  private traceEntries: SQLTraceEntry[];

  constructor(dbProfile: DBProfile, traceEntries: SQLTraceEntry[]) {
    super();
    this.dbProfile = dbProfile;
    this.traceEntries = traceEntries;
  }

  analyze(): RoutingMetrics {
    const readQueries = this.traceEntries.filter(e => e.isRead);
    const writeQueries = this.traceEntries.filter(e => !e.isRead);

    const misroutedReads = this.identifyMisroutedReads(readQueries);
    const misroutedWrites = this.identifyMisroutedWrites(writeQueries);
    const replicaUtilization = this.analyzeReplicaUtilization();

    if (!this.dbProfile.readWriteSeparation.enabled && readQueries.length > 0) {
      this.addIssue(
        'routing',
        'warning',
        '未启用读写分离',
        `存在 ${readQueries.length} 个读查询，但读写分离未启用，无法利用从库读取`,
        [],
        '建议启用读写分离以提升查询性能'
      );
      this.addSuggestion(
        '启用读写分离',
        '启用读写分离可以将读流量分发到从库，减轻主库压力',
        'high',
        `修改 db-profile.yaml 中 readWriteSeparation.enabled 为 true`
      );
    }

    if (misroutedReads.length > 0) {
      const misroutedRatio = misroutedReads.length / readQueries.length;
      this.addIssue(
        'routing',
        'warning',
        '存在读请求路由误判',
        `发现 ${misroutedReads.length} 个读请求可能被错误路由到主库`,
        misroutedReads.slice(0, 5).map(q => q.sql.substring(0, 50) + '...'),
        `误判比例: ${(misroutedRatio * 100).toFixed(1)}%`
      );
    }

    if (misroutedWrites.length > 0) {
      this.addIssue(
        'routing',
        'blocker',
        '存在写请求路由误判',
        `发现 ${misroutedWrites.length} 个写请求可能被错误路由到从库，这会导致数据不一致`,
        misroutedWrites.slice(0, 5).map(q => q.sql.substring(0, 50) + '...'),
        '写请求必须路由到主库'
      );
      this.addSuggestion(
        '检查路由逻辑',
        '写请求必须路由到主库，从库通常是只读的',
        'high',
        '检查路由规则，确保 INSERT/UPDATE/DELETE 等写操作只发送到主库'
      );
    }

    if (this.dbProfile.readWriteSeparation.enabled) {
      const replicaCount = this.dbProfile.readWriteSeparation.readReplicas;
      const readsToMaster = readQueries.filter(this.isProbablyMasterRead.bind(this)).length;
      const masterReadRatio = readsToMaster / readQueries.length;

      if (masterReadRatio > 0.5 && replicaCount > 0) {
        this.addIssue(
          'routing',
          'info',
          '主库读比例较高',
          `主库处理了 ${(masterReadRatio * 100).toFixed(1)}% 的读请求，考虑将更多读流量分发到从库`,
          [],
          `从库数量: ${replicaCount}`
        );
      }

      const strategy = this.dbProfile.readWriteSeparation.routingStrategy;
      if (strategy === 'round-robin' && replicaUtilization.size > 1) {
        const utilizations = [...replicaUtilization.values()];
        const maxUtil = Math.max(...utilizations);
        const minUtil = Math.min(...utilizations);
        const imbalance = maxUtil - minUtil;

        if (imbalance > maxUtil * 0.2) {
          this.addIssue(
            'routing',
            'info',
            '轮询策略可能导致负载不均',
            `轮询策略下从库负载差异超过 20%`,
            [],
            `最大负载: ${maxUtil}, 最小负载: ${minUtil}`
          );
        }
      }
    }

    return {
      readCount: readQueries.length,
      writeCount: writeQueries.length,
      misroutedReads: misroutedReads.length,
      misroutedWrites: misroutedWrites.length,
      replicaUtilization
    };
  }

  private identifyMisroutedReads(readQueries: SQLTraceEntry[]): SQLTraceEntry[] {
    const misrouted: SQLTraceEntry[] = [];
    
    for (const query of readQueries) {
      const sqlUpper = query.sql.toUpperCase();
      
      if (sqlUpper.includes('SELECT') && 
          (sqlUpper.includes('FOR UPDATE') || 
           sqlUpper.includes('LOCK IN SHARE MODE'))) {
        misrouted.push(query);
      }
    }

    return misrouted;
  }

  private identifyMisroutedWrites(writeQueries: SQLTraceEntry[]): SQLTraceEntry[] {
    const misrouted: SQLTraceEntry[] = [];
    
    for (const query of writeQueries) {
      const sqlUpper = query.sql.toUpperCase();
      
      if (sqlUpper.includes('INSERT') || 
          sqlUpper.includes('UPDATE') || 
          sqlUpper.includes('DELETE') ||
          sqlUpper.includes('TRUNCATE') ||
          sqlUpper.includes('DROP') ||
          sqlUpper.includes('ALTER')) {
        continue;
      }
      
      if (query.isRead === false) {
        misrouted.push(query);
      }
    }

    return misrouted;
  }

  private analyzeReplicaUtilization(): Record<string, number> {
    const utilization: Record<string, number> = {};
    
    for (const entry of this.traceEntries) {
      const connectionKey = entry.connectionId || 'unknown';
      utilization[connectionKey] = (utilization[connectionKey] || 0) + 1;
    }

    return utilization;
  }

  private isProbablyMasterRead(query: SQLTraceEntry): boolean {
    const sqlUpper = query.sql.toUpperCase();
    return sqlUpper.includes('FOR UPDATE') ||
           sqlUpper.includes('LOCK IN SHARE MODE') ||
           sqlUpper.includes('SELECT LAST_INSERT_ID') ||
           (query.shardId !== undefined && query.shardId === 0);
  }
}
