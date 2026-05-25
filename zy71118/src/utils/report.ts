import jsPDF from 'jspdf';
import { Store, InspectionIssue } from '../types';
import { getIssueStats, getIssueTypeLabel } from './inspection';

export async function generateReport(
  store: Store,
  issues: InspectionIssue[]
): Promise<void> {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('无法创建canvas context');

    const width = 800;
    const lineHeight = 24;
    const padding = 40;
    let y = padding;

    canvas.width = width;
    canvas.height = 1200;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#1e40af';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('门店货架陈列体检报告', width / 2, y);
    y += lineHeight * 2;

    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padding, y - 15);
    ctx.lineTo(width - padding, y - 15);
    ctx.stroke();

    ctx.fillStyle = '#1f2937';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`门店名称：${store.name}`, padding, y);
    y += lineHeight;
    ctx.fillText(`生成时间：${new Date().toLocaleString('zh-CN')}`, padding, y);
    y += lineHeight * 1.5;

    const stats = getIssueStats(issues);
    drawSectionTitle(ctx, '一、问题统计', padding, y);
    y += lineHeight;

    const statBoxWidth = (width - padding * 2 - 45) / 4;
    const statBoxHeight = 60;
    const statLabels = ['总问题数', '严重问题', '中等问题', '轻微问题'];
    const statValues = [stats.total, stats.bySeverity.high, stats.bySeverity.medium, stats.bySeverity.low];
    const statColors = ['#1f2937', '#dc2626', '#d97706', '#16a34a'];
    const statBgColors = ['#f8fafc', '#fef2f2', '#fffbeb', '#f0fdf4'];

    for (let i = 0; i < 4; i++) {
      const boxX = padding + i * (statBoxWidth + 15);
      ctx.fillStyle = statBgColors[i];
      ctx.fillRect(boxX, y, statBoxWidth, statBoxHeight);
      ctx.fillStyle = statColors[i];
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(statValues[i]), boxX + statBoxWidth / 2, y + 35);
      ctx.fillStyle = '#6b7280';
      ctx.font = '12px sans-serif';
      ctx.fillText(statLabels[i], boxX + statBoxWidth / 2, y + 52);
    }
    y += statBoxHeight + 25;

    drawSectionTitle(ctx, '二、问题详情', padding, y);
    y += lineHeight;

    const sortedIssues = [...issues].sort((a, b) => {
      const severityOrder = { high: 0, medium: 1, low: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });

    if (sortedIssues.length === 0) {
      ctx.fillStyle = '#f0fdf4';
      ctx.fillRect(padding, y, width - padding * 2, 50);
      ctx.fillStyle = '#16a34a';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('✓ 陈列合规，无问题', width / 2, y + 30);
      y += 60;
    } else {
      const severityLabels: Record<string, string> = { high: '严重', medium: '中等', low: '轻微' };
      const severityColors: Record<string, string> = { high: '#fef2f2', medium: '#fffbeb', low: '#f0fdf4' };
      const severityBorderColors: Record<string, string> = { high: '#fecaca', medium: '#fcd34d', low: '#86efac' };

      for (let i = 0; i < Math.min(sortedIssues.length, 15); i++) {
        const issue = sortedIssues[i];
        const boxHeight = 45;

        ctx.fillStyle = severityColors[issue.severity];
        ctx.fillRect(padding, y, width - padding * 2, boxHeight);
        ctx.strokeStyle = severityBorderColors[issue.severity];
        ctx.lineWidth = 1;
        ctx.strokeRect(padding, y, width - padding * 2, boxHeight);

        ctx.fillStyle = '#1f2937';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`${i + 1}. ${getIssueTypeLabel(issue.type)}`, padding + 10, y + 20);

        ctx.fillStyle = '#6b7280';
        ctx.font = '11px sans-serif';
        ctx.fillRect(width - padding - 70, y + 8, 60, 18);
        ctx.fillStyle = '#1f2937';
        ctx.textAlign = 'center';
        ctx.fillText(severityLabels[issue.severity], width - padding - 40, y + 21);

        ctx.fillStyle = '#4b5563';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(issue.description.substring(0, 50), padding + 10, y + 36);

        y += boxHeight + 6;
      }

      if (sortedIssues.length > 15) {
        ctx.fillStyle = '#6b7280';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`还有 ${sortedIssues.length - 15} 个问题未显示...`, width / 2, y + 15);
        y += 25;
      }
    }

    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgWidth = 210;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    const imgData = canvas.toDataURL('image/png');
    pdf.addImage(imgData, 'PNG', 0, 10, imgWidth, imgHeight);

    if (sortedIssues.length > 8) {
      pdf.addPage();
      let y2 = 20;

      const ctx2 = canvas.getContext('2d');
      if (ctx2) {
        canvas.height = 1000;
        ctx2.fillStyle = '#ffffff';
        ctx2.fillRect(0, 0, canvas.width, canvas.height);

        let yy = padding;
        drawSectionTitle(ctx2, '三、货架统计', padding, yy);
        yy += lineHeight;

        const endcapCount = store.shelves.filter((s) => s.isEndcap).length;
        const totalSlots = store.shelves.reduce(
          (sum, shelf) => sum + shelf.layers.reduce((s, layer) => s + layer.slots.length, 0),
          0
        );
        const outOfStockCount = store.shelves.reduce(
          (sum, shelf) =>
            sum + shelf.layers.reduce((s, layer) => s + layer.slots.filter((slot) => slot.isOutOfStock).length, 0),
          0
        );

        ctx2.fillStyle = '#f8fafc';
        ctx2.fillRect(padding, yy, width - padding * 2, 120);
        ctx2.fillStyle = '#1f2937';
        ctx2.font = '14px sans-serif';
        ctx2.textAlign = 'left';
        ctx2.fillText(`货架总数：${store.shelves.length} 个`, padding + 15, yy + 30);
        ctx2.fillText(`端架数量：${endcapCount} 个`, padding + 15, yy + 55);
        ctx2.fillText(`SKU槽位总数：${totalSlots} 个`, padding + 15, yy + 80);
        ctx2.fillText(`缺货数量：${outOfStockCount} 个`, padding + 300, yy + 30);
        ctx2.fillText(`缺货率：${Math.round((outOfStockCount / totalSlots) * 100)}%`, padding + 300, yy + 55);
        yy += 140;

        drawSectionTitle(ctx2, '四、整改建议', padding, yy);
        yy += lineHeight;

        const suggestions = generateSuggestions(issues);
        ctx2.fillStyle = '#eff6ff';
        ctx2.fillRect(padding, yy, width - padding * 2, 30 + suggestions.length * 25);

        ctx2.fillStyle = '#1f2937';
        ctx2.font = '14px sans-serif';
        suggestions.forEach((suggestion, index) => {
          ctx2.fillText(`${index + 1}. ${suggestion}`, padding + 15, yy + 25 + index * 25);
        });

        const imgData2 = canvas.toDataURL('image/png');
        pdf.addImage(imgData2, 'PNG', 0, 10, imgWidth, (canvas.height * imgWidth) / canvas.width);
      }
    }

    pdf.save(`货架陈列体检报告_${store.name}_${new Date().toISOString().slice(0, 10)}.pdf`);
  } catch (error) {
    console.error('生成报告失败:', error);
    throw error;
  }
}

function drawSectionTitle(ctx: CanvasRenderingContext2D, title: string, x: number, y: number) {
  ctx.fillStyle = '#3b82f6';
  ctx.fillRect(x, y - 18, 4, 22);
  ctx.fillStyle = '#1f2937';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(title, x + 12, y);
}

function generateSuggestions(issues: InspectionIssue[]): string[] {
  const suggestions: string[] = [];
  const hasHighSeverity = issues.some((i) => i.severity === 'high');
  const hasDuplicate = issues.some((i) => i.type === 'duplicate_sku');
  const hasGoldenIssue = issues.some((i) => i.type === 'golden_layer_violation');
  const hasEndcapBlocked = issues.some((i) => i.type === 'endcap_blocked');
  const hasOutOfStock = issues.some((i) => i.type === 'out_of_stock');

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
