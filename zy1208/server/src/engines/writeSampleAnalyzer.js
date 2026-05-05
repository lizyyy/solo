class WriteSampleAnalyzer {
  static analyze(writeSamples) {
    const result = {
      bottlenecks: [],
      scoreDeductions: [],
      stats: {
        totalWrites: 0,
        batchWrites: 0,
        singleWrites: 0,
        tables: {}
      }
    };

    const batchPatterns = [];
    const insertCounts = [];

    for (const sample of writeSamples) {
      if (sample.operation_type === 'batch_insert' || sample.batch_size > 1) {
        result.stats.batchWrites++;
        batchPatterns.push({
          table: sample.table_name,
          size: sample.batch_size,
          frequency: sample.frequency
        });
      } else if (sample.operation_type === 'single_insert' || sample.rows_count === 1) {
        result.stats.singleWrites++;
      }

      if (sample.table_name) {
        if (!result.stats.tables[sample.table_name]) {
          result.stats.tables[sample.table_name] = {
            writes: 0,
            batchWrites: 0,
            avgBatchSize: 0
          };
        }
        result.stats.tables[sample.table_name].writes++;
        
        if (sample.batch_size > 1) {
          result.stats.tables[sample.table_name].batchWrites++;
        }
      }

      if (sample.rows_count) {
        insertCounts.push(sample.rows_count);
      }
    }

    result.stats.totalWrites = result.stats.batchWrites + result.stats.singleWrites;

    if (result.stats.singleWrites > result.stats.batchWrites * 5) {
      result.bottlenecks.push({
        category: '单条写入过多',
        severity: 'medium',
        description: `单条写入占比过高：${result.stats.singleWrites} 条单写 vs ${result.stats.batchWrites} 条批写`,
        suggestion: '将多条单条 INSERT 合并为批量 INSERT，减少网络往返',
        impactScore: 5
      });
      result.scoreDeductions.push(5);
    }

    if (insertCounts.length > 0) {
      const avgRows = insertCounts.reduce((a, b) => a + b, 0) / insertCounts.length;
      const maxRows = Math.max(...insertCounts);
      
      if (maxRows > 1000) {
        result.bottlenecks.push({
          category: '批量过大',
          severity: 'high',
          description: `单次批量写入过大：${maxRows} 条，平均 ${avgRows.toFixed(0)} 条`,
          suggestion: '将大批次拆分为多个小批次，避免锁表时间过长',
          impactScore: 7
        });
        result.scoreDeductions.push(8);
      } else if (avgRows < 10 && result.stats.batchWrites > 0) {
        result.bottlenecks.push({
          category: '批量过小',
          severity: 'medium',
          description: `批量写入平均行数过少：${avgRows.toFixed(0)} 条`,
          suggestion: '增加每批次的行数，建议 50-500 条',
          impactScore: 4
        });
        result.scoreDeductions.push(3);
      }
    }

    for (const tableName in result.stats.tables) {
      const tableStats = result.stats.tables[tableName];
      const batchRatio = tableStats.batchWrites / tableStats.writes;
      
      if (tableStats.writes > 10 && batchRatio < 0.3) {
        result.bottlenecks.push({
          category: '表级批量写入不足',
          severity: 'medium',
          description: `表 ${tableName} 的批量写入占比仅 ${(batchRatio * 100).toFixed(0)}%`,
          suggestion: '考虑将对该表的单条写入合并为批量',
          impactScore: 4
        });
        result.scoreDeductions.push(3);
      }
    }

    for (const sample of writeSamples) {
      if (sample.records && sample.records.length > 0) {
        const firstRecord = sample.records[0];
        
        if (firstRecord.created_at || firstRecord.create_time) {
          const times = sample.records.map(r => r.created_at || r.create_time);
          const uniqueTimes = [...new Set(times)];
          
          if (uniqueTimes.length === 1) {
            result.bottlenecks.push({
              category: '时间字段批量问题',
              severity: 'low',
              description: `批量写入的记录时间字段全部相同`,
              suggestion: '确保批量写入的记录有合理的时间分布，或使用数据库默认值',
              impactScore: 2
            });
          }
        }
      }
    }

    return result;
  }
}

module.exports = WriteSampleAnalyzer;
