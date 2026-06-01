import html2canvas from 'html2canvas';
import { LightPoint } from '../types';

export const captureScreenshot = async (elementId: string): Promise<string> => {
  const element = document.getElementById(elementId);
  if (!element) throw new Error('Element not found');

  const canvas = await html2canvas(element, {
    backgroundColor: '#0f172a',
    scale: 2,
    useCORS: true,
  });

  return canvas.toDataURL('image/png');
};

export const downloadScreenshot = async (elementId: string, filename: string) => {
  const dataUrl = await captureScreenshot(elementId);
  const link = document.createElement('a');
  link.download = `${filename}.png`;
  link.href = dataUrl;
  link.click();
};

export const generateReportContent = (
  projectName: string,
  lightPoints: LightPoint[]
): string => {
  const total = lightPoints.length;
  const normal = lightPoints.filter((p) => p.status === 'normal').length;
  const pending = lightPoints.filter((p) => p.status === 'pending').length;
  const abnormal = lightPoints.filter((p) => p.status === 'abnormal').length;

  const now = new Date().toLocaleString('zh-CN');

  const reportLines: string[] = [
    '═'.repeat(60),
    '剧场灯位安全网 - 检查报告',
    '═'.repeat(60),
    '',
    `方案名称: ${projectName}`,
    `导出时间: ${now}`,
    '',
    '─'.repeat(60),
    '统计汇总',
    '─'.repeat(60),
    `总灯位数: ${total}`,
    `正常点位: ${normal}`,
    `待确认: ${pending}`,
    `异常点位: ${abnormal}`,
    '',
    '─'.repeat(60),
    '异常及待确认明细',
    '─'.repeat(60),
    '',
  ];

  const issues = lightPoints.filter((p) => p.status !== 'normal');
  if (issues.length === 0) {
    reportLines.push('  无异常或待确认点位');
  } else {
    issues.forEach((p, i) => {
      reportLines.push(`【${i + 1}】${p.name}`);
      reportLines.push(`    状态: ${getStatusText(p.status)}`);
      reportLines.push(`    坐标: X=${p.x.toFixed(2)}, Y=${p.y.toFixed(2)}, Z=${p.z.toFixed(2)}`);
      reportLines.push(`    来源: ${p.source} (${p.sourceRow})`);
      reportLines.push(`    备注: ${p.remark || '无'}`);
      reportLines.push(`    建议: ${p.suggestion || '无'}`);
      reportLines.push(`    更新时间: ${p.updateTime}`);
      reportLines.push('');
    });
  }

  reportLines.push('─'.repeat(60));
  reportLines.push('全部点位清单');
  reportLines.push('─'.repeat(60));
  reportLines.push('');

  lightPoints.forEach((p, i) => {
    reportLines.push(
      `${String(i + 1).padStart(2, ' ')}. [${getStatusSymbol(p.status)}] ${p.name.padEnd(20, ' ')} | ${p.source.padEnd(10, ' ')} | X:${p.x.toFixed(1).padStart(6, ' ')}`
    );
  });

  reportLines.push('');
  reportLines.push('═'.repeat(60));

  return reportLines.join('\n');
};

const getStatusText = (status: string): string => {
  switch (status) {
    case 'normal':
      return '正常';
    case 'pending':
      return '待确认';
    case 'abnormal':
      return '异常';
    default:
      return status;
  }
};

const getStatusSymbol = (status: string): string => {
  switch (status) {
    case 'normal':
      return '✓';
    case 'pending':
      return '?';
    case 'abnormal':
      return '!';
    default:
      return '-';
  }
};

export const downloadReport = (
  projectName: string,
  lightPoints: LightPoint[],
  filename: string
) => {
  const content = generateReportContent(projectName, lightPoints);
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = `${filename}.txt`;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
};

export const downloadJSON = (json: string, filename: string) => {
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = `${filename}.json`;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
};
