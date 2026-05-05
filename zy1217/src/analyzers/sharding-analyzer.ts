import { BaseAnalyzer } from './base-analyzer';
import { ShardingPlan, SQLTraceEntry, WriteBatch, ShardingMetrics, ShardHotspot } from '../types';

export class ShardingAnalyzer extends BaseAnalyzer {
  private shardingPlan: ShardingPlan;
  private traceEntries: SQLTraceEntry[];
  private writeBatches: WriteBatch[];

  constructor(shardingPlan: ShardingPlan, traceEntries: SQLTraceEntry[], writeBatches: WriteBatch[]) {
    super();
    this.shardingPlan = shardingPlan;
    this.traceEntries = traceEntries;
    this.writeBatches = writeBatches;
  }

  analyze(): ShardingMetrics {
    const shardDistribution = this.analyzeShardDistribution();
    const hotspots = this.identifyHotspots(shardDistribution);
    const avgRowsPerShard = this.calculateAvgRowsPerShard(shardDistribution);
    const imbalanceRatio = this.calculateImbalanceRatio(shardDistribution);

    const totalRows = Object.values(shardDistribution).reduce((a, b) => a + b, 0);
    const hotspotThreshold = totalRows > 0 ? totalRows * 0.2 : 100;

    for (const hotspot of hotspots) {
      if (hotspot.rowCount > hotspotThreshold) {
        this.addIssue(
          'sharding',
          'blocker',
          '存在严重的分库分表热点',
          `分片 ${hotspot.shardId} 中的表 ${hotspot.table} 存在数据热点，分片键值 ${hotspot.shardKeyValue} 占比达到 ${hotspot.percentage.toFixed(1)}%`,
          [`分片 ${hotspot.shardId}: ${hotspot.table}.${hotspot.shardKeyValue}`],
          `数据量: ${hotspot.rowCount} 行`
        );
      } else {
        this.addIssue(
          'sharding',
          'warning',
          '存在潜在分表热点',
          `分片 ${hotspot.shardId} 中的表 ${hotspot.table} 存在潜在数据热点`,
          [],
          `数据量: ${hotspot.rowCount} 行, 占比: ${hotspot.percentage.toFixed(1)}%`
        );
      }
    }

    if (imbalanceRatio > 0.5) {
      this.addIssue(
        'sharding',
        'blocker',
        '分片数据分布严重不均衡',
        `分片数据不均衡比例达到 ${(imbalanceRatio * 100).toFixed(1)}%，可能导致系统瓶颈`,
        Object.entries(shardDistribution).map(([id, count]) => `分片 ${id}: ${count} 行`),
        `建议数据重新分片`
      );
      this.addSuggestion(
        '数据重新分片',
        '当前分片数据分布严重不均衡，建议进行数据迁移或重新分片',
        'high',
        '1. 分析热点数据分布\n2. 考虑修改分片键\n3. 实施数据迁移计划\n4. 增加分片数量'
      );
    } else if (imbalanceRatio > 0.2) {
      this.addIssue(
        'sharding',
        'warning',
        '分片数据分布不均衡',
        `分片数据不均衡比例为 ${(imbalanceRatio * 100).toFixed(1)}%`,
        [],
        ''
      );
    }

    const totalShards = this.shardingPlan.shards.length;
    const usedShards = Object.keys(shardDistribution).length;
    
    if (usedShards < totalShards) {
      const unusedShards = totalShards - usedShards;
      this.addIssue(
        'sharding',
        'info',
        '存在未使用的分片',
        `发现 ${unusedShards} 个分片未被使用，资源可能被浪费`,
        [],
        `总分片数: ${totalShards}, 已使用: ${usedShards}`
      );
    }

    for (const tableConfig of this.shardingPlan.tables) {
      const relevantTraces = this.traceEntries.filter(e => 
        e.sql.toLowerCase().includes(tableConfig.table.toLowerCase())
      );
      
      const missingShardKey = relevantTraces.filter(e => !e.shardKey);
      if (missingShardKey.length > 0) {
        this.addIssue(
          'sharding',
          'warning',
          `表 ${tableConfig.table} 存在未指定分片键的查询`,
          `发现 ${missingShardKey.length} 个查询未指定分片键，可能导致跨分片查询`,
          missingShardKey.slice(0, 3).map(q => q.sql.substring(0, 50) + '...'),
          '未指定分片键的查询可能需要广播到所有分片执行'
        );
      }
    }

    const crossShardQueries = this.identifyCrossShardQueries();
    if (crossShardQueries.length > 0) {
      this.addIssue(
        'sharding',
        'warning',
        '存在跨分片查询',
        `发现 ${crossShardQueries.length} 个可能的跨分片查询，性能较差`,
        crossShardQueries.slice(0, 5).map(q => q.substring(0, 60) + '...'),
        '跨分片查询需要在多个分片执行后合并结果'
      );
    }

    return {
      shardDistribution,
      hotspots,
      avgRowsPerShard,
      imbalanceRatio
    };
  }

  private analyzeShardDistribution(): Record<number, number> {
    const distribution: Record<number, number> = {};

    for (const entry of this.traceEntries) {
      if (entry.shardId !== undefined) {
        distribution[entry.shardId] = (distribution[entry.shardId] || 0) + 1;
      }
    }

    for (const batch of this.writeBatches) {
      if (batch.shardId !== undefined) {
        distribution[batch.shardId] = (distribution[batch.shardId] || 0) + batch.rowCount;
      }
    }

    for (const shard of this.shardingPlan.shards) {
      if (distribution[shard.id] === undefined) {
        distribution[shard.id] = 0;
      }
    }

    return distribution;
  }

  private identifyHotspots(distribution: Record<number, number>): ShardHotspot[] {
    const hotspots: ShardHotspot[] = [];
    const totalRows = Object.values(distribution).reduce((a, b) => a + b, 0);

    const shardKeyCounts: Map<string, Map<string, number>> = new Map();

    for (const entry of this.traceEntries) {
      if (entry.shardKey && entry.shardId !== undefined) {
        const key = `${entry.shardId}:${entry.shardKey}`;
        if (!shardKeyCounts.has(key)) {
          shardKeyCounts.set(key, new Map());
        }
        const tableMap = shardKeyCounts.get(key)!;
        tableMap.set(entry.shardKey, (tableMap.get(entry.shardKey) || 0) + 1);
      }
    }

    for (const batch of this.writeBatches) {
      if (batch.shardKey && batch.shardId !== undefined) {
        const key = `${batch.shardId}:${batch.shardKey}`;
        if (!shardKeyCounts.has(key)) {
          shardKeyCounts.set(key, new Map());
        }
        const tableMap = shardKeyCounts.get(key)!;
        tableMap.set(batch.table, (tableMap.get(batch.table) || 0) + batch.rowCount);
      }
    }

    for (const [key, tableMap] of shardKeyCounts) {
      const [shardIdStr, shardKey] = key.split(':');
      const shardId = parseInt(shardIdStr);
      
      for (const [table, count] of tableMap) {
        const percentage = totalRows > 0 ? (count / totalRows) * 100 : 0;
        
        if (percentage > 10 || count > 1000) {
          hotspots.push({
            shardId,
            table,
            shardKeyValue: shardKey,
            rowCount: count,
            percentage
          });
        }
      }
    }

    hotspots.sort((a, b) => b.rowCount - a.rowCount);
    return hotspots.slice(0, 10);
  }

  private calculateAvgRowsPerShard(distribution: Record<number, number>): number {
    const totalRows = Object.values(distribution).reduce((a, b) => a + b, 0);
    const shardCount = Object.keys(distribution).length;
    return shardCount > 0 ? totalRows / shardCount : 0;
  }

  private calculateImbalanceRatio(distribution: Record<number, number>): number {
    const values = Object.values(distribution);
    if (values.length <= 1) return 0;

    const max = Math.max(...values);
    const min = Math.min(...values);
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;

    if (avg === 0) return 0;

    const variance = values.reduce((a, v) => a + Math.pow(v - avg, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    return stdDev / avg;
  }

  private identifyCrossShardQueries(): string[] {
    const crossShardPatterns: string[] = [];

    for (const entry of this.traceEntries) {
      const sqlLower = entry.sql.toLowerCase();
      
      if (sqlLower.includes('join') && !entry.shardKey) {
        crossShardPatterns.push(entry.sql);
      }
      
      if (sqlLower.includes('order by') && !entry.shardKey) {
        crossShardPatterns.push(entry.sql);
      }
      
      if (sqlLower.includes('group by') && !entry.shardKey) {
        crossShardPatterns.push(entry.sql);
      }
    }

    return [...new Set(crossShardPatterns)];
  }
}
