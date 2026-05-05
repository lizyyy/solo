class ShardingAnalyzer {
  static analyze(schemaSql, writeSamples) {
    const result = {
      risks: [],
      bottlenecks: [],
      scoreDeductions: []
    };

    const tables = ShardingAnalyzer._parseTables(schemaSql);
    
    const shardKeyPatterns = [
      'user_id', 'tenant_id', 'org_id', 'company_id',
      'shard_key', 'shard_id', 'partition_key',
      'created_at', 'create_time', 'date'
    ];

    for (const table of tables) {
      const hasShardKey = shardKeyPatterns.some(pattern => 
        table.name.toLowerCase().includes(pattern.replace('_id', '')) ||
        table.columns.some(col => col.toLowerCase().includes(pattern))
      );

      if (table.name.toLowerCase().includes('order') || 
          table.name.toLowerCase().includes('transaction') ||
          table.name.toLowerCase().includes('log')) {
        
        if (!hasShardKey) {
          result.risks.push({
            category: '分片键缺失风险',
            tableName: table.name,
            severity: 'high',
            description: `业务表 ${table.name} 没有明显的分片键列`,
            impact: '分库分表时可能导致数据分布不均和热点问题',
            suggestion: '考虑添加 user_id、tenant_id 或时间字段作为分片键'
          });
          
          result.bottlenecks.push({
            category: '分片键设计问题',
            severity: 'high',
            description: `表 ${table.name} 缺少分片键设计`,
            suggestion: '设计合理的分片键，如 user_id 或时间字段',
            impactScore: 7
          });
          result.scoreDeductions.push(8);
        }
      }
    }

    if (writeSamples && writeSamples.length > 0) {
      const hotSpotAnalysis = ShardingAnalyzer._analyzeHotSpots(writeSamples);
      
      if (hotSpotAnalysis.hasHotSpots) {
        result.risks.push({
          category: '热点数据风险',
          tableName: hotSpotAnalysis.hotTable,
          severity: 'critical',
          description: `检测到热点数据问题，${hotSpotAnalysis.hotKey} 访问频率过高`,
          impact: '热点会导致单个分片压力过大，成为系统瓶颈',
          suggestion: '考虑使用分片键打散、缓存热点数据、或使用一致性哈希'
        });
        
        result.bottlenecks.push({
          category: '分片热点',
          severity: 'critical',
          description: `检测到热点数据问题，${hotSpotAnalysis.hotKey} 访问占比 ${hotSpotAnalysis.ratio}%`,
          suggestion: '优化分片策略，使用更分散的分片键或引入缓存层',
          impactScore: 10
        });
        result.scoreDeductions.push(15);
      }

      const distributionAnalysis = ShardingAnalyzer._analyzeDistribution(writeSamples);
      
      if (distributionAnalysis.unbalanced) {
        result.risks.push({
          category: '数据分布不均风险',
          severity: 'medium',
          description: `数据分布不均匀，最热门分片包含 ${distributionAnalysis.maxPercentage}% 的数据`,
          impact: '数据倾斜会导致部分分片压力过大，无法发挥分库分表的优势',
          suggestion: '重新评估分片键选择，考虑使用哈希分片或范围+哈希组合'
        });
        
        result.bottlenecks.push({
          category: '数据倾斜',
          severity: 'medium',
          description: `数据分布倾斜，最热门分片占比 ${distributionAnalysis.maxPercentage}%`,
          suggestion: '使用更好的分片策略，如一致性哈希',
          impactScore: 5
        });
        result.scoreDeductions.push(5);
      }
    }

    const crossShardJoins = ShardingAnalyzer._checkCrossShardJoins(tables);
    if (crossShardJoins.length > 0) {
      result.risks.push({
        category: '跨分片关联风险',
        severity: 'high',
        description: `检测到 ${crossShardJoins.length} 个可能的跨分片关联场景`,
        impact: '跨分片 JOIN 性能极差，无法利用本地索引',
        suggestion: '考虑数据冗余、宽表设计，或在应用层进行关联'
      });
      
      result.bottlenecks.push({
        category: '跨分片查询',
        severity: 'high',
        description: '存在跨分片关联查询的风险',
        suggestion: '优化数据模型，避免跨分片 JOIN',
        impactScore: 8
      });
      result.scoreDeductions.push(10);
    }

    return result;
  }

  static _parseTables(schemaSql) {
    const tables = [];
    const createTableRegex = /CREATE\s+(?:UNLOGGED\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([\w.]+)\s*\(([\s\S]*?)\);?/gi;
    
    let match;
    while ((match = createTableRegex.exec(schemaSql)) !== null) {
      const tableName = match[1];
      const tableContent = match[2];
      
      const columns = [];
      const lines = tableContent.split(',');
      for (const line of lines) {
        const trimmed = line.trim();
        const firstWord = trimmed.split(/\s+/)[0];
        if (firstWord && !firstWord.toUpperCase().includes('CONSTRAINT') && 
            !firstWord.toUpperCase().includes('PRIMARY') &&
            !firstWord.toUpperCase().includes('FOREIGN') &&
            !firstWord.toUpperCase().includes('UNIQUE')) {
          columns.push(firstWord);
        }
      }

      tables.push({
        name: tableName,
        columns: columns
      });
    }

    return tables;
  }

  static _analyzeHotSpots(writeSamples) {
    const result = {
      hasHotSpots: false,
      hotTable: null,
      hotKey: null,
      ratio: 0
    };

    const keyCounts = {};
    let total = 0;

    for (const sample of writeSamples) {
      if (sample.records) {
        for (const record of sample.records) {
          const shardKey = record.user_id || record.tenant_id || record.shard_key || record.id;
          if (shardKey) {
            const key = String(shardKey);
            keyCounts[key] = (keyCounts[key] || 0) + 1;
            total++;
          }
        }
      }
    }

    if (total > 0) {
      const sorted = Object.entries(keyCounts).sort((a, b) => b[1] - a[1]);
      if (sorted.length > 0) {
        const topKey = sorted[0];
        const ratio = (topKey[1] / total) * 100;
        
        if (ratio > 20) {
          result.hasHotSpots = true;
          result.hotKey = topKey[0];
          result.ratio = ratio.toFixed(1);
        }
      }
    }

    return result;
  }

  static _analyzeDistribution(writeSamples) {
    const result = {
      unbalanced: false,
      maxPercentage: 0
    };

    const shardCounts = {};
    let total = 0;

    const hashCode = (str) => {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return hash;
    };

    for (const sample of writeSamples) {
      if (sample.records) {
        for (const record of sample.records) {
          const shardKey = record.user_id || record.tenant_id || record.id;
          if (shardKey) {
            const shard = hashCode(String(shardKey)) % 10;
            const shardId = Math.abs(shard);
            shardCounts[shardId] = (shardCounts[shardId] || 0) + 1;
            total++;
          }
        }
      }
    }

    if (total > 0) {
      const counts = Object.values(shardCounts);
      const avg = total / counts.length;
      const max = Math.max(...counts);
      const maxPercentage = (max / total) * 100;
      
      if (max > avg * 2) {
        result.unbalanced = true;
        result.maxPercentage = maxPercentage.toFixed(1);
      }
    }

    return result;
  }

  static _checkCrossShardJoins(tables) {
    const issues = [];
    
    const tablePairs = [
      ['order', 'user'],
      ['transaction', 'user'],
      ['order_item', 'order'],
      ['order_item', 'product']
    ];

    for (const [table1, table2] of tablePairs) {
      const hasTable1 = tables.some(t => t.name.toLowerCase().includes(table1));
      const hasTable2 = tables.some(t => t.name.toLowerCase().includes(table2));
      
      if (hasTable1 && hasTable2) {
        const t1 = tables.find(t => t.name.toLowerCase().includes(table1));
        const t2 = tables.find(t => t.name.toLowerCase().includes(table2));
        
        const commonKey = t1.columns.find(c => t2.columns.includes(c));
        if (!commonKey) {
          issues.push({ tables: [table1, table2], reason: '缺少共同关联键' });
        }
      }
    }

    return issues;
  }
}

module.exports = ShardingAnalyzer;
