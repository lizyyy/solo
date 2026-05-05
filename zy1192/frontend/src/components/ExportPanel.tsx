import React, { useState } from 'react';
import { SimulationResult } from '../types';
import { apiService } from '../services/api';

interface ExportPanelProps {
  result: SimulationResult | null;
}

export const ExportPanel: React.FC<ExportPanelProps> = ({ result }) => {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<'markdown' | 'json' | null>(null);
  const [previewContent, setPreviewContent] = useState<string>('');

  if (!result) {
    return (
      <div className="empty-state">
        <h3>暂无模拟结果</h3>
        <p>请在配置面板中设置参数并运行模拟</p>
      </div>
    );
  }

  const generateMarkdownPreview = (): string => {
    const { config, metrics, threads, timeline, abaEvents, casOperations } = result;

    const lockTypeNames: Record<string, string> = {
      mutex: '互斥锁 (Mutex)',
      rwlock: '读写锁 (Read-Write Lock)',
      spinlock: '自旋锁 (Spin Lock)',
      cas: '比较并交换 (CAS)',
      'lock-free-queue': '无锁队列 (Lock-Free Queue)',
    };

    const contentionNames: Record<string, string> = {
      low: '低',
      medium: '中',
      high: '高',
    };

    const eventTypeNames: Record<string, string> = {
      lock_acquire_attempt: '尝试获取锁',
      lock_acquire_success: '获取锁成功',
      lock_acquire_failed: '获取锁失败',
      lock_release: '释放锁',
      cas_attempt: 'CAS 尝试',
      cas_success: 'CAS 成功',
      cas_failed: 'CAS 失败',
      enqueue_attempt: '入队尝试',
      enqueue_success: '入队成功',
      dequeue_attempt: '出队尝试',
      dequeue_success: '出队成功',
      spin_start: '自旋开始',
      spin_end: '自旋结束',
      wait_start: '等待开始',
      wait_end: '等待结束',
      thread_start: '线程开始',
      thread_end: '线程结束',
      aba_detected: 'ABA 事件检测',
    };

    let md = `# 并发原语可视化实验台 - 模拟报告

## 模拟配置

| 参数 | 值 |
|------|-----|
| 线程数量 | ${config.threadCount} |
| 锁类型 | ${lockTypeNames[config.lockType] || config.lockType} |
| 竞争强度 | ${contentionNames[config.contentionLevel] || config.contentionLevel} |
| 模拟时长 | ${config.duration} 步 |
| ABA 复现 | ${config.enableABAReproduction ? '已启用' : '未启用'} |

## 性能指标

| 指标 | 值 |
|------|-----|
| 总操作数 | ${metrics.totalOperations} |
| 成功操作数 | ${metrics.successfulOperations} |
| 失败操作数 | ${metrics.failedOperations} |
| 成功率 | ${metrics.totalOperations > 0 ? ((metrics.successfulOperations / metrics.totalOperations) * 100).toFixed(2) : 'N/A'}% |
| 总等待时间 | ${metrics.totalWaitTime.toFixed(2)} 单位 |
| 总自旋时间 | ${metrics.totalSpinTime.toFixed(2)} 单位 |
| 平均等待时间 | ${metrics.avgWaitTime.toFixed(2)} 单位 |
| 平均自旋时间 | ${metrics.avgSpinTime.toFixed(2)} 单位 |
| 吞吐量 | ${metrics.throughput.toFixed(2)} 操作/时间单位 |
| 竞争率 | ${(metrics.contentionRate * 100).toFixed(2)}% |
| ABA 事件数 | ${metrics.abaIncidents} |

## 线程状态

| 线程 ID | 名称 | 状态 | 开始时间 | 结束时间 |
|---------|------|------|----------|----------|
${threads.map((t) => `| ${t.id} | ${t.name} | ${t.state} | ${t.startTime} | ${t.endTime ?? '-'} |`).join('\n')}

`;

    if (abaEvents.length > 0) {
      md += `
## ABA 事件详情

| 时间戳 | 线程 ID | 类型 | 之前值 | 之后值 | 之前版本 | 之后版本 |
|--------|---------|------|--------|--------|----------|----------|
${abaEvents.map((e) => `| ${e.timestamp.toFixed(2)} | ${e.threadId} | ${e.type} | ${e.beforeValue ?? '-'} | ${e.afterValue ?? '-'} | ${e.beforeVersion} | ${e.afterVersion} |`).join('\n')}
`;
    }

    if (casOperations.length > 0) {
      md += `
## CAS 操作详情

| 时间戳 | 线程 ID | 期望值 | 新值 | 实际值 | 结果 |
|--------|---------|--------|------|--------|------|
${casOperations.map((op) => `| ${op.timestamp.toFixed(2)} | ${op.threadId} | ${op.expected} | ${op.newValue} | ${op.actualValue} | ${op.success ? '✅ 成功' : '❌ 失败'} |`).join('\n')}
`;
    }

    md += `
## 关键事件时间线

\`\`\`
${timeline.slice(0, 50).map((e) => `[${e.timestamp.toFixed(2)}] ${e.threadName}: ${eventTypeNames[e.eventType] || e.eventType} - ${JSON.stringify(e.details)}`).join('\n')}
${timeline.length > 50 ? `\n... (共 ${timeline.length} 个事件，显示前 50 个)` : ''}
\`\`\`

---
*报告生成时间: ${new Date().toISOString()}*
*版本: 1.0.0*
`;

    return md;
  };

  const generateJSONPreview = (): string => {
    const lockStatesObj: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(result.lockStates)) {
      lockStatesObj[key] = value;
    }

    const exportData = {
      ...result,
      lockStates: lockStatesObj,
      exportTime: new Date().toISOString(),
      version: '1.0.0',
    };

    return JSON.stringify(exportData, null, 2);
  };

  const handleExportMarkdown = async () => {
    setIsExporting(true);
    setError(null);

    try {
      const blob = await apiService.exportMarkdown(result);
      apiService.downloadBlob(blob, `simulation-report-${Date.now()}.md`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '导出失败');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportJSON = async () => {
    setIsExporting(true);
    setError(null);

    try {
      const blob = await apiService.exportJSON(result);
      apiService.downloadBlob(blob, `simulation-report-${Date.now()}.json`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '导出失败');
    } finally {
      setIsExporting(false);
    }
  };

  const showMarkdownPreview = () => {
    setPreviewType('markdown');
    setPreviewContent(generateMarkdownPreview());
  };

  const showJSONPreview = () => {
    setPreviewType('json');
    setPreviewContent(generateJSONPreview());
  };

  return (
    <div className="export-panel">
      <section className="export-section">
        <h2 className="section-title">导出报告</h2>

        {error && (
          <div className="error-message" style={{ marginBottom: 16 }}>
            {error}
          </div>
        )}

        <div className="export-buttons">
          <div
            className={`export-card ${isExporting ? 'disabled' : ''}`}
            onClick={!isExporting ? handleExportMarkdown : undefined}
          >
            <div className="export-icon">📄</div>
            <div className="export-name">Markdown 格式</div>
            <div className="export-desc">导出为结构化的 Markdown 文档，方便阅读和分享</div>
          </div>

          <div
            className={`export-card ${isExporting ? 'disabled' : ''}`}
            onClick={!isExporting ? handleExportJSON : undefined}
          >
            <div className="export-icon">📊</div>
            <div className="export-name">JSON 格式</div>
            <div className="export-desc">导出为结构化的 JSON 数据，方便后续处理和分析</div>
          </div>
        </div>

        {isExporting && (
          <div style={{ textAlign: 'center', marginTop: 20, color: '#667eea' }}>
            <div className="spinner" style={{ margin: '0 auto 12px' }}></div>
            <p>正在导出...</p>
          </div>
        )}
      </section>

      <section className="export-section">
        <h2 className="section-title">预览报告</h2>
        <div className="button-group" style={{ marginBottom: 20 }}>
          <button
            className={`btn ${previewType === 'markdown' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={showMarkdownPreview}
          >
            预览 Markdown
          </button>
          <button
            className={`btn ${previewType === 'json' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={showJSONPreview}
          >
            预览 JSON
          </button>
          {previewType && (
            <button className="btn btn-secondary" onClick={() => setPreviewType(null)}>
              关闭预览
            </button>
          )}
        </div>

        {previewType && (
          <div className="preview-section">
            <h3 style={{ marginBottom: 16, color: '#333' }}>
              {previewType === 'markdown' ? 'Markdown 报告预览' : 'JSON 数据预览'}
            </h3>
            <div className="preview-container">
              {previewType === 'markdown' ? (
                <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {previewContent}
                </pre>
              ) : (
                <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'monospace' }}>
                  {previewContent}
                </pre>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="export-section">
        <h2 className="section-title">导出说明</h2>
        <div className="chart-container" style={{ padding: '20px' }}>
          <h4 style={{ marginBottom: 12, color: '#333' }}>Markdown 报告包含以下内容：</h4>
          <ul style={{ paddingLeft: 20, lineHeight: 1.8, color: '#666' }}>
            <li><strong>模拟配置</strong> - 线程数、锁类型、竞争强度等参数</li>
            <li><strong>性能指标</strong> - 成功率、吞吐量、等待时间、自旋时间等</li>
            <li><strong>线程状态</strong> - 各线程的运行状态和时间</li>
            <li><strong>ABA 事件详情</strong> - 如果检测到 ABA 问题，包含详细信息</li>
            <li><strong>CAS 操作详情</strong> - 所有 CAS 操作的期望值、新值和结果</li>
            <li><strong>事件时间线</strong> - 关键事件的时间顺序记录</li>
          </ul>

          <h4 style={{ marginBottom: 12, marginTop: 24, color: '#333' }}>JSON 数据包含以下内容：</h4>
          <ul style={{ paddingLeft: 20, lineHeight: 1.8, color: '#666' }}>
            <li><strong>完整的配置信息</strong> - 所有模拟参数</li>
            <li><strong>所有线程信息</strong> - 线程状态、开始/结束时间</li>
            <li><strong>完整的事件时间线</strong> - 所有事件的详细记录</li>
            <li><strong>锁状态信息</strong> - 各锁的当前状态</li>
            <li><strong>CAS 操作记录</strong> - 所有 CAS 操作</li>
            <li><strong>ABA 事件记录</strong> - 所有检测到的 ABA 事件</li>
            <li><strong>性能指标统计</strong> - 汇总的性能数据</li>
          </ul>

          <h4 style={{ marginBottom: 12, marginTop: 24, color: '#333' }}>使用建议：</h4>
          <ul style={{ paddingLeft: 20, lineHeight: 1.8, color: '#666' }}>
            <li>使用 <strong>Markdown 格式</strong> 生成教学文档或演示报告</li>
            <li>使用 <strong>JSON 格式</strong> 进行数据分析或导入到其他工具</li>
            <li>先使用 <strong>预览功能</strong> 确认报告内容符合预期</li>
            <li>ABA 事件和 CAS 操作详情只在相关场景下才会包含</li>
          </ul>
        </div>
      </section>
    </div>
  );
};
