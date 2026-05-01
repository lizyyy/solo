import * as fs from 'fs';
import { Conflict, Operation, Client, TimelineEvent } from './types';

export class ReportGenerator {
  static generateFinalDocument(content: string, outputPath: string): void {
    fs.writeFileSync(outputPath, content, 'utf-8');
  }

  static generateMarkdownReport(
    conflicts: Conflict[],
    clients: Map<string, Client>,
    operations: Operation[],
    outputPath: string
  ): void {
    const conflictSummary = {
      concurrentInsert: conflicts.filter(c => c.type === 'concurrent_insert').length,
      invalidDelete: conflicts.filter(c => c.type === 'invalid_delete').length,
      undoNotFound: conflicts.filter(c => c.type === 'undo_not_found').length
    };

    let markdown = `# CRDT 操作回放报告

## 概览

- **操作总数**: ${operations.length}
- **冲突总数**: ${conflicts.length}
- **并发插入冲突**: ${conflictSummary.concurrentInsert}
- **无效删除冲突**: ${conflictSummary.invalidDelete}
- **撤销目标不存在**: ${conflictSummary.undoNotFound}

## 客户端信息

| ID | 名称 | 颜色 |
|---|---|---|
${Array.from(clients.entries()).map(([id, client]) => `| ${id} | ${client.name} | ${client.color} |`).join('\n')}

## 冲突详情

${conflicts.length === 0 ? '无冲突' : conflicts.map((conflict, index) => `### 冲突 ${index + 1}

**类型**: ${this.getConflictTypeName(conflict.type)}
**操作ID**: ${conflict.op.id}
**客户端**: ${clients.get(conflict.op.clientId)?.name || conflict.op.clientId}
**时间戳**: ${new Date(conflict.op.timestamp).toISOString()}
**描述**: ${conflict.description}

**涉及客户端**:
${conflict.affectedClients.map(id => `- ${clients.get(id)?.name || id}`).join('\n')}

**操作详情**:
\`\`\`json
${JSON.stringify(conflict.op, null, 2)}
\`\`\`
`).join('\n')}

## 操作列表

| ID | 类型 | 客户端 | 位置 | 字符 | 时间戳 |
|---|---|---|---|---|---|
${operations.map(op => `| ${op.id} | ${op.type} | ${clients.get(op.clientId)?.name || op.clientId} | ${op.position} | ${op.char || '-'} | ${new Date(op.timestamp).toISOString()} |`).join('\n')}
`;

    fs.writeFileSync(outputPath, markdown, 'utf-8');
  }

  static generateHTMLTimeline(
    timelineEvents: TimelineEvent[],
    clients: Map<string, Client>,
    outputPath: string
  ): void {
    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CRDT 操作时间线</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #1a1a2e; color: #fff; line-height: 1.6; }
    .header { background: #16213e; padding: 20px; text-align: center; border-bottom: 1px solid #0f3460; }
    .header h1 { font-size: 24px; margin-bottom: 10px; }
    .header p { color: #888; font-size: 14px; }
    .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
    .legend { display: flex; gap: 20px; margin-bottom: 20px; padding: 15px; background: #16213e; border-radius: 8px; }
    .legend-item { display: flex; align-items: center; gap: 8px; }
    .legend-color { width: 20px; height: 20px; border-radius: 4px; }
    .legend-label { font-size: 14px; }
    .timeline { position: relative; padding-left: 60px; }
    .timeline::before { content: ''; position: absolute; left: 15px; top: 0; bottom: 0; width: 2px; background: #0f3460; }
    .event { position: relative; margin-bottom: 20px; padding: 20px; background: #16213e; border-radius: 8px; transition: transform 0.2s; }
    .event:hover { transform: translateX(5px); }
    .event::before { content: ''; position: absolute; left: -52px; top: 20px; width: 24px; height: 24px; border-radius: 50%; background: ${this.getDefaultColor()}; border: 3px solid #1a1a2e; }
    .event.conflict::before { background: #e94560; }
    .event-time { position: absolute; left: -50px; top: 25px; font-size: 12px; color: #888; width: 40px; text-align: right; }
    .event-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
    .event-type { padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: bold; text-transform: uppercase; }
    .event-type.insert { background: #00d2d3; color: #1a1a2e; }
    .event-type.delete { background: #e94560; color: #fff; }
    .event-type.undo { background: #ff9ff3; color: #1a1a2e; }
    .event-client { display: flex; align-items: center; gap: 8px; }
    .client-color { width: 16px; height: 16px; border-radius: 4px; }
    .client-name { font-weight: bold; }
    .event-details { margin-bottom: 10px; color: #aaa; font-size: 14px; }
    .event-doc { background: #0f3460; padding: 15px; border-radius: 4px; font-family: 'Monaco', 'Menlo', monospace; font-size: 14px; white-space: pre-wrap; word-break: break-all; }
    .conflict-badge { display: inline-block; padding: 4px 10px; background: #e94560; color: #fff; border-radius: 4px; font-size: 12px; margin-top: 10px; }
    .conflict-desc { color: #e94560; margin-top: 8px; font-size: 14px; }
    .stats { display: flex; gap: 30px; margin-bottom: 20px; padding: 20px; background: #16213e; border-radius: 8px; }
    .stat-item { text-align: center; }
    .stat-value { font-size: 32px; font-weight: bold; color: #00d2d3; }
    .stat-label { font-size: 14px; color: #888; }
  </style>
</head>
<body>
  <div class="header">
    <h1>CRDT 操作时间线可视化</h1>
    <p>多人编辑器离线操作日志回放</p>
  </div>
  
  <div class="container">
    <div class="stats">
      <div class="stat-item">
        <div class="stat-value">${timelineEvents.length}</div>
        <div class="stat-label">总操作数</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">${timelineEvents.filter(e => e.conflict).length}</div>
        <div class="stat-label">冲突数</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">${clients.size}</div>
        <div class="stat-label">客户端数</div>
      </div>
    </div>

    <div class="legend">
      ${Array.from(clients.entries()).map(([id, client]) => `
      <div class="legend-item">
        <div class="legend-color" style="background: ${client.color}"></div>
        <div class="legend-label">${client.name}</div>
      </div>
      `).join('')}
    </div>

    <div class="timeline">
      ${timelineEvents.map((event, index) => `
      <div class="event ${event.conflict ? 'conflict' : ''}">
        <div class="event-time">${index + 1}</div>
        <div class="event-header">
          <span class="event-type ${event.operation.type}">${this.getOperationTypeName(event.operation.type)}</span>
          <div class="event-client">
            <div class="client-color" style="background: ${event.client.color}"></div>
            <span class="client-name">${event.client.name}</span>
          </div>
        </div>
        <div class="event-details">
          位置: ${event.operation.position}
          ${event.operation.char ? `| 字符: "${event.operation.char}"` : ''}
          | 时间: ${new Date(event.operation.timestamp).toLocaleString('zh-CN')}
        </div>
        <div class="event-doc">${this.escapeHtml(event.documentState) || '(空文档)'}</div>
        ${event.conflict ? `
        <div class="conflict-badge">冲突</div>
        <div class="conflict-desc">${this.escapeHtml(event.conflict.description)}</div>
        ` : ''}
      </div>
      `).join('')}
    </div>
  </div>
</body>
</html>`;

    fs.writeFileSync(outputPath, html, 'utf-8');
  }

  private static getConflictTypeName(type: string): string {
    switch (type) {
      case 'concurrent_insert': return '并发插入';
      case 'invalid_delete': return '无效删除';
      case 'undo_not_found': return '撤销目标不存在';
      default: return type;
    }
  }

  private static getOperationTypeName(type: string): string {
    switch (type) {
      case 'insert': return '插入';
      case 'delete': return '删除';
      case 'undo': return '撤销';
      default: return type;
    }
  }

  private static getDefaultColor(): string {
    return '#00d2d3';
  }

  private static escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}