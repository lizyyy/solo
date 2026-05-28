import { jsPDF } from 'jspdf';
import type { 
  Risk, ProtectionReport, RiskType, RiskSeverity,
  Artwork, LightSource, Gallery, Exhibition
} from '@/types';
import type { ScreenshotResult } from './screenshot';

export interface ReportGenerationOptions {
  includeScreenshots?: boolean;
  includeDataTrace?: boolean;
  includeRecommendations?: boolean;
}

const RISK_TYPE_LABELS: Record<RiskType, string> = {
  over_illumination: '照度超标',
  cumulative_leak: '累积曝光泄漏',
  light_penetration: '光线穿透',
};

const SEVERITY_LABELS: Record<RiskSeverity, string> = {
  low: '低',
  medium: '中',
  high: '高',
  critical: '严重',
};

export function generateReport(
  risks: Risk[],
  artworks: Artwork[],
  lightSources: LightSource[],
  gallery: Gallery | null,
  exhibition: Exhibition | null,
  screenshots: ScreenshotResult[],
  options: ReportGenerationOptions = {}
): ProtectionReport {
  const { 
    includeScreenshots = true, 
    includeDataTrace = true,
    includeRecommendations = true 
  } = options;

  const riskSummary = calculateRiskSummary(risks);
  const recommendations = includeRecommendations 
    ? generateRecommendations(risks, artworks)
    : [];
  const reportScreenshots = includeScreenshots
    ? screenshots.map(s => ({
        dataUrl: s.dataUrl,
        caption: s.caption,
        timestamp: s.timestamp,
      }))
    : [];
  const dataSources = includeDataTrace
    ? [
        { type: '展厅', count: gallery ? 1 : 0, lastUpdated: gallery?.createdAt || '-' },
        { type: '光源', count: lightSources.length, lastUpdated: getLatestUpdate(lightSources) },
        { type: '作品', count: artworks.length, lastUpdated: getLatestUpdate(artworks) },
        { type: '风险检测', count: risks.length, lastUpdated: getLatestRiskTime(risks) },
      ]
    : [];

  return {
    id: `report_${Date.now()}`,
    exhibitionId: exhibition?.id || '',
    reportNo: `RPT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    generatedAt: new Date().toISOString(),
    riskSummary,
    recommendations,
    screenshots: reportScreenshots,
    dataSources,
    generatedBy: '当前用户',
  };
}

function calculateRiskSummary(risks: Risk[]): ProtectionReport['riskSummary'] {
  const summary: ProtectionReport['riskSummary'] = {
    totalRisks: risks.length,
    overIllumination: 0,
    cumulativeLeak: 0,
    lightPenetration: 0,
    bySeverity: { low: 0, medium: 0, high: 0, critical: 0 },
  };

  risks.forEach(risk => {
    if (risk.type === 'over_illumination') summary.overIllumination++;
    if (risk.type === 'cumulative_leak') summary.cumulativeLeak++;
    if (risk.type === 'light_penetration') summary.lightPenetration++;
    summary.bySeverity[risk.severity]++;
  });

  return summary;
}

function generateRecommendations(
  risks: Risk[],
  artworks: Artwork[]
): ProtectionReport['recommendations'] {
  const recommendations: ProtectionReport['recommendations'] = [];
  const processedArtworks = new Set<string>();

  risks
    .filter(r => r.severity === 'critical' || r.severity === 'high')
    .sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3 };
      return order[a.severity] - order[b.severity];
    })
    .forEach(risk => {
      const artwork = artworks.find(a => a.id === risk.artworkId);
      
      if (artwork && !processedArtworks.has(artwork.id)) {
        processedArtworks.add(artwork.id);
        
        const suggestion = generateSuggestion(risk, artwork);
        recommendations.push({
          artworkId: artwork.id,
          artworkName: artwork.name,
          suggestion,
          priority: risk.severity === 'critical' ? 'high' : risk.severity === 'high' ? 'high' : 'medium',
        });
      }
    });

  return recommendations;
}

function generateSuggestion(risk: Risk, artwork: Artwork): string {
  const exceedPercent = Math.round(risk.exceedRatio * 100);
  
  switch (risk.type) {
    case 'over_illumination':
      return `当前照度 ${risk.measuredValue.toFixed(1)} lux，超过阈值 ${exceedPercent}%。建议降低光源功率 ${Math.min(50, exceedPercent)}%，或调整光源角度以减少直射。`;
    case 'cumulative_leak':
      return `累积曝光已超标 ${exceedPercent}%。建议缩短该作品每日展示时间，或在非开放时段关闭该区域光源。`;
    case 'light_penetration':
      return `检测到光线穿透风险，建议检查展墙密封性，或调整光源位置避免光线直接穿透。`;
    default:
      return `请检查该作品的光照环境，确保符合 ${artwork.lightResistanceGrade} 等级标准。`;
  }
}

function getLatestUpdate(items: Array<{ createdAt: string; lastModifiedAt?: string }>): string {
  if (items.length === 0) return '-';
  const times = items.flatMap(i => [i.createdAt, i.lastModifiedAt].filter(Boolean) as string[]);
  return times.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
}

function getLatestRiskTime(risks: Risk[]): string {
  if (risks.length === 0) return '-';
  return risks.map(r => r.detectedAt).sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
}

export async function exportToPDF(report: ProtectionReport): Promise<void> {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let y = margin;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('美术馆光照保护报告', pageWidth / 2, y, { align: 'center' });
  y += 15;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`报告编号: ${report.reportNo}`, margin, y);
  y += 6;
  doc.text(`生成时间: ${new Date(report.generatedAt).toLocaleString('zh-CN')}`, margin, y);
  y += 6;
  doc.text(`生成人员: ${report.generatedBy}`, margin, y);
  y += 15;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('一、风险统计', margin, y);
  y += 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  
  const stats = [
    `风险总数: ${report.riskSummary.totalRisks}`,
    `照度超标: ${report.riskSummary.overIllumination} 项`,
    `累积曝光泄漏: ${report.riskSummary.cumulativeLeak} 项`,
    `光线穿透: ${report.riskSummary.lightPenetration} 项`,
    '',
    `严重级别分布:`,
    `  严重: ${report.riskSummary.bySeverity.critical} 项`,
    `  高: ${report.riskSummary.bySeverity.high} 项`,
    `  中: ${report.riskSummary.bySeverity.medium} 项`,
    `  低: ${report.riskSummary.bySeverity.low} 项`,
  ];

  stats.forEach(line => {
    if (y > 270) {
      doc.addPage();
      y = margin;
    }
    doc.text(line, margin + 2, y);
    y += 6;
  });
  y += 8;

  if (report.recommendations.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('二、保护建议', margin, y);
    y += 10;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    report.recommendations.forEach((rec, idx) => {
      if (y > 260) {
        doc.addPage();
        y = margin;
      }
      
      const priorityLabel = rec.priority === 'high' ? '【高优先级】' : rec.priority === 'medium' ? '【中优先级】' : '【低优先级】';
      doc.text(`${idx + 1}. ${rec.artworkName || '未知作品'} ${priorityLabel}`, margin + 2, y);
      y += 6;
      
      const lines = doc.splitTextToSize(rec.suggestion, pageWidth - margin * 2 - 4);
      lines.forEach(line => {
        if (y > 270) {
          doc.addPage();
          y = margin;
        }
        doc.text(line, margin + 6, y);
        y += 5;
      });
      y += 4;
    });
    y += 6;
  }

  if (report.screenshots.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('三、风险标注截图', margin, y);
    y += 10;

    for (let i = 0; i < report.screenshots.length; i++) {
      const screenshot = report.screenshots[i];
      
      if (y > 200) {
        doc.addPage();
        y = margin;
      }

      try {
        const imgWidth = pageWidth - margin * 2;
        const imgHeight = 60;
        
        doc.addImage(screenshot.dataUrl, 'PNG', margin, y, imgWidth, imgHeight);
        y += imgHeight + 4;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);
        doc.text(`图 ${i + 1}: ${screenshot.caption}`, margin + 2, y);
        doc.setTextColor(0, 0, 0);
        y += 10;
      } catch (e) {
        console.error('Failed to add image to PDF:', e);
      }
    }
    y += 8;
  }

  if (report.dataSources.length > 0) {
    if (y > 240) {
      doc.addPage();
      y = margin;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('四、数据溯源', margin, y);
    y += 10;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('本报告基于以下数据生成，所有数据均可追溯:', margin + 2, y);
    y += 8;

    report.dataSources.forEach(source => {
      if (y > 270) {
        doc.addPage();
        y = margin;
      }
      doc.text(`• ${source.type}: ${source.count} 条记录，最后更新: ${new Date(source.lastUpdated).toLocaleString('zh-CN')}`, margin + 4, y);
      y += 6;
    });
  }

  doc.addPage();
  y = margin;
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('五、空间关系说明', margin, y);
  y += 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const spatialNotes = [
    '本报告中的位置坐标基于展厅三维空间坐标系:',
    '• 原点 (0,0,0) 位于展厅地面中心',
    '• X轴: 展厅宽度方向，向右为正',
    '• Y轴: 展厅高度方向，向上为正',
    '• Z轴: 展厅深度方向，向前为正',
    '',
    '风险标注位置说明:',
    '• 所有风险点均标注在三维空间中的实际位置',
    '• 红色标记表示严重风险，橙色表示高风险',
    '• 黄色表示中等风险，绿色表示低风险',
    '',
    '空间关系分析:',
    '• 风险点与光源的距离和角度是照度计算的关键参数',
    '• 作品的朝向和位置影响实际接收的光照强度',
    '• 展墙和隔板会产生光线衰减和阴影效果',
  ];

  spatialNotes.forEach(line => {
    if (y > 270) {
      doc.addPage();
      y = margin;
    }
    doc.text(line, margin + 2, y);
    y += 5;
  });

  const filename = `保护报告_${report.reportNo}.pdf`;
  doc.save(filename);
}

export function downloadReport(report: ProtectionReport): void {
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = `report_${report.id}.json`;
  link.href = url;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export { RISK_TYPE_LABELS, SEVERITY_LABELS };
