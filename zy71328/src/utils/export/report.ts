import type { AudioFile, LoudnessData, PeakMark, ProcessReport } from '../../types';

export function generateHtmlReport(
  audioFile: AudioFile,
  loudnessData: LoudnessData,
  peakMarks: PeakMark[],
  report: ProcessReport
): string {
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString('zh-CN');
  };

  const lufsDiff = report.processedLufs - report.originalLufs;
  const peakDiff = report.processedTruePeak - report.originalTruePeak;
  const fixedPeaks = peakMarks.filter(p => p.fixed).length;
  const unfixedPeaks = peakMarks.filter(p => !p.fixed).length;

  const peakListHtml = peakMarks.slice(0, 20).map(peak => `
    <tr>
      <td>${formatTime(peak.time)}</td>
      <td>${peak.value.toFixed(2)} dBTP</td>
      <td>${peak.type === 'clip' ? '削波' : peak.type === 'overshoot' ? '过冲' : '手动'}</td>
      <td>${peak.fixed ? '<span style="color: #10b981;">已修复</span>' : '<span style="color: #ef4444;">未修复</span>'}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>音频处理报告 - ${audioFile.name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; color: #1e293b; padding: 40px; }
    .container { max-width: 900px; margin: 0 auto; background: white; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); overflow: hidden; }
    .header { background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: white; padding: 32px; }
    .header h1 { font-size: 24px; font-weight: 600; margin-bottom: 8px; }
    .header p { opacity: 0.9; font-size: 14px; }
    .content { padding: 32px; }
    .section { margin-bottom: 32px; }
    .section h2 { font-size: 18px; font-weight: 600; margin-bottom: 16px; color: #334155; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; }
    .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
    .stat-card { background: #f1f5f9; border-radius: 8px; padding: 20px; }
    .stat-label { font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
    .stat-value { font-size: 24px; font-weight: 700; color: #1e293b; }
    .stat-value.positive { color: #10b981; }
    .stat-value.negative { color: #ef4444; }
    .stat-diff { font-size: 14px; font-weight: 500; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #e2e8f0; }
    th { background: #f1f5f9; font-weight: 600; font-size: 13px; color: #475569; }
    td { font-size: 14px; }
    .timeline { position: relative; padding-left: 24px; }
    .timeline::before { content: ''; position: absolute; left: 8px; top: 0; bottom: 0; width: 2px; background: #e2e8f0; }
    .timeline-item { position: relative; padding: 12px 0; }
    .timeline-item::before { content: ''; position: absolute; left: -20px; top: 16px; width: 10px; height: 10px; border-radius: 50%; background: #3b82f6; }
    .timeline-time { font-size: 12px; color: #64748b; margin-bottom: 4px; }
    .timeline-action { font-weight: 500; color: #1e293b; }
    .footer { background: #f8fafc; padding: 20px 32px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
    .info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    .info-item { font-size: 14px; }
    .info-label { color: #64748b; font-size: 12px; }
    .info-value { font-weight: 500; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>音频处理报告</h1>
      <p>${audioFile.name} · 生成于 ${formatDate(report.timestamp)}</p>
    </div>
    
    <div class="content">
      <div class="section">
        <h2>文件信息</h2>
        <div class="info-grid">
          <div class="info-item">
            <div class="info-label">文件名</div>
            <div class="info-value">${audioFile.name}</div>
          </div>
          <div class="info-item">
            <div class="info-label">时长</div>
            <div class="info-value">${formatTime(audioFile.duration)}</div>
          </div>
          <div class="info-item">
            <div class="info-label">格式</div>
            <div class="info-value">${audioFile.format.toUpperCase()}</div>
          </div>
          <div class="info-item">
            <div class="info-label">采样率</div>
            <div class="info-value">${audioFile.sampleRate} Hz</div>
          </div>
          <div class="info-item">
            <div class="info-label">声道数</div>
            <div class="info-value">${audioFile.channels}</div>
          </div>
          <div class="info-item">
            <div class="info-label">处理耗时</div>
            <div class="info-value">${report.duration.toFixed(2)}s</div>
          </div>
        </div>
      </div>

      <div class="section">
        <h2>响度统计</h2>
        <div class="grid">
          <div class="stat-card">
            <div class="stat-label">原始响度</div>
            <div class="stat-value">${report.originalLufs.toFixed(2)} LUFS</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">处理后响度</div>
            <div class="stat-value ${lufsDiff > 0 ? 'positive' : lufsDiff < 0 ? 'negative' : ''}">${report.processedLufs.toFixed(2)} LUFS</div>
            <div class="stat-diff ${lufsDiff > 0 ? 'positive' : lufsDiff < 0 ? 'negative' : ''}">${lufsDiff > 0 ? '+' : ''}${lufsDiff.toFixed(2)} LUFS</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">响度范围</div>
            <div class="stat-value">${loudnessData.rangeLufs.toFixed(2)} LU</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">目标响度</div>
            <div class="stat-value">${report.config.targetLufs.toFixed(2)} LUFS</div>
          </div>
        </div>
      </div>

      <div class="section">
        <h2>峰值检测结果</h2>
        <div class="grid">
          <div class="stat-card">
            <div class="stat-label">原始峰值</div>
            <div class="stat-value">${report.originalTruePeak.toFixed(2)} dBTP</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">处理后峰值</div>
            <div class="stat-value ${peakDiff < 0 ? 'positive' : ''}">${report.processedTruePeak.toFixed(2)} dBTP</div>
            <div class="stat-diff ${peakDiff < 0 ? 'positive' : ''}">${peakDiff > 0 ? '+' : ''}${peakDiff.toFixed(2)} dBTP</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">峰值限制</div>
            <div class="stat-value">${report.config.truePeakLimit.toFixed(2)} dBTP</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">峰值总数</div>
            <div class="stat-value">${peakMarks.length}</div>
          </div>
        </div>
      </div>

      <div class="section">
        <h2>爆音标记 (${fixedPeaks} 已修复 / ${unfixedPeaks} 未修复)</h2>
        <table>
          <thead>
            <tr>
              <th>时间</th>
              <th>峰值</th>
              <th>类型</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            ${peakMarks.length > 0 ? peakListHtml : '<tr><td colspan="4" style="text-align: center; color: #64748b;">未检测到峰值</td></tr>'}
          </tbody>
        </table>
        ${peakMarks.length > 20 ? `<p style="margin-top: 12px; font-size: 12px; color: #64748b;">仅显示前 20 条，共 ${peakMarks.length} 条记录</p>` : ''}
      </div>

      <div class="section">
        <h2>处理参数</h2>
        <div class="info-grid">
          <div class="info-item">
            <div class="info-label">自动增益</div>
            <div class="info-value">${report.config.enableAutoGain ? '启用' : '禁用'}</div>
          </div>
          <div class="info-item">
            <div class="info-label">峰值限制器</div>
            <div class="info-value">${report.config.enablePeakLimiter ? '启用' : '禁用'}</div>
          </div>
          <div class="info-item">
            <div class="info-label">压缩比</div>
            <div class="info-value">${report.config.compressorRatio}:1</div>
          </div>
          <div class="info-item">
            <div class="info-label">压缩阈值</div>
            <div class="info-value">${report.config.compressorThreshold.toFixed(2)} dB</div>
          </div>
          <div class="info-item">
            <div class="info-label">启动时间</div>
            <div class="info-value">${report.config.attackTime} ms</div>
          </div>
          <div class="info-item">
            <div class="info-label">释放时间</div>
            <div class="info-value">${report.config.releaseTime} ms</div>
          </div>
        </div>
      </div>

      <div class="section">
        <h2>处理时间线</h2>
        <div class="timeline">
          <div class="timeline-item">
            <div class="timeline-time">0.00s</div>
            <div class="timeline-action">开始分析音频文件</div>
          </div>
          <div class="timeline-item">
            <div class="timeline-time">${(report.duration * 0.3).toFixed(2)}s</div>
            <div class="timeline-action">响度分析完成，检测到 ${report.originalLufs.toFixed(2)} LUFS</div>
          </div>
          <div class="timeline-item">
            <div class="timeline-time">${(report.duration * 0.6).toFixed(2)}s</div>
            <div class="timeline-action">峰值检测完成，发现 ${peakMarks.length} 个峰值</div>
          </div>
          <div class="timeline-item">
            <div class="timeline-time">${(report.duration * 0.85).toFixed(2)}s</div>
            <div class="timeline-action">音频处理完成，修复 ${fixedPeaks} 个爆音</div>
          </div>
          <div class="timeline-item">
            <div class="timeline-time">${report.duration.toFixed(2)}s</div>
            <div class="timeline-action">报告生成完成</div>
          </div>
        </div>
      </div>
    </div>

    <div class="footer">
      <p>播客响度批量修正工具 · 报告由系统自动生成</p>
    </div>
  </div>
</body>
</html>`;
}
