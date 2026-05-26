import type { GameState, InspectionReport, InspectionReportItem } from '../game/types';
import { LEVELS, getGradeFromScore, getRainIntensityLabel } from '../game/config';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export const generateInspectionReport = (state: GameState): InspectionReport => {
  const level = LEVELS.find((l) => l.id === state.levelId);
  const items: InspectionReportItem[] = [];

  state.roofMap.drains.forEach((drain) => {
    let status: InspectionReportItem['status'] = 'normal';
    let description = '';
    let recommendation = '';

    if (!drain.inspected) {
      status = 'normal';
      description = '未检查';
      recommendation = '建议下次巡检时重点检查';
    } else if (drain.isBlocked) {
      status = 'blocked';
      description = `排水口堵塞，堵塞程度: ${drain.blockageSeverity}%`;
      recommendation = '需要立即疏通';
    } else if (drain.resolved) {
      status = 'resolved';
      description = '已疏通';
      recommendation = '运行正常';
    } else {
      status = 'normal';
      description = '运行正常';
      recommendation = '定期检查';
    }

    items.push({
      id: drain.id,
      type: 'drain',
      position: { ...drain.position },
      status,
      description,
      recommendation,
    });
  });

  state.roofMap.lowAreas.forEach((lowArea) => {
    let status: InspectionReportItem['status'] = 'normal';
    let description = '';
    let recommendation = '';

    if (!lowArea.inspected) {
      status = 'normal';
      description = '未检查';
      recommendation = '建议下次巡检时重点检查';
    } else if (lowArea.waterLevel >= 70) {
      status = 'flooded';
      description = `积水严重，水位: ${lowArea.waterLevel}%`;
      recommendation = '需要立即抽水排涝';
    } else if (lowArea.waterLevel >= 40) {
      status = 'flooded';
      description = `有积水，水位: ${lowArea.waterLevel}%`;
      recommendation = '建议抽水处理';
    } else if (lowArea.pumped) {
      status = 'resolved';
      description = `已抽水，剩余水位: ${lowArea.waterLevel}%`;
      recommendation = '继续监测';
    } else {
      status = 'normal';
      description = `水位正常: ${lowArea.waterLevel}%`;
      recommendation = '定期检查';
    }

    items.push({
      id: lowArea.id,
      type: 'lowarea',
      position: { ...lowArea.position },
      status,
      description,
      recommendation,
    });
  });

  const issuesFound = items.filter((i) => i.status === 'blocked' || i.status === 'flooded').length;
  const issuesResolved = items.filter((i) => i.status === 'resolved').length;
  const inspectedDrains = state.roofMap.drains.filter((d) => d.inspected).length;
  const inspectedLowAreas = state.roofMap.lowAreas.filter((l) => l.inspected).length;

  const recommendations: string[] = [];
  
  if (inspectedDrains < state.roofMap.drains.length) {
    recommendations.push(`有 ${state.roofMap.drains.length - inspectedDrains} 个排水口未检查，建议补查`);
  }
  if (inspectedLowAreas < state.roofMap.lowAreas.length) {
    recommendations.push(`有 ${state.roofMap.lowAreas.length - inspectedLowAreas} 个低洼区未检查，建议补查`);
  }
  if (state.leakPoints.length > 0) {
    recommendations.push(`本次巡检发现 ${state.leakPoints.length} 处漏水点，需立即维修`);
  }
  if (issuesFound > 0) {
    recommendations.push(`发现 ${issuesFound} 处隐患，建议优先处理`);
  }
  if (state.rainfallIntensity >= 60) {
    recommendations.push(`当前雨量等级: ${getRainIntensityLabel(state.rainfallIntensity)}，需密切关注积水情况`);
  }
  if (recommendations.length === 0) {
    recommendations.push('屋顶排水系统运行正常，建议按计划进行例行巡检');
  }

  return {
    levelName: level?.name || '未知关卡',
    inspectorName: '巡检员',
    date: new Date().toLocaleString('zh-CN'),
    totalDrains: state.roofMap.drains.length,
    inspectedDrains,
    totalLowAreas: state.roofMap.lowAreas.length,
    inspectedLowAreas,
    issuesFound,
    issuesResolved,
    leakPoints: [...state.leakPoints],
    items,
    recommendations,
    score: state.score,
    grade: getGradeFromScore(state.score),
  };
};

export const exportReportAsPDF = async (
  reportElement: HTMLElement,
  fileName: string = '屋顶巡检报告'
): Promise<void> => {
  try {
    const canvas = await html2canvas(reportElement, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
    const imgX = (pdfWidth - imgWidth * ratio) / 2;
    const imgY = 0;

    pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
    pdf.save(`${fileName}_${new Date().toISOString().split('T')[0]}.pdf`);
  } catch (error) {
    console.error('Failed to export PDF:', error);
    throw new Error('PDF导出失败');
  }
};

export const exportReportAsJSON = (report: InspectionReport, fileName: string = '屋顶巡检报告'): void => {
  const dataStr = JSON.stringify(report, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${fileName}_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
