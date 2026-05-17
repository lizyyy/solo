const fs = require('fs');
const path = require('path');
const { createObjectCsvWriter } = require('csv-writer');
const { logger, formatBytes, formatDuration } = require('./utils');

class OutputWriter {
  constructor(config, readerStats, stitcherStats, invalidEvents, gapDetails) {
    this.config = config;
    this.readerStats = readerStats;
    this.stitcherStats = stitcherStats;
    this.invalidEvents = invalidEvents;
    this.gapDetails = gapDetails;
    this.startTime = Date.now();
  }

  async writeAll(sessions) {
    if (!fs.existsSync(this.config.outputDir)) {
      fs.mkdirSync(this.config.outputDir, { recursive: true });
    }

    const outputs = [];

    if (this.config.outputFormats.includes('ndjson')) {
      outputs.push(this.writeNdjson(sessions));
    }
    if (this.config.outputFormats.includes('csv')) {
      outputs.push(this.writeCsv(sessions));
    }
    if (this.config.outputFormats.includes('report')) {
      outputs.push(this.writeReport(sessions));
    }

    await Promise.all(outputs);
    this.printSummary();
  }

  async writeNdjson(sessions) {
    const outputPath = path.join(this.config.outputDir, 'stitched-sessions.ndjson');
    const stream = fs.createWriteStream(outputPath, { encoding: this.config.encoding });

    let eventCount = 0;
    for (const session of sessions) {
      for (const event of session.events) {
        stream.write(JSON.stringify({
          session_id: session.sessionId,
          session_start_time: session.startTime,
          session_duration: session.duration,
          ...event
        }) + '\n');
        eventCount++;
      }
    }

    stream.end();
    logger.debug(`NDJSON输出完成: ${eventCount} 个事件`);
    return outputPath;
  }

  async writeCsv(sessions) {
    const outputPath = path.join(this.config.outputDir, 'stitched-sessions.csv');
    
    const allEvents = [];
    for (const session of sessions) {
      for (const event of session.events) {
        allEvents.push({
          session_id: session.sessionId,
          session_start_time: new Date(session.startTime).toISOString(),
          session_duration_ms: session.duration,
          user_id: session.userId,
          ...event
        });
      }
    }

    if (allEvents.length === 0) {
      logger.warn('没有事件可导出CSV');
      return outputPath;
    }

    const headers = Object.keys(allEvents[0]).map(key => ({
      id: key,
      title: key
    }));

    const csvWriter = createObjectCsvWriter({
      path: outputPath,
      header: headers
    });

    await csvWriter.writeRecords(allEvents);
    logger.debug(`CSV输出完成: ${allEvents.length} 个事件`);
    return outputPath;
  }

  async writeReport(sessions) {
    const outputPath = path.join(this.config.outputDir, 'stitching-report.md');
    const duration = Date.now() - this.startTime;

    let totalSize = 0;
    for (const file of Object.values(this.readerStats.fileStats)) {
      totalSize += file.size;
    }

    const report = `# 事件缝合报告

## 执行摘要

| 指标 | 数值 |
|------|------|
| 执行时间 | ${formatDuration(duration)} |
| 输入文件数 | ${this.readerStats.totalFiles} |
| 输入总大小 | ${formatBytes(totalSize)} |
| 总行数 | ${this.readerStats.totalLines} |
| 有效事件 | ${this.readerStats.validEvents} |
| 无效事件 | ${this.readerStats.invalidEvents} |
| 用户数 | ${this.stitcherStats.totalUsers} |
| 原始会话数 | ${this.stitcherStats.totalSessions} |
| 缝合后会话数 | ${sessions.length} |
| 合并会话数 | ${this.stitcherStats.stitchedSessions} |
| 检测到的缺口数 | ${this.stitcherStats.totalGaps} |

---

## 文件详情

${Object.entries(this.readerStats.fileStats).map(([file, stats]) => `
### ${path.basename(file)}

- 路径: \`${file}\`
- 文件大小: ${formatBytes(stats.size)}
- 总行数: ${stats.lines}
- 有效事件: ${stats.valid}
- 无效事件: ${stats.invalid}
`).join('')}

---

## 会话统计

- 最小会话时长: ${sessions.length > 0 ? formatDuration(Math.min(...sessions.map(s => s.duration))) : 'N/A'}
- 最大会话时长: ${sessions.length > 0 ? formatDuration(Math.max(...sessions.map(s => s.duration))) : 'N/A'}
- 平均会话时长: ${sessions.length > 0 ? formatDuration(sessions.reduce((sum, s) => sum + s.duration, 0) / sessions.length) : 'N/A'}
- 最小事件数: ${sessions.length > 0 ? Math.min(...sessions.map(s => s.eventCount)) : 'N/A'}
- 最大事件数: ${sessions.length > 0 ? Math.max(...sessions.map(s => s.eventCount)) : 'N/A'}
- 平均事件数: ${sessions.length > 0 ? (sessions.reduce((sum, s) => sum + s.eventCount, 0) / sessions.length).toFixed(1) : 'N/A'}

---

## 缺口详情 (Top 10)

${this.gapDetails.length > 0 ? `
| # | 用户ID | 缺口时长 | 前一事件位置 | 当前事件位置 |
|---|--------|----------|-------------|-------------|
${this.gapDetails.slice(0, 10).map((gap, i) => `| ${i + 1} | ${gap.userId} | ${gap.gapFormatted} | ${path.basename(gap.prevEvent.file)}:${gap.prevEvent.line} | ${path.basename(gap.currEvent.file)}:${gap.currEvent.line} |`).join('\n')}
` : '无缺口'}

---

## 无效事件详情 (Top 20)

${this.invalidEvents.length > 0 ? `
| # | 文件 | 行号 | 错误 |
|---|------|------|------|
${this.invalidEvents.slice(0, 20).map((err, i) => `| ${i + 1} | ${path.basename(err.file)} | ${err.line} | ${err.error} |`).join('\n')}

> 共 ${this.invalidEvents.length} 个无效事件，完整列表见 errors.ndjson
` : '无无效事件'}

---

## 配置参数

- 用户标识字段: \`${this.config.userKey}\`
- 会话标识字段: \`${this.config.sessionKey}\`
- 时间字段: \`${this.config.timeKey}\`
- 缺口阈值: ${formatDuration(this.config.gapThreshold)}

---

*报告生成时间: ${new Date().toISOString()}*
`;

    fs.writeFileSync(outputPath, report, { encoding: this.config.encoding });
    
    if (this.invalidEvents.length > 0) {
      const errorsPath = path.join(this.config.outputDir, 'errors.ndjson');
      const stream = fs.createWriteStream(errorsPath, { encoding: this.config.encoding });
      for (const err of this.invalidEvents) {
        stream.write(JSON.stringify(err) + '\n');
      }
      stream.end();
    }

    const gapsPath = path.join(this.config.outputDir, 'gaps.ndjson');
    const stream = fs.createWriteStream(gapsPath, { encoding: this.config.encoding });
    for (const gap of this.gapDetails) {
      stream.write(JSON.stringify(gap) + '\n');
    }
    stream.end();

    logger.debug(`报告输出完成`);
    return outputPath;
  }

  printSummary() {
    const duration = Date.now() - this.startTime;

    console.log('\n' + '='.repeat(60));
    console.log('✅ 事件缝合完成！');
    console.log('='.repeat(60));
    console.log(`⏱  执行时间: ${formatDuration(duration)}`);
    console.log(`📁 输入文件: ${this.readerStats.totalFiles} 个`);
    console.log(`📝 处理行数: ${this.readerStats.totalLines} 行`);
    console.log(`✅ 有效事件: ${this.readerStats.validEvents} 个`);
    console.log(`❌ 无效事件: ${this.readerStats.invalidEvents} 个`);
    console.log(`👤 用户数: ${this.stitcherStats.totalUsers} 个`);
    console.log(`🔗 缝合会话: ${this.stitcherStats.stitchedSessions} 个`);
    console.log(`⚠  检测缺口: ${this.stitcherStats.totalGaps} 个`);
    console.log(`📂 输出目录: ${this.config.outputDir}`);
    console.log('='.repeat(60) + '\n');
  }
}

module.exports = { OutputWriter };