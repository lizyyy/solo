class ConnectionPoolAnalyzer {
  static analyze(profile) {
    const result = {
      currentMaxConnections: null,
      suggestedMaxConnections: null,
      maxConnectionsExplanation: '',
      currentIdleTimeout: null,
      suggestedIdleTimeout: null,
      idleTimeoutExplanation: '',
      currentMinIdle: null,
      suggestedMinIdle: null,
      minIdleExplanation: '',
      connectionIssues: [],
      bottlenecks: [],
      scoreDeductions: []
    };

    const poolMetrics = profile.connectionPool || profile.pool || profile;
    
    if (poolMetrics.maxConnections) {
      result.currentMaxConnections = poolMetrics.maxConnections;
    }
    
    if (poolMetrics.activeConnections !== undefined) {
      const active = poolMetrics.activeConnections;
      const max = poolMetrics.maxConnections || 100;
      const utilization = active / max;
      
      if (utilization > 0.9) {
        result.bottlenecks.push({
          category: '连接池接近饱和',
          severity: 'critical',
          description: `连接池利用率达到 ${(utilization * 100).toFixed(1)}%，当前 ${active}/${max} 连接`,
          suggestion: '增加最大连接数配置，或优化查询减少连接占用时间',
          impactScore: 10
        });
        result.scoreDeductions.push(15);
        result.connectionIssues.push('连接池利用率过高，可能导致请求等待');
      } else if (utilization > 0.7) {
        result.bottlenecks.push({
          category: '连接池利用率偏高',
          severity: 'high',
          description: `连接池利用率 ${(utilization * 100).toFixed(1)}%，当前 ${active}/${max} 连接`,
          suggestion: '监控连接使用情况，考虑增加连接数',
          impactScore: 7
        });
        result.scoreDeductions.push(8);
        result.connectionIssues.push('连接池利用率偏高，建议监控');
      }
      
      result.suggestedMaxConnections = Math.ceil(active * 1.5);
      result.maxConnectionsExplanation = `建议设置为 ${result.suggestedMaxConnections}，基于当前活跃连接数 ${active} 的 1.5 倍`;
    }

    if (poolMetrics.waitTime !== undefined && poolMetrics.waitTime > 100) {
      result.bottlenecks.push({
        category: '连接等待时间过长',
        severity: 'critical',
        description: `获取连接平均等待时间 ${poolMetrics.waitTime}ms`,
        suggestion: '增加连接池大小或优化查询减少连接持有时间',
        impactScore: 9
      });
      result.scoreDeductions.push(12);
      result.connectionIssues.push(`获取连接等待时间 ${poolMetrics.waitTime}ms，建议增加连接数`);
    }

    if (poolMetrics.idleConnections !== undefined) {
      result.currentMinIdle = poolMetrics.minIdle;
      
      if (poolMetrics.idleConnections > poolMetrics.maxConnections * 0.5) {
        result.bottlenecks.push({
          category: '空闲连接过多',
          severity: 'medium',
          description: `空闲连接数 ${poolMetrics.idleConnections} 超过最大连接数的 50%`,
          suggestion: '减少最小空闲连接配置或缩短空闲超时时间',
          impactScore: 3
        });
        result.scoreDeductions.push(3);
        result.connectionIssues.push('空闲连接过多，浪费资源');
      }
      
      result.suggestedMinIdle = Math.ceil(poolMetrics.idleConnections * 0.5);
      result.minIdleExplanation = `建议设置为 ${result.suggestedMinIdle}，基于当前空闲连接的 50%`;
    }

    if (poolMetrics.timeouts !== undefined && poolMetrics.timeouts > 0) {
      result.bottlenecks.push({
        category: '连接获取超时',
        severity: 'critical',
        description: `检测到 ${poolMetrics.timeouts} 次连接获取超时`,
        suggestion: '紧急检查连接池配置，增加连接数或优化查询',
        impactScore: 10
      });
      result.scoreDeductions.push(20);
      result.connectionIssues.push('存在连接获取超时，系统可能不稳定');
    }

    if (poolMetrics.leaks !== undefined && poolMetrics.leaks > 0) {
      result.bottlenecks.push({
        category: '连接泄漏',
        severity: 'critical',
        description: `检测到 ${poolMetrics.leaks} 个连接泄漏`,
        suggestion: '检查代码确保连接正确释放，使用 try-with-resources',
        impactScore: 10
      });
      result.scoreDeductions.push(20);
      result.connectionIssues.push('存在连接泄漏，这是严重问题');
    }

    return result;
  }
}

module.exports = ConnectionPoolAnalyzer;
