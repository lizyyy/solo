import { format } from 'date-fns';
import type { Anomaly, Scheme } from '../types';
import { STATUS_LABELS, ANOMALY_TYPE_LABELS } from '../types';

export function exportScreenshot(
  canvas: HTMLCanvasElement,
  scheme: Scheme | null,
  anomalies: Anomaly[]
): void {
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = canvas.width;
  tempCanvas.height = canvas.height;
  const ctx = tempCanvas.getContext('2d');
  
  if (!ctx) return;
  
  ctx.drawImage(canvas, 0, 0);
  
  const padding = 20;
  const lineHeight = 24;
  const fontSize = 14;
  
  ctx.font = `${fontSize}px -apple-system, "Noto Sans SC", sans-serif`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 1;
  
  const now = new Date();
  const timeStr = format(now, 'yyyy-MM-dd HH:mm:ss');
  const schemeName = scheme?.name || '未命名方案';
  
  const statusCounts: Record<string, number> = {};
  anomalies.forEach(a => {
    const key = a.status;
    statusCounts[key] = (statusCounts[key] || 0) + 1;
  });
  
  const lines = [
    `方案: ${schemeName}`,
    `导出时间: ${timeStr}`,
    `异常统计: ${anomalies.length}条`,
    `  待处理: ${statusCounts.pending || 0}`,
    `  处理中: ${statusCounts.processing || 0}`,
    `  已完成: ${statusCounts.completed || 0}`,
    `  返工: ${statusCounts.rework || 0}`,
  ];
  
  const maxWidth = Math.max(...lines.map(l => ctx.measureText(l).width));
  const boxWidth = maxWidth + padding * 2;
  const boxHeight = lines.length * lineHeight + padding * 2;
  const boxX = tempCanvas.width - boxWidth - padding;
  const boxY = tempCanvas.height - boxHeight - padding;
  
  ctx.fillStyle = 'rgba(30, 58, 95, 0.85)';
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 8);
  ctx.fill();
  
  ctx.fillStyle = '#ffffff';
  lines.forEach((line, i) => {
    ctx.fillText(line, boxX + padding, boxY + padding + (i + 1) * lineHeight - 6);
  });
  
  const link = document.createElement('a');
  link.download = `吊装预演_${schemeName}_${format(now, 'yyyyMMdd_HHmmss')}.png`;
  link.href = tempCanvas.toDataURL('image/png');
  link.click();
}

export function copyToClipboard(canvas: HTMLCanvasElement): Promise<void> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) {
        reject(new Error('无法生成图片'));
        return;
      }
      
      try {
        navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]).then(resolve).catch(reject);
      } catch (e) {
        reject(e);
      }
    }, 'image/png');
  });
}

export function generateSummaryText(
  scheme: Scheme | null,
  anomalies: Anomaly[]
): string {
  const now = new Date();
  const statusCounts: Record<string, number> = {};
  const typeCounts: Record<string, number> = {};
  
  anomalies.forEach(a => {
    statusCounts[a.status] = (statusCounts[a.status] || 0) + 1;
    typeCounts[a.type] = (typeCounts[a.type] || 0) + 1;
  });
  
  let text = `# 桥梁施工吊装预演报告\n\n`;
  text += `方案名称: ${scheme?.name || '未命名方案'}\n`;
  text += `生成时间: ${format(now, 'yyyy-MM-dd HH:mm:ss')}\n`;
  text += `操作人员: ${scheme?.operator || '阿乔'}\n\n`;
  
  text += `## 异常统计\n\n`;
  text += `总计异常: ${anomalies.length} 条\n\n`;
  text += `| 状态 | 数量 |\n|------|------|\n`;
  Object.entries(statusCounts).forEach(([status, count]) => {
    text += `| ${STATUS_LABELS[status as keyof typeof STATUS_LABELS] || status} | ${count} |\n`;
  });
  
  text += `\n## 异常类型分布\n\n`;
  text += `| 类型 | 数量 |\n|------|------|\n`;
  Object.entries(typeCounts).forEach(([type, count]) => {
    text += `| ${ANOMALY_TYPE_LABELS[type as keyof typeof ANOMALY_TYPE_LABELS] || type} | ${count} |\n`;
  });
  
  text += `\n## 异常详情\n\n`;
  anomalies.forEach(a => {
    const pos = a.reportedPosition;
    text += `### ${ANOMALY_TYPE_LABELS[a.type]} - ${a.id}\n\n`;
    text += `- 状态: ${STATUS_LABELS[a.status]}\n`;
    text += `- 位置: (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)})\n`;
    text += `- 严重程度: ${a.severity}\n`;
    if (a.offsetDistance) {
      text += `- 偏移距离: ${a.offsetDistance.toFixed(2)}m\n`;
    }
    if (a.notes.length > 0) {
      text += `- 处理备注:\n`;
      a.notes.forEach(n => {
        text += `  - [${n.timestamp}] ${n.operator}: ${n.content} ${n.isSupplement ? '(补录)' : ''}\n`;
      });
    }
    text += `\n`;
  });
  
  return text;
}

export function downloadReport(
  scheme: Scheme | null,
  anomalies: Anomaly[]
): void {
  const text = generateSummaryText(scheme, anomalies);
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
  const link = document.createElement('a');
  link.download = `吊装预演报告_${scheme?.name || '未命名'}_${format(new Date(), 'yyyyMMdd_HHmmss')}.md`;
  link.href = URL.createObjectURL(blob);
  link.click();
}
