import { Session, AcousticAnalysis } from '@/types';
import { DRUM_PIECE_NAMES, POLAR_PATTERN_NAMES, DISTANCE_UNIT_NAMES } from './constants';
import { formatDistance, getPhaseColor, getPhaseLabel, getCrosstalkColor } from './acousticMath';
import html2canvas from 'html2canvas';

export function generateReportText(
  session: Session,
  analysis: AcousticAnalysis
): string {
  const now = new Date().toLocaleString('zh-CN');
  
  let report = `╔══════════════════════════════════════════════════════════════╗\n`;
  report += `║                鼓组拾音方案报告                              ║\n`;
  report += `╚══════════════════════════════════════════════════════════════╝\n\n`;
  
  report += `方案名称：${session.name}\n`;
  report += `创建时间：${session.createdAt}\n`;
  report += `导出时间：${now}\n\n`;
  
  if (session.recordingNotes) {
    report += `─ 录音备注 ────────────────────────────────────────────────────\n`;
    report += `${session.recordingNotes}\n\n`;
  }
  
  report += `══════════════════════════════════════════════════════════════\n`;
  report += `【 鼓组配置 】\n`;
  report += `══════════════════════════════════════════════════════════════\n\n`;
  
  session.drumPieces.forEach((piece, index) => {
    report += `${index + 1}. ${DRUM_PIECE_NAMES[piece.type] || piece.name}\n`;
    report += `   名称：${piece.name}\n`;
    report += `   尺寸：${piece.size}\n`;
    report += `   位置：X=${piece.position.x.toFixed(3)}m, Y=${piece.position.y.toFixed(3)}m, Z=${piece.position.z.toFixed(3)}m\n`;
    if (piece.notes) {
      report += `   备注：${piece.notes}\n`;
    }
    report += `\n`;
  });
  
  report += `══════════════════════════════════════════════════════════════\n`;
  report += `【 麦克风配置 】\n`;
  report += `══════════════════════════════════════════════════════════════\n\n`;
  
  session.microphones.forEach((mic, index) => {
    const drumPiece = session.drumPieces.find(p => p.id === mic.drumPieceId);
    const pieceName = drumPiece ? (DRUM_PIECE_NAMES[drumPiece.type] || drumPiece.name) : '未关联';
    
    report += `${index + 1}. ${mic.name}\n`;
    report += `   型号：${mic.model || '未指定'}\n`;
    report += `   对应鼓件：${pieceName}\n`;
    report += `   极性模式：${POLAR_PATTERN_NAMES[mic.polarPattern] || mic.polarPattern}\n`;
    report += `   相位反向：${mic.phaseInverted ? '是' : '否'}\n`;
    report += `   距离单位：${DISTANCE_UNIT_NAMES[mic.distanceUnit] || mic.distanceUnit}\n`;
    report += `   增益：${mic.gain > 0 ? '+' : ''}${mic.gain} dB\n`;
    report += `   位置：X=${mic.position.x.toFixed(3)}m, Y=${mic.position.y.toFixed(3)}m, Z=${mic.position.z.toFixed(3)}m\n`;
    report += `   朝向：X=${(mic.rotation.x * 180 / Math.PI).toFixed(1)}°, Y=${(mic.rotation.y * 180 / Math.PI).toFixed(1)}°, Z=${(mic.rotation.z * 180 / Math.PI).toFixed(1)}°\n`;
    if (drumPiece) {
      const distance = Math.sqrt(
        Math.pow(mic.position.x - drumPiece.position.x, 2) +
        Math.pow(mic.position.y - drumPiece.position.y, 2) +
        Math.pow(mic.position.z - drumPiece.position.z, 2)
      );
      report += `   到鼓件距离：${formatDistance(distance, mic.distanceUnit)}\n`;
    }
    if (mic.notes) {
      report += `   备注：${mic.notes}\n`;
    }
    report += `\n`;
  });
  
  report += `══════════════════════════════════════════════════════════════\n`;
  report += `【 相位分析 】\n`;
  report += `══════════════════════════════════════════════════════════════\n\n`;
  
  if (analysis.phaseRelations.length === 0) {
    report += `暂无相位关系数据\n\n`;
  } else {
    analysis.phaseRelations.forEach((relation, index) => {
      const mic1 = session.microphones.find(m => m.id === relation.mic1Id);
      const mic2 = session.microphones.find(m => m.id === relation.mic2Id);
      if (!mic1 || !mic2) return;
      
      const status = relation.isCoherent ? '✓ 同相' : '⚠ 相位偏移';
      report += `${index + 1}. ${mic1.name} ↔ ${mic2.name}\n`;
      report += `   相位差：${relation.phaseDiff.toFixed(1)}° - ${getPhaseLabel(relation.phaseDiff)}\n`;
      report += `   相关性：${(relation.correlation * 100).toFixed(0)}%\n`;
      report += `   状态：${status}\n\n`;
    });
  }
  
  report += `══════════════════════════════════════════════════════════════\n`;
  report += `【 串音分析 】\n`;
  report += `══════════════════════════════════════════════════════════════\n\n`;
  
  const significantCrosstalk = analysis.crosstalkMatrix.filter(c => c.level > -40);
  
  if (significantCrosstalk.length === 0) {
    report += `串音控制良好（均低于-40dB）\n\n`;
  } else {
    significantCrosstalk.forEach((data, index) => {
      const sourceMic = session.microphones.find(m => m.id === data.sourceMicId);
      const targetMic = session.microphones.find(m => m.id === data.targetMicId);
      if (!sourceMic || !targetMic) return;
      
      report += `${index + 1}. ${sourceMic.name} → ${targetMic.name}\n`;
      report += `   串音电平：${data.level.toFixed(1)} dB\n`;
      report += `   频段：${data.frequency === 'low' ? '低频' : data.frequency === 'mid' ? '中频' : '高频'}\n\n`;
    });
  }
  
  report += `══════════════════════════════════════════════════════════════\n`;
  report += `【 问题与建议 】\n`;
  report += `══════════════════════════════════════════════════════════════\n\n`;
  
  if (analysis.errors.length === 0) {
    report += `✓ 当前配置未检测到问题\n\n`;
  } else {
    const errors = analysis.errors.filter(e => e.severity === 'error');
    const warnings = analysis.errors.filter(e => e.severity === 'warning');
    const infos = analysis.errors.filter(e => e.severity === 'info');
    
    if (errors.length > 0) {
      report += `🔴 严重问题（${errors.length}项）：\n`;
      errors.forEach((err, i) => {
        report += `  ${i + 1}. ${err.message}\n`;
        report += `     建议：${err.suggestion}\n\n`;
      });
    }
    
    if (warnings.length > 0) {
      report += `🟡 警告（${warnings.length}项）：\n`;
      warnings.forEach((err, i) => {
        report += `  ${i + 1}. ${err.message}\n`;
        report += `     建议：${err.suggestion}\n\n`;
      });
    }
    
    if (infos.length > 0) {
      report += `🔵 提示（${infos.length}项）：\n`;
      infos.forEach((err, i) => {
        report += `  ${i + 1}. ${err.message}\n`;
        report += `     建议：${err.suggestion}\n\n`;
      });
    }
  }
  
  report += `══════════════════════════════════════════════════════════════\n`;
  report += `报告由鼓组摆位拾音模拟器生成 | https://example.com\n`;
  report += `══════════════════════════════════════════════════════════════\n`;
  
  return report;
}

export function downloadTextFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function captureScreenshot(elementId: string): Promise<string | null> {
  const element = document.getElementById(elementId);
  if (!element) return null;
  
  try {
    const canvas = await html2canvas(element, {
      backgroundColor: '#0f172a',
      scale: 2,
      logging: false,
    });
    return canvas.toDataURL('image/png');
  } catch (error) {
    console.error('截图失败:', error);
    return null;
  }
}

export function downloadImage(dataUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function getReportFilename(sessionName: string, type: 'text' | 'image'): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const safeName = sessionName.replace(/[^\w\u4e00-\u9fa5]/g, '_').substring(0, 30);
  const ext = type === 'text' ? 'txt' : 'png';
  return `${safeName}_拾音方案_${date}.${ext}`;
}
