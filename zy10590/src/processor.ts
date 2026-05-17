import * as fs from 'fs';
import * as path from 'path';
import { ValidRow, SessionEvents, GapInfo, ProcessOptions, ProcessingResult, BadRow } from './types';
import { JsonlReader } from './reader';

export class SessionProcessor {
  private options: ProcessOptions;

  constructor(options: ProcessOptions) {
    this.options = options;
  }

  async process(): Promise<ProcessingResult> {
    const startTime = new Date();

    const reader = new JsonlReader(this.options);
    const { validRows, badRows, totalRows } = await reader.readAll();

    const sessions = this.groupBySession(validRows);
    this.sortSessionsByTime(sessions);
    const allGaps = this.detectGaps(sessions);

    const outputFiles = await this.writeOutputs(sessions, badRows, allGaps);

    const endTime = new Date();

    return this.buildResult(
      startTime,
      endTime,
      totalRows,
      validRows.length,
      badRows.length,
      sessions.size,
      allGaps.length,
      outputFiles,
      badRows,
      allGaps
    );
  }

  private groupBySession(rows: ValidRow[]): Map<string, SessionEvents> {
    const sessions = new Map<string, SessionEvents>();

    for (const row of rows) {
      if (!sessions.has(row.sessionKey)) {
        sessions.set(row.sessionKey, {
          sessionKey: row.sessionKey,
          events: [],
          gaps: [],
          shardIds: new Set()
        });
      }

      const session = sessions.get(row.sessionKey)!;
      session.events.push(row);
      if (row.shardId !== undefined) {
        session.shardIds.add(row.shardId);
      }
    }

    return sessions;
  }

  private sortSessionsByTime(sessions: Map<string, SessionEvents>): void {
    for (const session of sessions.values()) {
      session.events.sort((a, b) => a.eventTime - b.eventTime);
    }
  }

  private detectGaps(sessions: Map<string, SessionEvents>): GapInfo[] {
    const allGaps: GapInfo[] = [];

    for (const session of sessions.values()) {
      const events = session.events;

      for (let i = 1; i < events.length; i++) {
        const prev = events[i - 1];
        const curr = events[i];
        const duration = curr.eventTime - prev.eventTime;

        if (duration > this.options.gapThresholdMs) {
          const gap: GapInfo = {
            sessionKey: session.sessionKey,
            gapStart: prev.eventTime,
            gapEnd: curr.eventTime,
            gapDuration: duration,
            previousEventTime: prev.eventTime,
            nextEventTime: curr.eventTime,
            previousShard: prev.shardId,
            nextShard: curr.shardId
          };
          session.gaps.push(gap);
          allGaps.push(gap);
        }
      }
    }

    return allGaps;
  }

  private async writeOutputs(
    sessions: Map<string, SessionEvents>,
    badRows: BadRow[],
    gaps: GapInfo[]
  ): Promise<ProcessingResult['outputFiles']> {
    const outputDir = this.options.outputDir;
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const prefix = this.options.outputPrefix;

    const sortedJsonlPath = path.join(outputDir, `${prefix}sorted.jsonl`);
    await this.writeSortedJsonl(sessions, sortedJsonlPath);

    const badRowsPath = path.join(outputDir, `${prefix}bad-rows.jsonl`);
    await this.writeBadRows(badRows, badRowsPath);

    const machineReadablePath = path.join(outputDir, `${prefix}result.json`);
    await this.writeMachineReadable(sessions, badRows, gaps, machineReadablePath);

    const reportPath = path.join(outputDir, `${prefix}report.md`);
    await this.writeReport(sessions, badRows, gaps, reportPath);

    return {
      sortedJsonl: sortedJsonlPath,
      machineReadable: machineReadablePath,
      report: reportPath,
      badRows: badRowsPath
    };
  }

  private async writeSortedJsonl(sessions: Map<string, SessionEvents>, filePath: string): Promise<void> {
    const stream = fs.createWriteStream(filePath, { encoding: 'utf-8' });

    const allEvents: ValidRow[] = [];
    for (const session of sessions.values()) {
      for (const event of session.events) {
        allEvents.push(event);
      }
    }
    allEvents.sort((a, b) => a.eventTime - b.eventTime);

    for (const event of allEvents) {
      const line = JSON.stringify(event.record);
      stream.write(line + '\n');
    }

    stream.end();
    return new Promise(resolve => stream.on('finish', resolve));
  }

  private async writeBadRows(badRows: BadRow[], filePath: string): Promise<void> {
    const stream = fs.createWriteStream(filePath, { encoding: 'utf-8' });

    for (const bad of badRows) {
      const line = JSON.stringify(bad);
      stream.write(line + '\n');
    }

    stream.end();
    return new Promise(resolve => stream.on('finish', resolve));
  }

  private async writeMachineReadable(
    sessions: Map<string, SessionEvents>,
    badRows: BadRow[],
    gaps: GapInfo[],
    filePath: string
  ): Promise<void> {
    const data = {
      metadata: {
        generatedAt: new Date().toISOString(),
        options: this.options
      },
      summary: {
        totalSessions: sessions.size,
        totalEvents: Array.from(sessions.values()).reduce((sum, s) => sum + s.events.length, 0),
        totalBadRows: badRows.length,
        totalGaps: gaps.length,
        uniqueShardIds: this.getUniqueShardIds(sessions)
      },
      gaps: gaps,
      badRows: badRows,
      sessions: Array.from(sessions.entries()).map(([key, session]) => ({
        sessionKey: key,
        eventCount: session.events.length,
        gapCount: session.gaps.length,
        shardIds: Array.from(session.shardIds),
        eventTimeRange: session.events.length > 0
          ? { min: session.events[0].eventTime, max: session.events[session.events.length - 1].eventTime }
          : null
      }))
    };

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  private getUniqueShardIds(sessions: Map<string, SessionEvents>): number[] {
    const allShards = new Set<number>();
    for (const session of sessions.values()) {
      for (const shard of session.shardIds) {
        allShards.add(shard);
      }
    }
    return Array.from(allShards).sort((a, b) => a - b);
  }

  private async writeReport(
    sessions: Map<string, SessionEvents>,
    badRows: BadRow[],
    gaps: GapInfo[],
    filePath: string
  ): Promise<void> {
    const lines: string[] = [];

    lines.push('# JSONL 乱序修复报告');
    lines.push('');
    lines.push(`生成时间: ${new Date().toLocaleString('zh-CN')}`);
    lines.push(`输入路径: ${this.options.input}`);
    lines.push(`会话字段: ${this.options.sessionKeyField}`);
    lines.push(`时间字段: ${this.options.eventTimeField}`);
    lines.push(`缺口阈值: ${this.options.gapThresholdMs}ms`);
    lines.push('');

    lines.push('## 📊 概览统计');
    lines.push('');
    lines.push('| 指标 | 数值 |');
    lines.push('|------|------|');
    lines.push(`| 处理文件数 | 1 (目录时为多个) |`);
    lines.push(`| 总行数 | ${Array.from(sessions.values()).reduce((sum, s) => sum + s.events.length, 0) + badRows.length} |`);
    lines.push(`| 有效行数 | ${Array.from(sessions.values()).reduce((sum, s) => sum + s.events.length, 0)} |`);
    lines.push(`| 坏行数 | ${badRows.length} |`);
    lines.push(`| 会话数 | ${sessions.size} |`);
    lines.push(`| 缺口数 | ${gaps.length} |`);
    lines.push('');

    if (gaps.length > 0) {
      lines.push('## ⚠️ 缺口详情');
      lines.push('');

      const totalGapMs = gaps.reduce((sum, g) => sum + g.gapDuration, 0);
      const maxGapMs = Math.max(...gaps.map(g => g.gapDuration));
      const avgGapMs = gaps.length > 0 ? totalGapMs / gaps.length : 0;

      lines.push(`- **总缺口时长**: ${this.formatDuration(totalGapMs)}`);
      lines.push(`- **最大缺口**: ${this.formatDuration(maxGapMs)}`);
      lines.push(`- **平均缺口**: ${this.formatDuration(avgGapMs)}`);
      lines.push('');

      lines.push('### TOP 10 最长缺口');
      lines.push('');
      lines.push('| 会话 | 缺口时长 | 前一事件时间 | 后一事件时间 | 前一分片 | 后一分片 |');
      lines.push('|------|----------|--------------|--------------|----------|----------|');

      const topGaps = [...gaps].sort((a, b) => b.gapDuration - a.gapDuration).slice(0, 10);
      for (const gap of topGaps) {
        lines.push(`| ${gap.sessionKey} | ${this.formatDuration(gap.gapDuration)} | ${new Date(gap.previousEventTime).toLocaleString('zh-CN')} | ${new Date(gap.nextEventTime).toLocaleString('zh-CN')} | ${gap.previousShard ?? '-'} | ${gap.nextShard ?? '-'} |`);
      }
      lines.push('');
    }

    if (badRows.length > 0) {
      lines.push('## ❌ 坏行详情');
      lines.push('');

      const errorCounts = new Map<string, number>();
      for (const bad of badRows) {
        errorCounts.set(bad.error, (errorCounts.get(bad.error) || 0) + 1);
      }

      lines.push('### 按错误类型统计');
      lines.push('');
      lines.push('| 错误类型 | 数量 |');
      lines.push('|----------|------|');
      for (const [error, count] of Array.from(errorCounts.entries()).sort((a, b) => b[1] - a[1])) {
        lines.push(`| ${error} | ${count} |`);
      }
      lines.push('');

      lines.push('### 坏行样本（前 10 条）');
      lines.push('');
      lines.push('| 文件 | 行号 | 错误原因 | 原始内容 |');
      lines.push('|------|------|----------|----------|');
      for (const bad of badRows.slice(0, 10)) {
        const shortContent = bad.rawContent.length > 50
          ? bad.rawContent.substring(0, 50) + '...'
          : bad.rawContent;
        lines.push(`| ${path.basename(bad.sourceFile)} | ${bad.lineNumber} | ${bad.error} | ${shortContent.replace(/\|/g, '\\|')} |`);
      }
      lines.push('');
    }

    lines.push('## 📁 输出文件');
    lines.push('');
    lines.push('本工具生成以下文件：');
    lines.push('- `*-sorted.jsonl`: 按时间排序后的有效数据');
    lines.push('- `*-bad-rows.jsonl`: 所有坏行，包含原始位置和错误原因');
    lines.push('- `*-result.json`: 机器可读的完整处理结果');
    lines.push('- `*-report.md`: 本报告文件');

    fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
  }

  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
    if (ms < 3600000) return `${(ms / 60000).toFixed(2)}m`;
    return `${(ms / 3600000).toFixed(2)}h`;
  }

  private buildResult(
    startTime: Date,
    endTime: Date,
    totalRows: number,
    validRows: number,
    badRows: number,
    uniqueSessions: number,
    totalGaps: number,
    outputFiles: ProcessingResult['outputFiles'],
    badRowDetails: BadRow[],
    gaps: GapInfo[]
  ): ProcessingResult {
    const totalGapDuration = gaps.reduce((sum, g) => sum + g.gapDuration, 0);
    const maxGapDuration = gaps.length > 0 ? Math.max(...gaps.map(g => g.gapDuration)) : 0;
    const avgGapDuration = gaps.length > 0 ? totalGapDuration / gaps.length : 0;

    const gapsBySession = new Map<string, number>();
    for (const gap of gaps) {
      gapsBySession.set(gap.sessionKey, (gapsBySession.get(gap.sessionKey) || 0) + 1);
    }

    return {
      options: this.options,
      startTime,
      endTime,
      totalFilesProcessed: 1,
      totalRowsRead: totalRows,
      validRows,
      badRows,
      uniqueSessions,
      totalGaps,
      outputFiles,
      badRowDetails,
      gapSummary: {
        totalGapDuration,
        avgGapDuration,
        maxGapDuration,
        gapsBySession
      }
    };
  }
}
