class ReadWriteRoutingAnalyzer {
  static analyze(slowLogs) {
    const result = {
      issues: [],
      suggestions: [],
      bottlenecks: [],
      scoreDeductions: [],
      readQueries: 0,
      writeQueries: 0,
      readWriteRatio: 0
    };

    const allQueries = [];
    for (const log of slowLogs) {
      const entries = this._parseLogEntries(log.content);
      allQueries.push(...entries);
    }

    for (const query of allQueries) {
      if (!query.sqlText) continue;
      
      const sql = query.sqlText.trim().toUpperCase();
      
      if (sql.startsWith('SELECT') || sql.startsWith('WITH')) {
        result.readQueries++;
        
        if (query.queryTime > 1) {
          result.issues.push(`慢读查询: 执行时间 ${query.queryTime}s - ${query.sqlText.substring(0, 100)}...`);
        }
      } else if (sql.startsWith('INSERT') || sql.startsWith('UPDATE') || sql.startsWith('DELETE')) {
        result.writeQueries++;
        
        if (query.queryTime > 0.5) {
          result.issues.push(`慢写查询: 执行时间 ${query.queryTime}s - ${query.sqlText.substring(0, 100)}...`);
        }
      }
    }

    if (result.readQueries > 0 || result.writeQueries > 0) {
      result.readWriteRatio = result.writeQueries > 0 
        ? (result.readQueries / result.writeQueries).toFixed(2) 
        : 'N/A';
    }

    if (result.readQueries > result.writeQueries * 10) {
      result.suggestions.push('读操作远多于写操作，建议启用读写分离，将读流量路由到从库');
      result.suggestions.push('考虑使用连接池的读写分离配置');
      
      result.bottlenecks.push({
        category: '读写分离未优化',
        severity: 'medium',
        description: `读写比例为 ${result.readWriteRatio}:1，读操作占主导但未利用读写分离`,
        suggestion: '配置读写分离，将读查询路由到从库，减轻主库压力',
        impactScore: 5
      });
      result.scoreDeductions.push(5);
    }

    const transactions = [];
    const longTransactions = [];
    
    for (const query of allQueries) {
      if (!query.sqlText) continue;
      
      const sql = query.sqlText.trim().toUpperCase();
      
      if (sql.includes('BEGIN') || sql.includes('START TRANSACTION')) {
        transactions.push({ start: query });
      }
      
      if (transactions.length > 0 && (sql.includes('COMMIT') || sql.includes('ROLLBACK'))) {
        const tx = transactions.pop();
        tx.end = query;
        
        if (query.queryTime > 1) {
          longTransactions.push(tx);
        }
      }
    }

    if (longTransactions.length > 0) {
      result.bottlenecks.push({
        category: '长事务',
        severity: 'high',
        description: `检测到 ${longTransactions.length} 个长事务`,
        suggestion: '优化事务逻辑，减少事务持有时间，避免在事务中执行耗时操作',
        impactScore: 8
      });
      result.scoreDeductions.push(10);
      result.issues.push('存在长事务，可能导致锁等待和连接池占用');
    }

    const mixedReadWrite = [];
    for (const query of allQueries) {
      if (!query.sqlText) continue;
      
      const sql = query.sqlText.toUpperCase();
      
      if (sql.includes('SELECT') && (sql.includes('FOR UPDATE') || sql.includes('FOR NO KEY UPDATE'))) {
        mixedReadWrite.push(query);
      }
      
      if (sql.includes('UPDATE') && sql.includes('FROM') && sql.includes('SELECT')) {
        mixedReadWrite.push(query);
      }
    }

    if (mixedReadWrite.length > 0) {
      result.bottlenecks.push({
        category: '读写混合查询',
        severity: 'medium',
        description: `检测到 ${mixedReadWrite.length} 个读写混合查询（如 SELECT ... FOR UPDATE）`,
        suggestion: '评估是否可以拆分读写操作，或优化锁定策略',
        impactScore: 4
      });
      result.scoreDeductions.push(4);
      result.issues.push('存在 SELECT ... FOR UPDATE 等读写混合查询，可能影响并发性');
    }

    return result;
  }

  static _parseLogEntries(content) {
    const entries = [];
    const lines = content.split('\n');
    let currentEntry = null;

    for (const line of lines) {
      if (line.includes('duration:') || line.startsWith('LOG:')) {
        if (currentEntry) {
          entries.push(currentEntry);
        }
        currentEntry = { sqlText: '' };
        
        const durationMatch = line.match(/duration:\s*([\d.]+)\s*ms/);
        if (durationMatch) {
          currentEntry.queryTime = parseFloat(durationMatch[1]) / 1000;
        }
      } else if (currentEntry && !line.startsWith('#') && !line.startsWith('Time:')) {
        const trimmed = line.trim();
        if (trimmed) {
          currentEntry.sqlText += (currentEntry.sqlText ? ' ' : '') + trimmed;
        }
      }
    }

    if (currentEntry) {
      entries.push(currentEntry);
    }

    return entries;
  }
}

module.exports = ReadWriteRoutingAnalyzer;
