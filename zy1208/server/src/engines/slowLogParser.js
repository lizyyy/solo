class SlowLogParser {
  static analyze(slowLogs) {
    const result = {
      bottlenecks: [],
      sqlSuggestions: [],
      scoreDeductions: []
    };

    const allEntries = [];
    for (const log of slowLogs) {
      const entries = SlowLogParser._parseLog(log.content);
      allEntries.push(...entries);
    }

    if (allEntries.length === 0) {
      return result;
    }

    const slowQueries = allEntries.filter(e => e.queryTime > 0);
    
    if (slowQueries.length > 0) {
      const avgQueryTime = slowQueries.reduce((sum, e) => sum + e.queryTime, 0) / slowQueries.length;
      const maxQueryTime = Math.max(...slowQueries.map(e => e.queryTime));
      const slowCount = slowQueries.filter(e => e.queryTime > 1).length;
      
      if (maxQueryTime > 10) {
        result.bottlenecks.push({
          category: '慢查询',
          severity: 'critical',
          description: `存在极慢查询，最长执行时间 ${maxQueryTime.toFixed(2)} 秒`,
          suggestion: '优化最慢的查询，考虑添加索引或重写查询语句',
          impactScore: 10
        });
        result.scoreDeductions.push(15);
      } else if (maxQueryTime > 5) {
        result.bottlenecks.push({
          category: '慢查询',
          severity: 'high',
          description: `存在慢查询，最长执行时间 ${maxQueryTime.toFixed(2)} 秒`,
          suggestion: '分析慢查询，检查是否缺少索引',
          impactScore: 7
        });
        result.scoreDeductions.push(10);
      }

      if (slowCount > slowQueries.length * 0.2) {
        result.bottlenecks.push({
          category: '慢查询占比高',
          severity: 'high',
          description: `慢查询占比 ${((slowCount / slowQueries.length) * 100).toFixed(1)}%`,
          suggestion: '系统性审查查询模式，考虑优化策略',
          impactScore: 8
        });
        result.scoreDeductions.push(10);
      }
    }

    const tableScans = [];
    const fullJoinQueries = [];
    const noLimitQueries = [];
    const selectStarQueries = [];
    const orderByWithoutIndex = [];
    const likeLeadingWildcard = [];

    for (const entry of allEntries) {
      if (!entry.sqlText) continue;
      
      const sql = entry.sqlText.toUpperCase();
      
      if (sql.includes('SEQ SCAN') || sql.includes('FULL TABLE SCAN')) {
        tableScans.push(entry);
      }
      
      if (sql.includes('NESTED LOOP') && !sql.includes('INDEX')) {
        fullJoinQueries.push(entry);
      }
      
      if (!sql.includes('LIMIT') && sql.includes('SELECT')) {
        noLimitQueries.push(entry);
      }
      
      if (sql.includes('SELECT *')) {
        selectStarQueries.push(entry);
      }
      
      if (sql.includes('ORDER BY') && !SlowLogParser._hasIndexForOrderBy(entry.sqlText)) {
        orderByWithoutIndex.push(entry);
      }
      
      if (sql.includes("LIKE '%")) {
        likeLeadingWildcard.push(entry);
      }
    }

    if (tableScans.length > 0) {
      result.bottlenecks.push({
        category: '全表扫描',
        severity: 'high',
        description: `检测到 ${tableScans.length} 个全表扫描查询`,
        suggestion: '为 WHERE 条件中的列添加适当的索引',
        impactScore: 9
      });
      result.scoreDeductions.push(12);
    }

    if (likeLeadingWildcard.length > 0) {
      result.sqlSuggestions.push({
        title: '前置通配符 LIKE 查询',
        problem: '使用了 LIKE "%..." 这样的前置通配符查询，无法使用索引',
        originalSql: likeLeadingWildcard[0]?.sqlText || '',
        optimizedSql: '考虑使用全文索引或重新设计查询方式',
        explanation: '前置通配符会导致索引失效，考虑使用 PostgreSQL 的全文搜索功能'
      });
      result.scoreDeductions.push(5);
    }

    if (orderByWithoutIndex.length > 0) {
      result.sqlSuggestions.push({
        title: 'ORDER BY 无索引',
        problem: 'ORDER BY 子句中的列没有索引，导致文件排序',
        originalSql: orderByWithoutIndex[0]?.sqlText || '',
        optimizedSql: '为 ORDER BY 列添加索引或使用索引覆盖',
        explanation: '无索引的 ORDER BY 会导致内存或磁盘排序，性能很差'
      });
      result.scoreDeductions.push(5);
    }

    if (noLimitQueries.length > 0) {
      result.sqlSuggestions.push({
        title: 'SELECT 无 LIMIT 限制',
        problem: '查询没有 LIMIT 限制，可能返回大量数据',
        originalSql: noLimitQueries[0]?.sqlText || '',
        optimizedSql: '添加 LIMIT 限制或实现分页查询',
        explanation: '无限制查询会消耗大量内存和网络带宽'
      });
      result.scoreDeductions.push(3);
    }

    if (selectStarQueries.length > 0) {
      result.sqlSuggestions.push({
        title: '使用 SELECT *',
        problem: '使用 SELECT * 查询所有列，可能获取不需要的数据',
        originalSql: selectStarQueries[0]?.sqlText || '',
        optimizedSql: '明确指定需要的列名',
        explanation: 'SELECT * 会增加网络传输和内存占用，也可能导致索引覆盖失效'
      });
      result.scoreDeductions.push(2);
    }

    const highRowsExamined = allEntries.filter(e => e.rowsExamined > 10000);
    if (highRowsExamined.length > 0) {
      result.bottlenecks.push({
        category: '大量行扫描',
        severity: 'medium',
        description: `${highRowsExamined.length} 个查询扫描了超过 10000 行数据`,
        suggestion: '检查 WHERE 条件，添加合适的索引或优化查询条件',
        impactScore: 6
      });
      result.scoreDeductions.push(8);
    }

    return result;
  }

  static _parseLog(content) {
    const entries = [];
    const lines = content.split('\n');
    let currentEntry = null;

    for (const line of lines) {
      if (line.startsWith('LOG:') || line.includes('duration:')) {
        if (currentEntry) {
          entries.push(currentEntry);
        }
        currentEntry = { sqlText: '' };
        
        const durationMatch = line.match(/duration:\s*([\d.]+)\s*ms/);
        if (durationMatch) {
          currentEntry.queryTime = parseFloat(durationMatch[1]) / 1000;
        }
      } else if (currentEntry && !line.startsWith('#') && !line.startsWith('Time:')) {
        currentEntry.sqlText += (currentEntry.sqlText ? ' ' : '') + line.trim();
      }
    }

    if (currentEntry) {
      entries.push(currentEntry);
    }

    return entries;
  }

  static _hasIndexForOrderBy(sql) {
    return false;
  }
}

module.exports = SlowLogParser;
