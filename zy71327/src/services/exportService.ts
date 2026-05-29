import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import type { SamplePack, Credential, Track, PlatformLink, RiskAlert } from '@/types';
import {
  LICENSE_TYPE_LABELS,
  CREDENTIAL_TYPE_LABELS,
  PLATFORM_LABELS,
  STATUS_LABELS,
} from '@/types';

interface ExportData {
  samplePacks: SamplePack[];
  credentials: Credential[];
  tracks: Track[];
  platformLinks: PlatformLink[];
  risks: RiskAlert[];
}

export const generateMarkdownReport = (data: ExportData): string => {
  const { samplePacks, credentials, tracks, platformLinks, risks } = data;
  const generatedAt = format(new Date(), 'yyyy年MM月dd日 HH:mm', { locale: zhCN });

  let md = `# 采样包授权台账报告\n\n`;
  md += `> 生成时间：${generatedAt}\n\n`;

  md += `## 📊 概览统计\n\n`;
  md += `- 采样包总数：${samplePacks.length} 个\n`;
  md += `- 曲目总数：${tracks.length} 首\n`;
  md += `- 授权有效：${samplePacks.filter((s) => s.status === 'active').length} 个\n`;
  md += `- 即将到期：${samplePacks.filter((s) => s.status === 'expiring').length} 个\n`;
  md += `- 已过期：${samplePacks.filter((s) => s.status === 'expired').length} 个\n`;
  md += `- 资料不全：${samplePacks.filter((s) => s.status === 'incomplete').length} 个\n\n`;

  if (risks.length > 0) {
    md += `## ⚠️ 风险提醒\n\n`;
    for (const risk of risks) {
      const severityIcon = risk.severity === 'error' ? '🔴' : risk.severity === 'warning' ? '🟠' : '🔵';
      md += `${severityIcon} **${risk.title}**\n\n`;
      md += `${risk.message}\n\n`;
    }
  }

  md += `## 📦 采样包详情\n\n`;
  for (const pack of samplePacks) {
    const statusIcon =
      pack.status === 'active'
        ? '✅'
        : pack.status === 'expiring'
        ? '⏰'
        : pack.status === 'expired'
        ? '❌'
        : '⚠️';

    md += `### ${statusIcon} ${pack.name}\n\n`;
    md += `| 项目 | 内容 |\n`;
    md += `|------|------|\n`;
    md += `| 状态 | ${STATUS_LABELS[pack.status]} |\n`;
    md += `| 供应商 | ${pack.vendor} |\n`;
    md += `| 授权类型 | ${LICENSE_TYPE_LABELS[pack.licenseType]} |\n`;
    md += `| 购买日期 | ${pack.purchaseDate} |\n`;
    if (pack.expiryDate) {
      md += `| 到期日期 | ${pack.expiryDate} |\n`;
    }
    if (pack.price) {
      md += `| 价格 | ¥${pack.price} |\n`;
    }

    const packCredentials = credentials.filter((c) => c.samplePackId === pack.id);
    if (packCredentials.length > 0) {
      md += `\n**授权凭证：**\n\n`;
      for (const cred of packCredentials) {
        md += `- ${CREDENTIAL_TYPE_LABELS[cred.type]}：${cred.fileName}`;
        if (cred.description) {
          md += `（${cred.description}）`;
        }
        md += `\n`;
      }
    }

    const usingTracks = tracks.filter((t) => t.samplePackIds.includes(pack.id));
    if (usingTracks.length > 0) {
      md += `\n**关联曲目：**\n\n`;
      for (const track of usingTracks) {
        md += `- 《${track.title}》`;
        if (track.genre) {
          md += `（${track.genre}）`;
        }
        md += `\n`;
      }
    }

    if (pack.notes) {
      md += `\n**备注：** ${pack.notes}\n`;
    }

    md += `\n---\n\n`;
  }

  md += `## 🎵 曲目详情\n\n`;
  for (const track of tracks) {
    md += `### 《${track.title}》\n\n`;
    md += `| 项目 | 内容 |\n`;
    md += `|------|------|\n`;
    if (track.bpm) {
      md += `| BPM | ${track.bpm} |\n`;
    }
    if (track.genre) {
      md += `| 风格 | ${track.genre} |\n`;
    }
    if (track.projectPath) {
      md += `| 工程路径 | ${track.projectPath} |\n`;
    }

    const packNames = track.samplePackIds
      .map((id) => samplePacks.find((p) => p.id === id)?.name)
      .filter(Boolean);
    if (packNames.length > 0) {
      md += `| 使用采样包 | ${packNames.join('、')} |\n`;
    }

    const trackLinks = platformLinks.filter((l) => l.trackId === track.id);
    if (trackLinks.length > 0) {
      md += `\n**上架平台：**\n\n`;
      for (const link of trackLinks) {
        md += `- ${PLATFORM_LABELS[link.platform]}：${link.url}\n`;
      }
    }

    md += `\n---\n\n`;
  }

  return md;
};

export const generateHTMLReport = (data: ExportData): string => {
  const markdown = generateMarkdownReport(data);
  
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>采样包授权台账报告</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
      line-height: 1.6;
      max-width: 900px;
      margin: 0 auto;
      padding: 40px 20px;
      color: #1A1A2E;
      background: #fafafa;
    }
    h1 {
      color: #1A1A2E;
      border-bottom: 3px solid #E8B86D;
      padding-bottom: 10px;
      margin-bottom: 30px;
    }
    h2 {
      color: #1A1A2E;
      margin-top: 40px;
      border-left: 4px solid #E8B86D;
      padding-left: 15px;
    }
    h3 {
      color: #4A7C59;
      margin-top: 30px;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 15px 0;
      background: white;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    th, td {
      border: 1px solid #e0e0e0;
      padding: 12px 15px;
      text-align: left;
    }
    th {
      background: #f5f5f5;
      font-weight: 600;
      width: 120px;
    }
    blockquote {
      border-left: 4px solid #6B8E9F;
      margin: 20px 0;
      padding: 10px 20px;
      background: #f0f4f8;
      color: #555;
    }
    .risk-error {
      background: #fef2f2;
      border-left: 4px solid #B85450;
      padding: 15px;
      margin: 10px 0;
      border-radius: 4px;
    }
    .risk-warning {
      background: #fffbeb;
      border-left: 4px solid #D4883A;
      padding: 15px;
      margin: 10px 0;
      border-radius: 4px;
    }
    .risk-info {
      background: #f0f9ff;
      border-left: 4px solid #6B8E9F;
      padding: 15px;
      margin: 10px 0;
      border-radius: 4px;
    }
    hr {
      border: none;
      border-top: 1px solid #e0e0e0;
      margin: 30px 0;
    }
    ul {
      padding-left: 25px;
    }
    li {
      margin: 5px 0;
    }
    code {
      background: #f0f0f0;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 0.9em;
    }
  </style>
</head>
<body>
${markdownToHTML(markdown)}
</body>
</html>`;

  return html;
};

const markdownToHTML = (md: string): string => {
  let html = md;
  
  html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>');
  
  html = html.replace(/^> (.*$)/gm, '<blockquote>$1</blockquote>');
  
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  html = html.replace(/^---$/gm, '<hr>');
  
  html = html.replace(/^- (.*$)/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
  
  html = html.replace(/^\| (.*) \|$/gm, (match) => {
    const cells = match.slice(2, -2).split(' | ');
    return '<tr>' + cells.map((c) => `<td>${c}</td>`).join('') + '</tr>';
  });
  html = html.replace(/(<tr>.*<\/tr>\n?)+/g, '<table>$&</table>');
  
  html = html.replace(/🔴 (.*?)\n\n(.*?)(?=\n\n|$)/gs, '<div class="risk-error"><strong>$1</strong><p>$2</p></div>');
  html = html.replace(/🟠 (.*?)\n\n(.*?)(?=\n\n|$)/gs, '<div class="risk-warning"><strong>$1</strong><p>$2</p></div>');
  html = html.replace(/🔵 (.*?)\n\n(.*?)(?=\n\n|$)/gs, '<div class="risk-info"><strong>$1</strong><p>$2</p></div>');
  
  html = html.replace(/✅/g, '✅');
  html = html.replace(/⏰/g, '⏰');
  html = html.replace(/❌/g, '❌');
  html = html.replace(/⚠️/g, '⚠️');
  html = html.replace(/📊/g, '📊');
  html = html.replace(/⚠️/g, '⚠️');
  html = html.replace(/📦/g, '📦');
  html = html.replace(/🎵/g, '🎵');
  
  html = html.replace(/\n\n/g, '</p><p>');
  html = '<p>' + html + '</p>';
  
  return html;
};

export const downloadFile = (content: string, filename: string, mimeType: string): void => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    return true;
  }
};
