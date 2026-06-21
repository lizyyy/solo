import type { Anomaly, Material, Station } from '@/types';
import { anomalyTypeLabels, severityLabels, sourceTypeLabels } from '@/utils/anomalyDetector';

const generateId = () => Math.random().toString(36).substring(2, 9);

const triggerDownload = (content: string, filename: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const formatDate = (date: Date = new Date()): string => {
  return date.toISOString().slice(0, 10);
};

export const exportAnomalyReport = (
  anomalies: Anomaly[],
  materials: Material[],
  stations: Station[],
  format: 'csv' | 'markdown' | 'all' = 'all'
): void => {
  const dateStr = formatDate();
  const filename = `海洋牧场异常报告_${dateStr}.csv`;

  const headers = [
    '异常编号',
    '异常类型',
    '严重程度',
    '涉及点位',
    '点位编号',
    '异常描述',
    '影响范围',
    '来源材料',
    '来源行号',
    '证据状态',
    '结论变化说明',
    '检测时间',
  ];

  const rows = anomalies.map(a => [
    a.id,
    anomalyTypeLabels[a.type] || a.type,
    severityLabels[a.severity] || a.severity,
    a.stationName,
    a.stationId,
    a.description,
    a.impactRange,
    a.materialNames.join(' | '),
    a.sourceRows.join(', '),
    a.status === 'confirmed' ? '已确认' : '待补证据',
    a.conclusionChange,
    a.detectedAt,
  ]);

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => {
      const escaped = String(cell).replace(/"/g, '""');
      return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
    }).join(','))
    .join('\n');

  const summaryContent = generateAnomalySummary(anomalies, materials, stations);

  if (format === 'csv' || format === 'all') {
    triggerDownload('\ufeff' + csvContent, filename, 'text/csv;charset=utf-8');
  }
  if (format === 'markdown' || format === 'all') {
    const delay = format === 'all' ? 300 : 0;
    setTimeout(() => {
      triggerDownload(
        summaryContent,
        `海洋牧场异常报告_${dateStr}_详情.md`,
        'text/markdown;charset=utf-8'
      );
    }, delay);
  }
};

const generateAnomalySummary = (
  anomalies: Anomaly[],
  materials: Material[],
  stations: Station[]
): string => {
  const dateStr = formatDate();
  const byType = new Map<string, Anomaly[]>();
  const bySeverity = new Map<string, Anomaly[]>();
  const byStatus = new Map<string, Anomaly[]>();
  const byStation = new Map<string, Anomaly[]>();

  anomalies.forEach(a => {
    if (!byType.has(a.type)) byType.set(a.type, []);
    byType.get(a.type)!.push(a);
    if (!bySeverity.has(a.severity)) bySeverity.set(a.severity, []);
    bySeverity.get(a.severity)!.push(a);
    if (!byStatus.has(a.status)) byStatus.set(a.status, []);
    byStatus.get(a.status)!.push(a);
    if (!byStation.has(a.stationId)) byStation.set(a.stationId, []);
    byStation.get(a.stationId)!.push(a);
  });

  let md = `# 海洋牧场异常预警报告\n\n`;
  md += `**生成日期**：${dateStr}\n\n`;
  md += `---\n\n`;

  md += `## 一、总体概览\n\n`;
  md += `| 指标 | 数量 |\n|------|------|\n`;
  md += `| 异常总数 | **${anomalies.length}** |\n`;
  md += `| 高风险 | ${bySeverity.get('high')?.length || 0} |\n`;
  md += `| 中风险 | ${bySeverity.get('medium')?.length || 0} |\n`;
  md += `| 低风险 | ${bySeverity.get('low')?.length || 0} |\n`;
  md += `| 已确认 | ${byStatus.get('confirmed')?.length || 0} |\n`;
  md += `| 待补证据 | ${byStatus.get('pending')?.length || 0} |\n`;
  md += `| 涉及材料 | ${materials.length} 份 |\n`;
  md += `| 涉及点位 | ${byStation.size} 个 |\n\n`;

  md += `## 二、材料清单\n\n`;
  materials.forEach(m => {
    md += `### ${m.name}\n\n`;
    md += `- **来源类型**：${sourceTypeLabels[m.source]}\n`;
    md += `- **版本号**：v${m.version}\n`;
    md += `- **上传时间**：${m.uploadTime}\n`;
    md += `- **数据条数**：${m.parsedData.length}\n`;
    if (m.description) md += `- **备注**：${m.description}\n`;
    md += `\n`;
  });

  md += `## 三、异常类型分布\n\n`;
  Array.from(byType.entries()).forEach(([type, list]) => {
    md += `### ${anomalyTypeLabels[type] || type}（${list.length}条）\n\n`;
    list.forEach(a => {
      md += `#### [${a.id.slice(-6).toUpperCase()}] ${a.stationName}\n\n`;
      md += `- **严重程度**：${severityLabels[a.severity]}\n`;
      md += `- **异常描述**：${a.description}\n`;
      md += `- **影响范围**：${a.impactRange}\n`;
      md += `- **来源行号**：第 ${a.sourceRows.join(', ')} 行\n`;
      md += `- **涉及材料**：${a.materialNames.join('、')}\n`;
      md += `- **证据状态**：${a.status === 'confirmed' ? '已确认' : '待补证据'}\n`;
      md += `\n`;
    });
  });

  md += `## 四、点位异常汇总\n\n`;
  md += `| 点位 | 异常数 | 高风险 | 中风险 | 低风险 |\n|------|--------|--------|--------|--------|\n`;
  stations.forEach(s => {
    const list = byStation.get(s.id) || [];
    md += `| ${s.name} | ${list.length} | `;
    md += `${list.filter(x => x.severity === 'high').length} | `;
    md += `${list.filter(x => x.severity === 'medium').length} | `;
    md += `${list.filter(x => x.severity === 'low').length} |\n`;
  });
  md += `\n---\n\n`;
  md += `*本报告由海洋牧场异常预警系统自动生成*`;

  return md;
};

export const exportReviewReport = (
  anomalies: Anomaly[],
  materials: Material[],
  stations: Station[],
  format: 'markdown' | 'html' | 'all' = 'all'
): void => {
  const dateStr = formatDate();
  const confirmed = anomalies.filter(a => a.status === 'confirmed');
  const pending = anomalies.filter(a => a.status === 'pending');

  const md = generateReviewMarkdown(anomalies, confirmed, pending, materials, stations);
  const htmlContent = markdownToHtml(md);

  if (format === 'markdown' || format === 'all') {
    triggerDownload(md, `海洋牧场复核报告_${dateStr}.md`, 'text/markdown;charset=utf-8');
  }
  if (format === 'html' || format === 'all') {
    const delay = format === 'all' ? 300 : 0;
    setTimeout(() => {
      triggerDownload(htmlContent, `海洋牧场复核报告_${dateStr}.html`, 'text/html;charset=utf-8');
    }, delay);
  }
};

const generateReviewMarkdown = (
  all: Anomaly[],
  confirmed: Anomaly[],
  pending: Anomaly[],
  materials: Material[],
  stations: Station[]
): string => {
  const dateStr = formatDate();
  const highRiskPending = pending.filter(a => a.severity === 'high');

  let md = `# 海洋牧场异常预警复核报告\n\n`;
  md += `<div style="color:#666; font-size:14px;">\n\n`;
  md += `**报告日期**：${dateStr}　|　`;
  md += `**复核范围**：${materials.length}份材料 / ${stations.length}个监测点位\n\n`;
  md += `</div>\n\n---\n\n`;

  md += `## 一、复核结论\n\n`;

  if (highRiskPending.length > 0) {
    md += `> ⚠️ **存在 ${highRiskPending.length} 条高风险异常待补充证据**，建议补齐后再进行社区公示。\n\n`;
  } else if (pending.length > 0) {
    md += `> 🟡 **存在 ${pending.length} 条异常待补充证据**，中低风险项目可公示后跟进。\n\n`;
  } else {
    md += `> ✅ **所有异常均已确认**，数据口径一致，可提交社区公示。\n\n`;
  }

  md += `| 项目 | 数量 |\n|------|------|\n`;
  md += `| 异常总数 | **${all.length}** |\n`;
  md += `| ✅ 已确认证据 | **${confirmed.length}** |\n`;
  md += `| ⏳ 待补证据 | **${pending.length}** |\n`;
  md += `| 🔴 其中高风险待补 | ${highRiskPending.length} |\n\n`;

  md += `## 二、已确认证据（可直接用于沟通）\n\n`;

  if (confirmed.length === 0) {
    md += `_暂无已确认异常，请在复核页面点击"标记确认"。_\n\n`;
  } else {
    confirmed.forEach((a, idx) => {
      md += `### ${idx + 1}. [${anomalyTypeLabels[a.type]}] ${a.stationName}\n\n`;
      md += `- **严重程度**：${severityLabels[a.severity]}\n`;
      md += `- **问题描述**：${a.description}\n`;
      md += `- **影响范围**：${a.impactRange}\n`;
      md += `- **来源**：第 ${a.sourceRows.join(', ')} 行（${a.materialNames.join('、')}）\n`;
      md += `- **结论变化**：${a.conclusionChange}\n\n`;

      if (a.evidenceChain.length > 0) {
        md += `**证据链：**\n\n`;
        a.evidenceChain.forEach((ev, ei) => {
          const icon = ev.isVerbal ? '💬' : '📄';
          md += `${ei + 1}. ${icon} **${ev.materialName}**（v${ev.version}，${ev.timestamp.slice(0, 19)}）\n`;
          if (ev.previousValue && ev.currentValue) {
            md += `   - ~~${ev.previousValue}~~ → **${ev.currentValue}**\n`;
          } else {
            md += `   - ${ev.content}\n`;
          }
        });
        md += `\n`;
      }
      md += `---\n\n`;
    });
  }

  md += `## 三、待补证据（需跟进事项）\n\n`;

  if (pending.length === 0) {
    md += `_所有异常证据均已确认，无需补充。_\n\n`;
  } else {
    md += `| 序号 | 类型 | 点位 | 严重度 | 待补内容 | 涉及材料 |\n`;
    md += `|------|------|------|--------|----------|----------|\n`;
    pending.forEach((a, idx) => {
      md += `| ${idx + 1} | ${anomalyTypeLabels[a.type]} | ${a.stationName} | `;
      md += `${severityLabels[a.severity]} | ${a.description.slice(0, 30)}${a.description.length > 30 ? '...' : ''} | `;
      md += `${a.materialNames.join('/')} |\n`;
    });
    md += `\n`;

    md += `### 补充建议\n\n`;
    highRiskPending.forEach((a, idx) => {
      md += `${idx + 1}. **${a.stationName} - ${anomalyTypeLabels[a.type]}**\n`;
      md += `   - 问题：${a.description}\n`;
      md += `   - 需补充：请核实 ${a.materialNames.join('、')} 第 ${a.sourceRows.join('/')} 行的原始记录\n`;
      md += `   - 说明：${a.conclusionChange}\n\n`;
    });
    const otherPending = pending.filter(a => a.severity !== 'high');
    if (otherPending.length > 0) {
      md += `${highRiskPending.length + 1}. 其余 ${otherPending.length} 条中低风险异常可在公示后 3 个工作日内补齐佐证。\n\n`;
    }
  }

  md += `## 四、口径变更追踪\n\n`;

  const caliberChanges = all.filter(a => a.type === 'caliber_change');
  if (caliberChanges.length === 0) {
    md += `_未检测到跨材料的口径变更。_\n\n`;
  } else {
    md += `| 点位 | 指标 | 原始值 | 最新值 | 变化幅度 | 变更材料 |\n`;
    md += `|------|------|--------|--------|----------|----------|\n`;
    caliberChanges.forEach(a => {
      const first = a.evidenceChain[0];
      const last = a.evidenceChain[a.evidenceChain.length - 1];
      const prev = first?.currentValue || '-';
      const curr = last?.currentValue || '-';
      const prevNum = parseFloat(prev);
      const currNum = parseFloat(curr);
      const change = (!isNaN(prevNum) && !isNaN(currNum) && prevNum !== 0)
        ? `${(((currNum - prevNum) / prevNum) * 100).toFixed(1)}%`
        : '-';
      md += `| ${a.stationName} | ${a.fieldName || '-'} | ${prev} | ${curr} | ${change} | ${a.materialNames[a.materialNames.length - 1]} |\n`;
    });
    md += `\n`;
  }

  md += `## 五、材料版本时间线\n\n`;
  const sortedMaterials = [...materials].sort(
    (a, b) => new Date(b.uploadTime).getTime() - new Date(a.uploadTime).getTime()
  );
  sortedMaterials.forEach((m, idx) => {
    const tag = m.isLatest ? ` ⭐ **最新版本**` : '';
    md += `${idx + 1}. **${m.name}**${tag}\n`;
    md += `   - 类型：${sourceTypeLabels[m.source]} · 版本 v${m.version}\n`;
    md += `   - 录入时间：${m.uploadTime}\n`;
    if (m.description) md += `   - 备注：${m.description}\n`;
  });
  md += `\n`;

  md += `---\n\n`;
  md += `<div style="color:#888; font-size:12px; text-align:center;">\n\n`;
  md += `本报告由海洋牧场异常预警系统自动生成 ｜ 复核人：________ 日期：________\n\n`;
  md += `</div>`;

  return md;
};

const markdownToHtml = (md: string): string => {
  let html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>海洋牧场复核报告</title>
<style>
body { font-family: -apple-system, "Segoe UI", "PingFang SC", sans-serif; max-width: 900px; margin: 40px auto; padding: 0 24px; color: #072840; line-height: 1.7; }
h1 { color: #0B3D5C; border-bottom: 3px solid #1A7A9A; padding-bottom: 12px; }
h2 { color: #0B3D5C; margin-top: 36px; border-left: 4px solid #1A7A9A; padding-left: 12px; }
h3 { color: #136582; margin-top: 24px; }
h4 { color: #0F4F66; }
table { border-collapse: collapse; width: 100%; margin: 16px 0; font-size: 14px; }
th, td { border: 1px solid #B7D7E5; padding: 8px 12px; text-align: left; }
th { background: #DCEBF2; color: #0B3D5C; font-weight: 600; }
tr:nth-child(even) td { background: #F0F7FA; }
blockquote { background: #FFF7F0; border-left: 4px solid #FF7A45; padding: 12px 16px; margin: 16px 0; border-radius: 4px; color: #663300; }
code { background: #F0F7FA; padding: 2px 6px; border-radius: 3px; font-size: 13px; }
hr { border: none; border-top: 1px solid #B7D7E5; margin: 28px 0; }
div[style] { padding: 8px 0; }
</style>
</head>
<body>
`;

  const lines = md.split('\n');
  let inBlockquote = false;
  let inTable = false;
  let tableRows: string[] = [];

  const flushTable = () => {
    if (tableRows.length < 2) { tableRows = []; inTable = false; return; }
    html += '<table><thead><tr>';
    tableRows[0].split('|').filter(Boolean).forEach(cell => {
      html += `<th>${cell.trim()}</th>`;
    });
    html += '</tr></thead><tbody>';
    for (let i = 2; i < tableRows.length; i++) {
      html += '<tr>';
      tableRows[i].split('|').filter(Boolean).forEach(cell => {
        const inner = cell.trim()
          .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
          .replace(/~~(.+?)~~/g, '<del>$1</del>')
          .replace(/_([^_]+?)_/g, '<em>$1</em>');
        html += `<td>${inner}</td>`;
      });
      html += '</tr>';
    }
    html += '</tbody></table>';
    tableRows = [];
    inTable = false;
  };

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    if (line.trim().startsWith('|')) {
      if (!inTable) { inTable = true; tableRows = []; }
      tableRows.push(line);
      continue;
    } else if (inTable) {
      flushTable();
    }

    if (inBlockquote && !line.startsWith('>')) {
      html += '</blockquote>';
      inBlockquote = false;
    }

    if (line.startsWith('```')) continue;
    if (line.startsWith('---')) { html += '<hr>'; continue; }
    if (line.startsWith('###### ')) { html += `<h6>${line.slice(7)}</h6>`; continue; }
    if (line.startsWith('##### ')) { html += `<h5>${line.slice(6)}</h5>`; continue; }
    if (line.startsWith('#### ')) { html += `<h4>${line.slice(5)}</h4>`; continue; }
    if (line.startsWith('### ')) { html += `<h3>${line.slice(4)}</h3>`; continue; }
    if (line.startsWith('## ')) { html += `<h2>${line.slice(3)}</h2>`; continue; }
    if (line.startsWith('# ')) { html += `<h1>${line.slice(2)}</h1>`; continue; }
    if (line.startsWith('> ')) {
      if (!inBlockquote) { html += '<blockquote>'; inBlockquote = true; }
      const inner = line.slice(2)
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      html += `<p>${inner}</p>`;
      continue;
    }

    let processed = line
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/~~(.+?)~~/g, '<del>$1</del>')
      .replace(/_([^_]+?)_/g, '<em>$1</em>')
      .replace(/(\d+)\.\s/g, '<br>$1. ')
      .replace(/^-\s/gm, '<br>• ');

    if (processed.trim()) html += `<p>${processed}</p>`;
    else html += line;
  }

  if (inTable) flushTable();
  if (inBlockquote) html += '</blockquote>';
  html += '</body></html>';
  return html;
};

export { generateId };
