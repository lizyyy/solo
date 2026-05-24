import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Store, InspectionIssue } from '../types';
import { getIssueStats, getIssueTypeLabel } from './inspection';

export async function generateReport(
  store: Store,
  issues: InspectionIssue[],
  elementId: string = 'report-canvas'
): Promise<void> {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  let yPos = margin;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(20);
  pdf.text('门店货架陈列体检报告', pageWidth / 2, yPos, { align: 'center' });
  yPos += 10;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(12);
  pdf.text(`门店名称: ${store.name}`, margin, yPos);
  yPos += 7;
  pdf.text(`生成时间: ${new Date().toLocaleString('zh-CN')}`, margin, yPos);
  yPos += 15;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14);
  pdf.text('一、问题统计', margin, yPos);
  yPos += 8;

  const stats = getIssueStats(issues);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(11);
  pdf.text(`总问题数: ${stats.total}`, margin, yPos);
  yPos += 6;
  pdf.text(`严重问题: ${stats.bySeverity.high}`, margin, yPos);
  yPos += 6;
  pdf.text(`中等问题: ${stats.bySeverity.medium}`, margin, yPos);
  yPos += 6;
  pdf.text(`轻微问题: ${stats.bySeverity.low}`, margin, yPos);
  yPos += 10;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14);
  pdf.text('二、问题详情', margin, yPos);
  yPos += 8;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  
  const sortedIssues = [...issues].sort((a, b) => {
    const severityOrder = { high: 0, medium: 1, low: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });

  sortedIssues.forEach((issue, index) => {
    if (yPos > pageHeight - 30) {
      pdf.addPage();
      yPos = margin;
    }

    const severityLabel = issue.severity === 'high' ? '严重' : issue.severity === 'medium' ? '中等' : '轻微';
    const typeLabel = getIssueTypeLabel(issue.type);
    
    pdf.text(`${index + 1}. [${severityLabel}] ${typeLabel}`, margin, yPos);
    yPos += 5;
    pdf.text(`   ${issue.description}`, margin + 2, yPos);
    yPos += 7;
  });

  if (yPos > pageHeight - 40) {
    pdf.addPage();
    yPos = margin;
  } else {
    yPos += 10;
  }

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14);
  pdf.text('三、货架统计', margin, yPos);
  yPos += 8;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(11);
  pdf.text(`货架总数: ${store.shelves.length}`, margin, yPos);
  yPos += 6;
  
  const endcapCount = store.shelves.filter(s => s.isEndcap).length;
  pdf.text(`端架数量: ${endcapCount}`, margin, yPos);
  yPos += 6;

  const totalSlots = store.shelves.reduce((sum, shelf) => 
    sum + shelf.layers.reduce((s, layer) => s + layer.slots.length, 0), 0
  );
  const outOfStockCount = store.shelves.reduce((sum, shelf) => 
    sum + shelf.layers.reduce((s, layer) => s + layer.slots.filter(slot => slot.isOutOfStock).length, 0), 0
  );
  pdf.text(`SKU槽位总数: ${totalSlots}`, margin, yPos);
  yPos += 6;
  pdf.text(`缺货数量: ${outOfStockCount}`, margin, yPos);
  yPos += 6;
  pdf.text(`缺货率: ${Math.round((outOfStockCount / totalSlots) * 100)}%`, margin, yPos);
  yPos += 15;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14);
  pdf.text('四、整改建议', margin, yPos);
  yPos += 8;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  const suggestions = generateSuggestions(issues);
  suggestions.forEach((suggestion, index) => {
    if (yPos > pageHeight - 20) {
      pdf.addPage();
      yPos = margin;
    }
    pdf.text(`${index + 1}. ${suggestion}`, margin, yPos);
    yPos += 6;
  });

  pdf.save(`货架陈列体检报告_${store.name}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

function generateSuggestions(issues: InspectionIssue[]): string[] {
  const suggestions: string[] = [];
  const hasHighSeverity = issues.some(i => i.severity === 'high');
  const hasDuplicate = issues.some(i => i.type === 'duplicate_sku');
  const hasGoldenIssue = issues.some(i => i.type === 'golden_layer_violation');
  const hasEndcapBlocked = issues.some(i => i.type === 'endcap_blocked');
  const hasOutOfStock = issues.some(i => i.type === 'out_of_stock');

  if (hasHighSeverity) {
    suggestions.push('优先处理所有严重级别的问题，24小时内完成整改');
  }
  if (hasDuplicate) {
    suggestions.push('检查SKU重复占位问题，确保同一SKU在同一层板不重复出现');
  }
  if (hasGoldenIssue) {
    suggestions.push('优化黄金层（85-120cm）陈列，确保高毛利商品位置，提升利用率至70%以上');
  }
  if (hasEndcapBlocked) {
    suggestions.push('清理端架前方障碍物，确保端架展示效果和动线通畅');
  }
  if (hasOutOfStock) {
    suggestions.push('及时补货，重点关注黄金层缺货商品，降低缺货率');
  }
  
  suggestions.push('建立每周陈列巡检机制，定期检查陈列合规性');
  suggestions.push('培训店员陈列标准，确保执行一致性');
  suggestions.push('利用热力图数据优化动线设计，提升高客流区域陈列效果');

  return suggestions;
}
