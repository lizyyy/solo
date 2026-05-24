import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import type { PickingOrder, Aisle, TimeRange, HeatmapCell } from '../data/types';
import { calculateTotalDistance, calculateAvgSpeed } from './path';
import { calculateHeatmap } from './heatmap';

export async function exportReport(
  viewportElement: HTMLElement,
  orders: PickingOrder[],
  aisles: Aisle[],
  timeRange: TimeRange,
  intensity: number
): Promise<void> {
  const canvas = await html2canvas(viewportElement, {
    backgroundColor: '#0f172a',
    scale: 2,
    useCORS: true,
  });

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF('l', 'mm', 'a4');

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pageWidth - 20;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  pdf.setFontSize(20);
  pdf.setTextColor(15, 23, 42);
  pdf.text('仓库拣货热力分析报告', pageWidth / 2, 15, { align: 'center' });

  pdf.setFontSize(10);
  pdf.setTextColor(100, 116, 139);
  pdf.text(`生成时间: ${new Date().toLocaleString('zh-CN')}`, pageWidth / 2, 22, { align: 'center' });

  pdf.addImage(imgData, 'PNG', 10, 28, imgWidth, Math.min(imgHeight, 120));

  const statsY = 28 + Math.min(imgHeight, 120) + 10;
  pdf.setFontSize(14);
  pdf.setTextColor(15, 23, 42);
  pdf.text('统计数据', 10, statsY);

  const totalDistance = calculateTotalDistance(orders);
  const avgSpeed = calculateAvgSpeed(orders);

  pdf.setFontSize(10);
  pdf.setTextColor(51, 65, 85);
  pdf.text(`时间范围: ${formatTime(timeRange.start)} - ${formatTime(timeRange.end)}`, 10, statsY + 8);
  pdf.text(`拣货单数量: ${orders.length}`, 10, statsY + 16);
  pdf.text(`总行驶距离: ${totalDistance.toFixed(2)} 米`, 10, statsY + 24);
  pdf.text(`平均速度: ${avgSpeed.toFixed(2)} m/s`, 10, statsY + 32);

  const heatmapData = calculateHeatmap(orders, aisles, timeRange, 1, intensity);
  const congestedAisles = analyzeCongestion(heatmapData, aisles);

  pdf.setFontSize(14);
  pdf.setTextColor(15, 23, 42);
  pdf.text('拥堵巷道排名', 100, statsY);

  pdf.setFontSize(10);
  congestedAisles.slice(0, 5).forEach((aisle, index) => {
    const y = statsY + 8 + index * 8;
    pdf.setTextColor(index < 2 ? 220 : 51, index < 2 ? 38 : 65, index < 2 ? 38 : 85);
    pdf.text(`${index + 1}. ${aisle.name}`, 100, y);
  });

  pdf.save(`warehouse-heatmap-report-${Date.now()}.pdf`);
}

function analyzeCongestion(heatmapData: HeatmapCell[], aisles: Aisle[]): { id: string; name: string; congestion: number }[] {
  const aisleCongestion: Map<string, { name: string; total: number }> = new Map();

  for (const aisle of aisles) {
    aisleCongestion.set(aisle.id, { name: aisle.name, total: 0 });
  }

  for (const cell of heatmapData) {
    for (const aisle of aisles) {
      if (isCellInAisle(cell, aisle)) {
        const data = aisleCongestion.get(aisle.id);
        if (data) {
          data.total += cell.value;
        }
      }
    }
  }

  return Array.from(aisleCongestion.entries())
    .map(([id, data]) => ({ id, name: data.name, congestion: data.total }))
    .sort((a, b) => b.congestion - a.congestion);
}

function isCellInAisle(cell: HeatmapCell, aisle: Aisle): boolean {
  const halfWidth = aisle.width / 2 + 2;
  if (aisle.orientation === 'z') {
    return (
      cell.x >= aisle.x1 - halfWidth &&
      cell.x <= aisle.x1 + halfWidth &&
      cell.z >= Math.min(aisle.z1, aisle.z2) &&
      cell.z <= Math.max(aisle.z1, aisle.z2)
    );
  } else {
    return (
      cell.z >= aisle.z1 - halfWidth &&
      cell.z <= aisle.z1 + halfWidth &&
      cell.x >= Math.min(aisle.x1, aisle.x2) &&
      cell.x <= Math.max(aisle.x1, aisle.x2)
    );
  }
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function exportHeatmapData(heatmapData: HeatmapCell[], timeRange: TimeRange): void {
  const data = {
    generatedAt: new Date().toISOString(),
    timeRange: {
      start: new Date(timeRange.start).toISOString(),
      end: new Date(timeRange.end).toISOString(),
    },
    heatmapData,
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `heatmap-data-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
