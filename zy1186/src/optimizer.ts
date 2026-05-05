import { 
  BenchmarkResult, 
  OptimizationRecommendation, 
  IndexRecommendation,
  OptimizationReport,
  WriteConfig,
  TableSchema
} from './types';

export class Optimizer {
  private results: BenchmarkResult[];
  private config: WriteConfig;
  private tables: TableSchema[];
  private recordCount: number;

  constructor(
    results: BenchmarkResult[],
    config: WriteConfig,
    tables: TableSchema[],
    recordCount: number
  ) {
    this.results = results;
    this.config = config;
    this.tables = tables;
    this.recordCount = recordCount;
  }

  generateReport(): OptimizationReport {
    const sortedResults = [...this.results].sort(
      (a, b) => a.metrics.totalTimeMs - b.metrics.totalTimeMs
    );

    const bestResult = sortedResults[0];
    const worstResult = sortedResults[sortedResults.length - 1];
    const improvementRatio = worstResult.metrics.totalTimeMs / bestResult.metrics.totalTimeMs;

    const recommendations = this.generateRecommendations(sortedResults);
    const indexRecommendations = this.generateIndexRecommendations(sortedResults);
    const suggestedBatchSize = this.findSuggestedBatchSize(sortedResults);
    const suggestedJournalMode = this.findSuggestedJournalMode(sortedResults);

    return {
      summary: {
        totalRecords: this.recordCount,
        totalTests: this.results.length,
        bestStrategy: bestResult.strategy,
        bestPerformance: bestResult.metrics.recordsPerSecond,
        worstStrategy: worstResult.strategy,
        worstPerformance: worstResult.metrics.recordsPerSecond,
        improvementRatio,
      },
      benchmarkResults: sortedResults,
      recommendations,
      indexRecommendations,
      suggestedBatchSize,
      suggestedJournalMode,
      metadata: {
        generatedAt: new Date().toISOString(),
        version: '1.0.0',
        config: this.config,
      },
    };
  }

  private generateRecommendations(sortedResults: BenchmarkResult[]): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];

    const transactionResults = sortedResults.filter(r => r.strategyType === 'transaction');
    if (transactionResults.length >= 2) {
      const batchResult = transactionResults.find(r => r.config.transactionMode === 'batch');
      const singleResult = transactionResults.find(r => r.config.transactionMode === 'single');
      
      if (batchResult && singleResult) {
        const improvement = singleResult.metrics.totalTimeMs / batchResult.metrics.totalTimeMs;
        if (improvement > 2) {
          recommendations.push({
            priority: 'critical',
            category: '事务',
            title: '使用批量事务替代逐条提交',
            description: `批量事务比逐条提交快 ${improvement.toFixed(1)} 倍`,
            expectedImprovement: `预计提升 ${((improvement - 1) * 100).toFixed(0)}% 的写入速度`,
            action: '将多次写入操作合并到单个事务中执行',
            reason: `逐条提交时，SQLite 每次都需要等待磁盘同步。批量事务可以将多次磁盘同步合并为一次，大幅减少 IO 开销。测试数据显示：逐条提交耗时 ${singleResult.metrics.totalTimeMs.toFixed(2)}ms，批量事务仅需 ${batchResult.metrics.totalTimeMs.toFixed(2)}ms。`,
          });
        }
      }
    }

    const journalResults = sortedResults.filter(r => r.strategyType === 'journal');
    if (journalResults.length >= 2) {
      const walResult = journalResults.find(r => r.config.journalMode === 'WAL');
      const deleteResult = journalResults.find(r => r.config.journalMode === 'DELETE');
      
      if (walResult && deleteResult) {
        const improvement = deleteResult.metrics.totalTimeMs / walResult.metrics.totalTimeMs;
        if (improvement > 1.5) {
          recommendations.push({
            priority: 'critical',
            category: 'Journal 模式',
            title: '使用 WAL 模式替代 DELETE 模式',
            description: `WAL 模式比 DELETE 模式快 ${improvement.toFixed(1)} 倍`,
            expectedImprovement: `预计提升 ${((improvement - 1) * 100).toFixed(0)}% 的写入速度`,
            action: '执行 PRAGMA journal_mode = WAL;',
            reason: `WAL (Write-Ahead Logging) 模式是 SQLite 推荐的高并发写入模式。它将修改写入到 WAL 文件而非直接覆盖主数据库文件，减少了磁盘随机写入。测试数据显示：DELETE 模式耗时 ${deleteResult.metrics.totalTimeMs.toFixed(2)}ms，WAL 模式仅需 ${walResult.metrics.totalTimeMs.toFixed(2)}ms。`,
          });
        }
      }
    }

    const connectionResults = sortedResults.filter(r => r.strategyType === 'connection');
    if (connectionResults.length >= 2) {
      const reuseResult = connectionResults.find(r => r.config.connectionMode === 'reuse');
      const reopenResult = connectionResults.find(r => r.config.connectionMode === 'reopen');
      
      if (reuseResult && reopenResult) {
        const improvement = reopenResult.metrics.totalTimeMs / reuseResult.metrics.totalTimeMs;
        if (improvement > 1.2) {
          recommendations.push({
            priority: 'high',
            category: '连接管理',
            title: '保持数据库连接复用',
            description: `连接复用比反复重连快 ${improvement.toFixed(1)} 倍`,
            expectedImprovement: `预计提升 ${((improvement - 1) * 100).toFixed(0)}% 的写入速度`,
            action: '在应用启动时创建数据库连接并在程序生命周期内保持',
            reason: `每次打开数据库连接都需要读取数据库文件头、初始化页缓存、锁定文件等开销。批量写入时应保持连接复用。测试数据显示：反复重连耗时 ${reopenResult.metrics.totalTimeMs.toFixed(2)}ms，连接复用仅需 ${reuseResult.metrics.totalTimeMs.toFixed(2)}ms。`,
          });
        }
      }
    }

    const statementResults = sortedResults.filter(r => r.strategyType === 'statement');
    if (statementResults.length >= 2) {
      const preparedResult = statementResults.find(r => r.config.statementMode === 'prepared');
      const directResult = statementResults.find(r => r.config.statementMode === 'direct');
      
      if (preparedResult && directResult) {
        const improvement = directResult.metrics.totalTimeMs / preparedResult.metrics.totalTimeMs;
        if (improvement > 1.1) {
          recommendations.push({
            priority: 'medium',
            category: '语句执行',
            title: '使用预编译语句',
            description: `预编译语句比普通 SQL 快 ${improvement.toFixed(1)} 倍`,
            expectedImprovement: `预计提升 ${((improvement - 1) * 100).toFixed(0)}% 的写入速度`,
            action: '对重复执行的 SQL 语句使用预编译',
            reason: `相同结构的 SQL 语句只需要编译一次，后续执行只需绑定参数。对于批量写入场景，这可以节省大量的 SQL 解析和编译时间。测试数据显示：普通 SQL 耗时 ${directResult.metrics.totalTimeMs.toFixed(2)}ms，预编译语句仅需 ${preparedResult.metrics.totalTimeMs.toFixed(2)}ms。`,
          });
        }
      }
    }

    const batchResults = sortedResults.filter(r => r.strategyType === 'batch');
    if (batchResults.length >= 2) {
      const bestBatch = batchResults.reduce((best, current) => 
        current.metrics.totalTimeMs < best.metrics.totalTimeMs ? current : best
      );
      const worstBatch = batchResults.reduce((worst, current) => 
        current.metrics.totalTimeMs > worst.metrics.totalTimeMs ? current : worst
      );
      
      const improvement = worstBatch.metrics.totalTimeMs / bestBatch.metrics.totalTimeMs;
      if (improvement > 1.2) {
        recommendations.push({
          priority: 'high',
          category: '批量大小',
          title: `使用推荐的批量大小: ${bestBatch.config.batchSize}`,
          description: `最佳批量大小 ${bestBatch.config.batchSize} 比最差的 ${worstBatch.config.batchSize} 快 ${improvement.toFixed(1)} 倍`,
          expectedImprovement: `预计提升 ${((improvement - 1) * 100).toFixed(0)}% 的写入速度`,
          action: `将每批次写入记录数设置为 ${bestBatch.config.batchSize}`,
          reason: `批量过小会导致事务开销过大，批量过大可能导致锁竞争和内存压力。根据测试，${bestBatch.config.batchSize} 是当前数据量下的最优值。测试数据显示：批量 ${worstBatch.config.batchSize} 耗时 ${worstBatch.metrics.totalTimeMs.toFixed(2)}ms，批量 ${bestBatch.config.batchSize} 仅需 ${bestBatch.metrics.totalTimeMs.toFixed(2)}ms。`,
        });
      }
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  private generateIndexRecommendations(sortedResults: BenchmarkResult[]): IndexRecommendation[] {
    const recommendations: IndexRecommendation[] = [];
    const indexResults = sortedResults.filter(r => r.strategyType === 'index');

    if (indexResults.length >= 2) {
      const noneResult = indexResults.find(r => r.config.indexMode === 'none');
      const normalResult = indexResults.find(r => r.config.indexMode === 'normal');
      const extraResult = indexResults.find(r => r.config.indexMode === 'extra');

      if (noneResult && normalResult) {
        const writeSlowdown = noneResult.metrics.totalTimeMs / normalResult.metrics.totalTimeMs;
        
        if (writeSlowdown > 1.5) {
          recommendations.push({
            action: 'KEEP',
            indexName: '现有索引',
            table: '多表',
            columns: [],
            reason: `索引使写入速度降低了 ${((writeSlowdown - 1) * 100).toFixed(0)}%，但查询性能提升可能更重要`,
            impact: '写入性能有一定影响，但查询性能得到保障',
          });
        }

        for (const table of this.tables) {
          for (const index of table.indexes) {
            if (!index.isPrimary) {
              if (writeSlowdown > 2) {
                recommendations.push({
                  action: 'DROP',
                  indexName: index.name,
                  table: table.name,
                  columns: index.columns,
                  reason: `该索引导致写入性能显著下降 ${((writeSlowdown - 1) * 100).toFixed(0)}%，如果查询频率低建议删除`,
                  impact: `写入性能预计提升 ${((writeSlowdown - 1) * 100).toFixed(0)}%，但相关查询可能变慢`,
                });
              } else {
                recommendations.push({
                  action: 'KEEP',
                  indexName: index.name,
                  table: table.name,
                  columns: index.columns,
                  reason: `索引对写入性能影响较小 (${((writeSlowdown - 1) * 100).toFixed(0)}%)，建议保留以支持查询`,
                  impact: '查询性能有保障，写入性能影响可接受',
                });
              }
            }
          }
        }
      }

      if (normalResult && extraResult) {
        const extraSlowdown = normalResult.metrics.totalTimeMs / extraResult.metrics.totalTimeMs;
        
        if (extraSlowdown > 1.3) {
          recommendations.push({
            action: 'DROP',
            indexName: '额外索引',
            table: '多表',
            columns: this.config.indexAnalysis.extraIndexColumns,
            reason: `额外索引使写入速度降低了 ${((extraSlowdown - 1) * 100).toFixed(0)}%，建议评估是否真的需要`,
            impact: `删除后写入性能预计提升 ${((extraSlowdown - 1) * 100).toFixed(0)}%`,
          });
        }
      }
    }

    if (recommendations.length === 0) {
      for (const table of this.tables) {
        for (const index of table.indexes) {
          if (!index.isPrimary) {
            recommendations.push({
              action: 'KEEP',
              indexName: index.name,
              table: table.name,
              columns: index.columns,
              reason: '索引配置合理，建议保持当前设置',
              impact: '写入和查询性能平衡良好',
            });
          }
        }
      }
    }

    return recommendations;
  }

  private findSuggestedBatchSize(sortedResults: BenchmarkResult[]): number {
    const batchResults = sortedResults.filter(r => r.strategyType === 'batch');
    if (batchResults.length === 0) {
      return 1000;
    }

    const best = batchResults.reduce((best, current) => 
      current.metrics.totalTimeMs < best.metrics.totalTimeMs ? current : best
    );

    return best.config.batchSize || 1000;
  }

  private findSuggestedJournalMode(sortedResults: BenchmarkResult[]): string {
    const journalResults = sortedResults.filter(r => r.strategyType === 'journal');
    if (journalResults.length === 0) {
      return 'WAL';
    }

    const best = journalResults.reduce((best, current) => 
      current.metrics.totalTimeMs < best.metrics.totalTimeMs ? current : best
    );

    return best.config.journalMode || 'WAL';
  }

  getTopRecommendations(limit: number = 3): OptimizationRecommendation[] {
    const report = this.generateReport();
    return report.recommendations.slice(0, limit);
  }
}
