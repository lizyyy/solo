import jsPDF from 'jspdf';
import type { GameSession, Score, ExportFormat, ErrorDetail } from '@/types/music';
export type { ExportFormat };
import { getErrorTypeSummary, getGradeColor } from '@/engine/gameEngine';
import { getChordById } from '@/data/chords';
import { getProgressionById } from '@/data/progressions';
import type { GameContext } from '@/engine/gameEngine';

export function exportToJSON(session: GameSession): string {
  return JSON.stringify(session, null, 2);
}

export function downloadJSON(data: string, filename: string): void {
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportToCSV(sessions: GameSession[]): string {
  const headers = [
    '学生姓名',
    '游戏名称',
    '开始时间',
    '结束时间',
    '总分',
    '等级',
    '和弦得分',
    '节拍得分',
    '数据问题数',
    '规则问题数',
    '材料问题数',
    '总扣分',
    '是否确认',
    '确认人',
  ];

  const rows = sessions.map((session) => {
    const score = session.score;
    if (!score) return null;
    
    const errorSummary = getErrorTypeSummary(score.errors);
    const totalDeduction = score.errors.reduce((sum, e) => sum + e.deduction, 0);
    
    return [
      session.studentName,
      session.gameId,
      new Date(session.startTime).toLocaleString('zh-CN'),
      session.endTime ? new Date(session.endTime).toLocaleString('zh-CN') : '',
      score.totalScore,
      score.grade,
      score.chordScore,
      score.rhythmScore,
      errorSummary.data.count,
      errorSummary.rule.count,
      errorSummary.material.count,
      totalDeduction,
      session.confirmed ? '是' : '否',
      session.confirmedBy || '',
    ].join(',');
  }).filter(Boolean);

  return [headers.join(','), ...rows].join('\n');
}

export function downloadCSV(data: string, filename: string): void {
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + data], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function exportToPDF(
  session: GameSession,
  context: GameContext
): Promise<Blob> {
  const doc = new jsPDF();
  const score = session.score;
  
  if (!score) {
    throw new Error('Session has no score');
  }

  let yPos = 20;
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFontSize(24);
  doc.setTextColor(26, 26, 46);
  doc.text('爵士即兴接龙局 - 成绩报告', pageWidth / 2, yPos, { align: 'center' });
  
  yPos += 15;
  
  doc.setFontSize(12);
  doc.setTextColor(100);
  doc.text(`学生: ${session.studentName}`, 20, yPos);
  doc.text(`游戏: ${context.game.name}`, 20, yPos + 7);
  doc.text(`日期: ${new Date(session.startTime).toLocaleDateString('zh-CN')}`, pageWidth - 60, yPos);
  
  yPos += 20;
  
  doc.setDrawColor(212, 175, 55);
  doc.setLineWidth(0.5);
  doc.line(20, yPos, pageWidth - 20, yPos);
  
  yPos += 15;

  doc.setFontSize(16);
  doc.setTextColor(26, 26, 46);
  doc.text('综合评分', 20, yPos);
  
  yPos += 15;
  
  const totalScoreX = pageWidth / 2;
  doc.setFontSize(48);
  doc.setTextColor(212, 175, 55);
  doc.text(score.totalScore.toString(), totalScoreX, yPos, { align: 'center' });
  
  doc.setFontSize(14);
  doc.setTextColor(100);
  doc.text(`等级: ${score.grade}`, totalScoreX, yPos + 12, { align: 'center' });
  
  yPos += 30;

  doc.setFontSize(14);
  doc.setTextColor(26, 26, 46);
  doc.text('分项得分', 20, yPos);
  
  yPos += 10;
  
  doc.setFillColor(45, 90, 39);
  doc.roundedRect(20, yPos, 80, 25, 3, 3, 'F');
  doc.setTextColor(255);
  doc.setFontSize(12);
  doc.text(`和弦得分: ${score.chordScore}`, 30, yPos + 16);
  
  doc.setFillColor(46, 58, 90);
  doc.roundedRect(110, yPos, 80, 25, 3, 3, 'F');
  doc.setTextColor(255);
  doc.text(`节拍得分: ${score.rhythmScore}`, 120, yPos + 16);
  
  yPos += 40;

  const errorSummary = getErrorTypeSummary(score.errors);
  
  doc.setFontSize(14);
  doc.setTextColor(26, 26, 46);
  doc.text('错误分析', 20, yPos);
  
  yPos += 12;
  
  const errorTypes = [
    { name: '数据问题 (和弦外音等)', color: [230, 126, 34], ...errorSummary.data },
    { name: '规则问题 (超拍等)', color: [114, 47, 55], ...errorSummary.rule },
    { name: '材料问题 (重复乐句等)', color: [142, 68, 173], ...errorSummary.material },
  ];

  errorTypes.forEach((type) => {
    if (yPos > 250) {
      doc.addPage();
      yPos = 30;
    }
    
    doc.setFillColor(type.color[0], type.color[1], type.color[2]);
    doc.roundedRect(20, yPos, 50, 8, 2, 2, 'F');
    doc.setTextColor(255);
    doc.setFontSize(10);
    doc.text(type.name, 22, yPos + 6);
    
    doc.setTextColor(100);
    doc.text(`${type.count} 处, 扣 ${type.totalDeduction} 分`, 75, yPos + 6);
    
    yPos += 14;
  });

  if (score.errors.length > 0 && score.errors.some(e => e.deduction > 0)) {
    if (yPos > 240) {
      doc.addPage();
      yPos = 30;
    }
    
    yPos += 10;
    doc.setFontSize(14);
    doc.setTextColor(26, 26, 46);
    doc.text('扣分详情', 20, yPos);
    
    yPos += 12;
    
    score.errors.filter(e => e.deduction > 0).slice(0, 10).forEach((error) => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 30;
      }
      
      const typeColors: Record<string, [number, number, number]> = {
        data: [230, 126, 34],
        rule: [114, 47, 55],
        material: [142, 68, 173],
      };
      
      const color = typeColors[error.type] || [100, 100, 100] as [number, number, number];
      doc.setFillColor(color[0], color[1], color[2]);
      doc.roundedRect(20, yPos, 4, 4, 1, 1, 'F');
      
      doc.setFontSize(10);
      doc.setTextColor(60);
      doc.text(
        `第${error.measure}小节第${error.beat}拍: ${error.description} (-${error.deduction}分)`,
        27,
        yPos + 3
      );
      
      yPos += 8;
    });
  }

  if (score.keyDecisions.length > 0) {
    if (yPos > 240) {
      doc.addPage();
      yPos = 30;
    }
    
    yPos += 10;
    doc.setFontSize(14);
    doc.setTextColor(26, 26, 46);
    doc.text('关键选择', 20, yPos);
    
    yPos += 12;
    
    score.keyDecisions.slice(0, 8).forEach((decision) => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 30;
      }
      
      doc.setFillColor(decision.isCorrect ? 45 : 114, decision.isCorrect ? 90 : 47, decision.isCorrect ? 39 : 55);
      doc.roundedRect(20, yPos, 4, 4, 1, 1, 'F');
      
      doc.setFontSize(10);
      doc.setTextColor(60);
      doc.text(
        `第${decision.measure}小节: ${decision.choice}`,
        27,
        yPos + 3
      );
      doc.setTextColor(100);
      doc.setFontSize(9);
      doc.text(decision.explanation, 27, yPos + 12);
      
      yPos += 20;
    });
  }

  if (score.suggestions.length > 0) {
    if (yPos > 220) {
      doc.addPage();
      yPos = 30;
    }
    
    yPos += 10;
    doc.setFontSize(14);
    doc.setTextColor(26, 26, 46);
    doc.text('改进建议', 20, yPos);
    
    yPos += 12;
    
    score.suggestions.forEach((suggestion, index) => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 30;
      }
      
      doc.setFillColor(212, 175, 55);
      doc.roundedRect(20, yPos, 4, 4, 1, 1, 'F');
      
      doc.setFontSize(10);
      doc.setTextColor(60);
      doc.text(`${index + 1}. ${suggestion}`, 27, yPos + 3);
      
      yPos += 10;
    });
  }

  doc.setFontSize(10);
  doc.setTextColor(150);
  doc.text(
    '爵士即兴接龙局 - 由音乐教学平台生成',
    pageWidth / 2,
    290,
    { align: 'center' }
  );

  return doc.output('blob');
}

export async function downloadPDF(
  session: GameSession,
  context: GameContext,
  filename: string
): Promise<void> {
  const blob = await exportToPDF(session, context);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function exportSession(
  session: GameSession,
  context: GameContext,
  format: ExportFormat
): Promise<void> {
  const filename = `${session.studentName}_${context.game.name}_${new Date(session.startTime).toISOString().split('T')[0]}`;
  
  switch (format) {
    case 'json': {
      const data = exportToJSON(session);
      downloadJSON(data, filename);
      break;
    }
    case 'csv': {
      const data = exportToCSV([session]);
      downloadCSV(data, filename);
      break;
    }
    case 'pdf': {
      await downloadPDF(session, context, filename);
      break;
    }
  }
}

export function exportClassReport(
  sessions: GameSession[],
  className: string
): void {
  const filename = `${className}_成绩汇总_${new Date().toISOString().split('T')[0]}`;
  const data = exportToCSV(sessions);
  downloadCSV(data, filename);
}
