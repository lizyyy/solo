const chalk = require('chalk');
const Table = require('cli-table3');
import { ReplayResult, Anomaly, StateDiff, WebSocketFrame } from './types';

export class ReportGenerator {
  generate(result: ReplayResult): {
    terminal: string;
    machineReadable: string;
    html: string;
  } {
    return {
      terminal: this.generateTerminal(result),
      machineReadable: this.generateMachineReadable(result),
      html: this.generateHtml(result),
    };
  }

  private generateTerminal(result: ReplayResult): string {
    const lines: string[] = [];

    lines.push(chalk.bold.blue('\n' + '='.repeat(80)));
    lines.push(chalk.bold.blue('WebSocket 会话回放报告'));
    lines.push(chalk.bold.blue('='.repeat(80) + '\n'));

    lines.push(this.generateMetaSection(result));
    lines.push(this.generateAnomalySection(result));
    lines.push(this.generateFrameSummary(result));
    lines.push(this.generateStateDiffSection(result));
    lines.push(this.generateInvalidFramesSection(result));
    lines.push(this.generateFinalStateSection(result));

    return lines.join('\n');
  }

  private generateMetaSection(result: ReplayResult): string {
    const lines: string[] = [];
    lines.push(chalk.bold.yellow('📊 概览信息'));
    lines.push(chalk.gray('-'.repeat(60)));

    const table = new Table({
      head: ['项目', '值'],
      colWidths: [30, 50],
    });

    table.push(['输入文件', result.meta.inputFile || 'N/A']);
    table.push(['总行数', String(result.meta.totalLines)]);
    table.push(['有效帧', chalk.green(String(result.meta.validFrames))]);
    table.push(['无效帧', chalk.red(String(result.meta.invalidFrames))]);
    table.push(['开始时间', new Date(result.meta.startTime).toISOString()]);
    table.push(['结束时间', new Date(result.meta.endTime).toISOString()]);
    table.push(['会话时长', `${result.meta.durationMs}ms (${(result.meta.durationMs / 1000).toFixed(2)}s)`]);

    lines.push(table.toString());
    lines.push('');

    return lines.join('\n');
  }

  private generateAnomalySection(result: ReplayResult): string {
    const lines: string[] = [];

    if (result.anomalies.length === 0) {
      lines.push(chalk.bold.yellow('⚠️ 异常检测'));
      lines.push(chalk.gray('-'.repeat(60)));
      lines.push(chalk.green('  未检测到异常\n'));
      return lines.join('\n');
    }

    lines.push(chalk.bold.yellow('⚠️ 异常检测'));
    lines.push(chalk.gray('-'.repeat(60)));

    const severityColors: Record<string, any> = {
      critical: chalk.bgRed.white,
      high: chalk.red,
      medium: chalk.yellow,
      low: chalk.gray,
    };

    const table = new Table({
      head: ['序号', '严重程度', '类型', '帧索引', '行号', '消息'],
      colWidths: [6, 12, 12, 8, 8, 40],
    });

    result.anomalies.forEach((anomaly, index) => {
      const color = severityColors[anomaly.severity] || chalk.white;
      table.push([
        String(index + 1),
        color(anomaly.severity.toUpperCase()),
        anomaly.type,
        String(anomaly.frameIndex),
        String(anomaly.frame.lineNumber),
        anomaly.message,
      ]);
    });

    lines.push(table.toString());
    lines.push('');

    return lines.join('\n');
  }

  private generateFrameSummary(result: ReplayResult): string {
    const lines: string[] = [];
    lines.push(chalk.bold.yellow('🔄 帧统计'));
    lines.push(chalk.gray('-'.repeat(60)));

    const directionStats: Record<string, number> = {};
    const opcodeStats: Record<string, number> = {};

    result.frames.forEach(frame => {
      directionStats[frame.direction] = (directionStats[frame.direction] || 0) + 1;
      opcodeStats[frame.opcode] = (opcodeStats[frame.opcode] || 0) + 1;
    });

    const table = new Table({
      head: ['方向', '数量', '占比'],
      colWidths: [20, 10, 20],
    });

    Object.entries(directionStats).forEach(([dir, count]) => {
      const percent = ((count / result.meta.validFrames) * 100).toFixed(1) + '%';
      table.push([dir, String(count), percent]);
    });

    lines.push(table.toString());
    lines.push('');

    return lines.join('\n');
  }

  private generateStateDiffSection(result: ReplayResult): string {
    const lines: string[] = [];

    if (result.stateDiffs.length === 0) {
      lines.push(chalk.bold.yellow('🔀 状态变更'));
      lines.push(chalk.gray('-'.repeat(60)));
      lines.push(chalk.gray('  无状态变更\n'));
      return lines.join('\n');
    }

    lines.push(chalk.bold.yellow('🔀 状态变更 (前20条)'));
    lines.push(chalk.gray('-'.repeat(60)));

    const operationColors: Record<string, any> = {
      add: chalk.green,
      remove: chalk.red,
      update: chalk.yellow,
    };

    const table = new Table({
      head: ['帧索引', '操作', '路径', '值变更'],
      colWidths: [10, 10, 30, 40],
    });

    result.stateDiffs.slice(0, 20).forEach(diff => {
      const color = operationColors[diff.operation] || chalk.white;
      const oldVal = this.truncateValue(diff.oldValue, 15);
      const newVal = this.truncateValue(diff.newValue, 15);
      table.push([
        String(diff.frameIndex),
        color(diff.operation.toUpperCase()),
        diff.path,
        `${oldVal} → ${newVal}`,
      ]);
    });

    if (result.stateDiffs.length > 20) {
      lines.push(chalk.gray(`  显示前20条，共 ${result.stateDiffs.length} 条变更`));
    }

    lines.push(table.toString());
    lines.push('');

    return lines.join('\n');
  }

  private generateInvalidFramesSection(result: ReplayResult): string {
    const lines: string[] = [];
    const invalidFrames = result.frames.filter(f => !f.isValid);

    if (invalidFrames.length === 0) {
      return '';
    }

    lines.push(chalk.bold.yellow('❌ 解析失败的帧 (保留原始位置)'));
    lines.push(chalk.gray('-'.repeat(60)));

    invalidFrames.slice(0, 10).forEach(frame => {
      lines.push(chalk.red(`  [行 ${frame.lineNumber}] ${frame.parseError}`));
      lines.push(chalk.gray(`     原始内容: ${frame.raw.substring(0, 100)}${frame.raw.length > 100 ? '...' : ''}`));
    });

    if (invalidFrames.length > 10) {
      lines.push(chalk.gray(`  显示前10条，共 ${invalidFrames.length} 条解析失败`));
    }

    lines.push('');

    return lines.join('\n');
  }

  private generateFinalStateSection(result: ReplayResult): string {
    const lines: string[] = [];
    lines.push(chalk.bold.yellow('📋 最终状态'));
    lines.push(chalk.gray('-'.repeat(60)));

    const stateStr = JSON.stringify(result.finalState, null, 2);
    const truncated = stateStr.split('\n').slice(0, 30).join('\n');

    lines.push(chalk.cyan(truncated));

    if (stateStr.split('\n').length > 30) {
      lines.push(chalk.gray(`  (状态信息过长，已截断，完整内容请查看JSON报告)`));
    }

    lines.push('');

    return lines.join('\n');
  }

  private truncateValue(value: any, maxLen: number): string {
    if (value === undefined) return 'undefined';
    if (value === null) return 'null';

    const str = typeof value === 'string' ? value : JSON.stringify(value);
    if (str.length <= maxLen) return str;
    return str.substring(0, maxLen) + '...';
  }

  private generateMachineReadable(result: ReplayResult): string {
    return JSON.stringify(result, null, 2);
  }

  private generateHtml(result: ReplayResult): string {
    const severityClasses: Record<string, string> = {
      critical: 'bg-red-600 text-white',
      high: 'text-red-600 font-bold',
      medium: 'text-yellow-600',
      low: 'text-gray-500',
    };

    const operationClasses: Record<string, string> = {
      add: 'text-green-600',
      remove: 'text-red-600',
      update: 'text-yellow-600',
    };

    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WebSocket 会话回放报告</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        h1 { color: #1a365d; margin-bottom: 24px; border-bottom: 2px solid #3182ce; padding-bottom: 12px; }
        h2 { color: #2d3748; margin: 24px 0 16px; font-size: 1.25rem; }
        .section { margin-bottom: 24px; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #e2e8f0; }
        th { background: #edf2f7; font-weight: 600; color: #2d3748; }
        tr:hover { background: #f7fafc; }
        .meta-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px; }
        .meta-card { background: #f7fafc; padding: 16px; border-radius: 6px; }
        .meta-label { color: #718096; font-size: 0.875rem; margin-bottom: 4px; }
        .meta-value { color: #2d3748; font-size: 1.125rem; font-weight: 600; }
        .bad-row { background: #fff5f5; }
        .code { background: #1a202c; color: #e2e8f0; padding: 16px; border-radius: 6px; font-family: 'Monaco', monospace; font-size: 0.875rem; overflow-x: auto; white-space: pre-wrap; }
        .tabs { display: flex; gap: 8px; margin-bottom: 16px; border-bottom: 1px solid #e2e8f0; }
        .tab { padding: 8px 16px; cursor: pointer; border: none; background: none; color: #718096; font-size: 0.875rem; }
        .tab.active { color: #3182ce; border-bottom: 2px solid #3182ce; font-weight: 600; }
        .tab-content { display: none; }
        .tab-content.active { display: block; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔌 WebSocket 会话回放报告</h1>

        <div class="section">
            <h2>📊 概览信息</h2>
            <div class="meta-grid">
                <div class="meta-card">
                    <div class="meta-label">输入文件</div>
                    <div class="meta-value">${result.meta.inputFile || 'N/A'}</div>
                </div>
                <div class="meta-card">
                    <div class="meta-label">总行数</div>
                    <div class="meta-value">${result.meta.totalLines}</div>
                </div>
                <div class="meta-card">
                    <div class="meta-label">有效帧</div>
                    <div class="meta-value" style="color: #38a169">${result.meta.validFrames}</div>
                </div>
                <div class="meta-card">
                    <div class="meta-label">无效帧</div>
                    <div class="meta-value" style="color: #e53e3e">${result.meta.invalidFrames}</div>
                </div>
                <div class="meta-card">
                    <div class="meta-label">开始时间</div>
                    <div class="meta-value">${new Date(result.meta.startTime).toLocaleString()}</div>
                </div>
                <div class="meta-card">
                    <div class="meta-label">会话时长</div>
                    <div class="meta-value">${(result.meta.durationMs / 1000).toFixed(2)}s</div>
                </div>
            </div>
        </div>

        <div class="tabs">
            <button class="tab active" onclick="showTab('anomalies')">异常 (${result.anomalies.length})</button>
            <button class="tab" onclick="showTab('frames')">帧列表</button>
            <button class="tab" onclick="showTab('diffs')">状态变更</button>
            <button class="tab" onclick="showTab('state')">最终状态</button>
        </div>

        <div id="anomalies" class="tab-content active">
            <div class="section">
                <h2>⚠️ 异常检测 (${result.anomalies.length})</h2>
                ${result.anomalies.length > 0 ? `
                <table>
                    <thead>
                        <tr><th>#</th><th>严重程度</th><th>类型</th><th>帧索引</th><th>行号</th><th>消息</th></tr>
                    </thead>
                    <tbody>
                        ${result.anomalies.map((a, i) => `
                            <tr>
                                <td>${i + 1}</td>
                                <td><span class="${severityClasses[a.severity]}">${a.severity.toUpperCase()}</span></td>
                                <td>${a.type}</td>
                                <td>${a.frameIndex}</td>
                                <td>${a.frame.lineNumber}</td>
                                <td>${a.message}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                ` : '<p style="color: #718096; padding: 16px;">未检测到异常</p>'}
            </div>
        </div>

        <div id="frames" class="tab-content">
            <div class="section">
                <h2>🔄 帧列表 (${result.frames.length})</h2>
                <table>
                    <thead>
                        <tr><th>#</th><th>时间</th><th>方向</th><th>Opcode</th><th>Payload</th></tr>
                    </thead>
                    <tbody>
                        ${result.frames.map((f, i) => `
                            <tr class="${f.isValid ? '' : 'bad-row'}">
                                <td>${i}</td>
                                <td style="font-size: 0.75rem; color: #718096;">${new Date(f.timestamp).toLocaleTimeString()}</td>
                                <td>${f.direction}</td>
                                <td>${f.opcode}</td>
                                <td style="max-width: 400px; overflow: hidden; text-overflow: ellipsis;">${this.escapeHtml(f.payload.substring(0, 100))}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>

        <div id="diffs" class="tab-content">
            <div class="section">
                <h2>🔀 状态变更 (${result.stateDiffs.length})</h2>
                ${result.stateDiffs.length > 0 ? `
                <table>
                    <thead>
                        <tr><th>帧索引</th><th>操作</th><th>路径</th><th>旧值</th><th>新值</th></tr>
                    </thead>
                    <tbody>
                        ${result.stateDiffs.map(d => `
                            <tr>
                                <td>${d.frameIndex}</td>
                                <td><span class="${operationClasses[d.operation]}">${d.operation.toUpperCase()}</span></td>
                                <td><code>${d.path}</code></td>
                                <td style="font-size: 0.75rem;">${this.truncateValue(d.oldValue, 30)}</td>
                                <td style="font-size: 0.75rem;">${this.truncateValue(d.newValue, 30)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                ` : '<p style="color: #718096; padding: 16px;">无状态变更</p>'}
            </div>
        </div>

        <div id="state" class="tab-content">
            <div class="section">
                <h2>📋 最终状态</h2>
                <div class="code">${this.escapeHtml(JSON.stringify(result.finalState, null, 2))}</div>
            </div>
        </div>
    </div>

    <script>
        function showTab(tabId) {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            event?.target?.classList.add('active');
            document.getElementById(tabId)?.classList.add('active');
        }
    </script>
</body>
</html>
    `.trim();
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
