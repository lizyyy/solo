const dayjs = require('dayjs');
const db = require('../database');

class ReportService {
  generateMarkdownReport(statistics, boundaryAnalysis = null) {
    const { period, summary, algorithmStats, appKeyStats } = statistics;
    
    let markdown = `# 接口限流策略分析报告\n\n`;
    markdown += `## 报告概览\n\n`;
    markdown += `| 项目 | 详情 |\n|------|------|\n`;
    markdown += `| 统计周期 | ${period.start} 至 ${period.end} |\n`;
    markdown += `| 总请求数 | ${summary.totalRequests} |\n`;
    markdown += `| 放行请求数 | ${summary.allowedRequests} |\n`;
    markdown += `| 拒绝请求数 | ${summary.rejectedRequests} |\n`;
    markdown += `| 放行率 | ${(summary.allowedRate * 100).toFixed(2)}% |\n`;
    markdown += `| 拒绝率 | ${(summary.rejectedRate * 100).toFixed(2)}% |\n\n`;

    if (algorithmStats && algorithmStats.length > 0) {
      markdown += `## 算法对比分析\n\n`;
      markdown += `| 算法 | 总请求 | 放行 | 拒绝 | 放行率 |\n`;
      markdown += `|------|--------|------|------|--------|\n`;
      
      for (const stat of algorithmStats) {
        const rate = stat.total > 0 ? (stat.allowed / stat.total * 100).toFixed(2) : '0.00';
        const algorithmName = stat.algorithm === 'fixed-window' ? '固定窗口' : '滑动窗口';
        markdown += `| ${algorithmName} | ${stat.total} | ${stat.allowed} | ${stat.rejected} | ${rate}% |\n`;
      }
      markdown += `\n`;
    }

    if (appKeyStats && appKeyStats.length > 0) {
      markdown += `## App Key 统计\n\n`;
      markdown += `| App Key | 名称 | 总请求 | 放行 | 拒绝 | 放行率 |\n`;
      markdown += `|---------|------|--------|------|------|--------|\n`;
      
      for (const stat of appKeyStats) {
        const rate = stat.total > 0 ? (stat.allowed / stat.total * 100).toFixed(2) : '0.00';
        markdown += `| ${stat.app_key} | ${stat.name} | ${stat.total} | ${stat.allowed} | ${stat.rejected} | ${rate}% |\n`;
      }
      markdown += `\n`;
    }

    if (boundaryAnalysis && boundaryAnalysis.boundaryDifferences) {
      markdown += `## 边界时刻误放差异分析\n\n`;
      markdown += `**分析配置：**\n`;
      markdown += `- App Key: ${boundaryAnalysis.appKey}\n`;
      markdown += `- 路由: ${boundaryAnalysis.path} [${boundaryAnalysis.method}]\n`;
      markdown += `- 窗口大小: ${boundaryAnalysis.windowSeconds}秒\n\n`;
      
      markdown += `### 算法统计对比\n\n`;
      markdown += `| 算法 | 总请求 | 放行 | 拒绝 |\n`;
      markdown += `|------|--------|------|------|\n`;
      markdown += `| 固定窗口 | ${boundaryAnalysis.fixedWindowStats.total} | ${boundaryAnalysis.fixedWindowStats.allowed} | ${boundaryAnalysis.fixedWindowStats.rejected} |\n`;
      markdown += `| 滑动窗口 | ${boundaryAnalysis.slidingWindowStats.total} | ${boundaryAnalysis.slidingWindowStats.allowed} | ${boundaryAnalysis.slidingWindowStats.rejected} |\n\n`;

      if (boundaryAnalysis.differenceCount > 0) {
        markdown += `### 发现的差异 (${boundaryAnalysis.differenceCount} 处)\n\n`;
        markdown += `| 序号 | 时间戳 | 固定窗口 | 滑动窗口 | 差异类型 |\n`;
        markdown += `|------|--------|----------|----------|----------|\n`;
        
        for (const diff of boundaryAnalysis.boundaryDifferences.slice(0, 20)) {
          const diffType = diff.difference === 'fixed_allowed_sliding_rejected' 
            ? '固定放行/滑动拒绝' 
            : '固定拒绝/滑动放行';
          markdown += `| ${diff.index} | ${diff.timestamp} | ${diff.fixedWindowAction} (${diff.fixedWindowCount}) | ${diff.slidingWindowAction} (${diff.slidingWindowCount}) | ${diffType} |\n`;
        }
        
        if (boundaryAnalysis.boundaryDifferences.length > 20) {
          markdown += `\n... 还有 ${boundaryAnalysis.boundaryDifferences.length - 20} 条差异记录\n\n`;
        }
      } else {
        markdown += `### 结论\n\n未发现两种算法在边界时刻的行为差异。\n\n`;
      }
    }

    markdown += `---\n\n`;
    markdown += `*报告生成时间: ${dayjs().format('YYYY-MM-DD HH:mm:ss')}*\n`;

    return markdown;
  }

  generateJSONReport(statistics, boundaryAnalysis = null) {
    const report = {
      generatedAt: dayjs().toISOString(),
      statistics: statistics,
      boundaryAnalysis: boundaryAnalysis || null
    };
    return JSON.stringify(report, null, 2);
  }

  async getDetailedLogs(startTime, endTime, limit = 1000) {
    const logs = db.all(
      `SELECT rl.*, ak.app_key, ak.name as app_name, r.path, r.method
       FROM request_logs rl
       JOIN app_keys ak ON rl.app_key_id = ak.id
       JOIN routes r ON rl.route_id = r.id
       WHERE rl.timestamp >= ? AND rl.timestamp <= ?
       ORDER BY rl.timestamp DESC
       LIMIT ?`,
      [startTime, endTime, limit]
    );

    return logs.map(log => ({
      id: log.id,
      requestId: log.request_id,
      appKey: log.app_key,
      appName: log.app_name,
      path: log.path,
      method: log.method,
      timestamp: dayjs(log.timestamp).toISOString(),
      algorithm: log.algorithm,
      limit: log.request_limit,
      windowSeconds: log.window_seconds,
      countInWindow: log.count_in_window,
      action: log.action,
      windowStart: log.window_start ? dayjs(log.window_start).toISOString() : null,
      windowEnd: log.window_end ? dayjs(log.window_end).toISOString() : null,
      details: log.details ? JSON.parse(log.details) : null
    }));
  }
}

module.exports = new ReportService();
