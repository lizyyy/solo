import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { LevelConfig, ScoreDetail, Violation, Operation } from '../types';
import { getViolationTypeLabel, getScoreRating, getRatingColor } from '../engine/scoring';
import { getChemicalById } from '../data/chemicals';

interface ReportData {
  level: LevelConfig;
  scoreDetail: ScoreDetail;
  violations: Violation[];
  operationHistory: Operation[];
  isSuccess: boolean;
  failureReason: string | null;
}

export const generateReport = async (data: ReportData) => {
  const { level, scoreDetail, violations, operationHistory, isSuccess, failureReason } = data;
  
  const rating = getScoreRating(scoreDetail.totalScore, level.targetScore);
  const now = new Date();
  const dateStr = now.toLocaleDateString('zh-CN');
  const timeStr = now.toLocaleTimeString('zh-CN');

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let yPos = margin;

  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, pageWidth, 35, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('化学品仓库配伍游戏 - 培训报告', margin, 22);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`生成时间: ${dateStr} ${timeStr}`, margin, 30);

  yPos = 45;

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('关卡信息', margin, yPos);
  yPos += 8;

  doc.setFillColor(241, 245, 249);
  doc.rect(margin, yPos, pageWidth - margin * 2, 30, 'F');
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`关卡编号:`, margin + 5, yPos + 8);
  doc.text(`关卡名称:`, margin + 5, yPos + 16);
  doc.text(`难度等级:`, margin + 5, yPos + 24);
  
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.text(`${level.id}`, margin + 40, yPos + 8);
  doc.text(`${level.name}`, margin + 40, yPos + 16);
  doc.text(`${'★'.repeat(level.difficulty)}${'☆'.repeat(3 - level.difficulty)}`, margin + 40, yPos + 24);
  
  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'normal');
  doc.text(`目标分数:`, margin + 85, yPos + 8);
  doc.text(`时间限制:`, margin + 85, yPos + 16);
  doc.text(`化学品数量:`, margin + 85, yPos + 24);
  
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.text(`${level.targetScore}`, margin + 125, yPos + 8);
  doc.text(`${level.timeLimit}秒`, margin + 125, yPos + 16);
  doc.text(`${level.chemicalIds.length}个`, margin + 125, yPos + 24);

  yPos += 40;

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('考核结果', margin, yPos);
  yPos += 8;

  if (isSuccess) {
    doc.setFillColor(220, 252, 231);
    doc.setDrawColor(34, 197, 94);
  } else {
    doc.setFillColor(254, 226, 226);
    doc.setDrawColor(239, 68, 68);
  }
  doc.rect(margin, yPos, pageWidth - margin * 2, 35, 'FD');

  doc.setFontSize(12);
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.text('最终得分:', margin + 5, yPos + 12);
  doc.text('评级:', margin + 5, yPos + 25);

  doc.setFontSize(20);
  doc.setTextColor(37, 99, 235);
  doc.text(`${scoreDetail.totalScore}`, margin + 45, yPos + 13);

  doc.setFontSize(24);
  if (rating === 'S' || rating === 'A') {
    doc.setTextColor(34, 197, 94);
  } else if (rating === 'B') {
    doc.setTextColor(59, 130, 246);
  } else if (rating === 'C') {
    doc.setTextColor(245, 158, 11);
  } else {
    doc.setTextColor(239, 68, 68);
  }
  doc.text(rating, margin + 45, yPos + 27);

  doc.setFontSize(11);
  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'normal');
  doc.text('完成状态:', margin + 85, yPos + 12);
  doc.text(isSuccess ? '✅ 任务完成' : '❌ 任务失败', margin + 120, yPos + 12);
  doc.text('是否达标:', margin + 85, yPos + 25);
  const isPassed = scoreDetail.totalScore >= level.targetScore;
  doc.setTextColor(isPassed ? 34 : 239, isPassed ? 197 : 68, isPassed ? 94 : 68);
  doc.text(isPassed ? '是' : '否', margin + 120, yPos + 25);

  yPos += 45;

  if (!isSuccess && failureReason) {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(239, 68, 68);
    doc.text('失败原因', margin, yPos);
    yPos += 8;

    doc.setFillColor(254, 226, 226);
    doc.rect(margin, yPos, pageWidth - margin * 2, 15, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(185, 28, 28);
    doc.text(failureReason, margin + 5, yPos + 10);
    yPos += 25;
  }

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('得分明细', margin, yPos);
  yPos += 8;

  const scoreItems = [
    { label: '基础分', value: scoreDetail.baseScore, positive: true },
    { label: '摆放得分', value: scoreDetail.placementScore, positive: true },
    { label: '完美隔离奖励', value: scoreDetail.isolationBonus, positive: true },
    { label: '温度合规奖励', value: scoreDetail.temperatureBonus, positive: true },
    { label: '提前完成奖励', value: scoreDetail.timeBonus, positive: true },
    { label: '禁忌相邻扣分', value: -scoreDetail.adjacencyPenalty, positive: false },
    { label: '温度超限扣分', value: -scoreDetail.temperaturePenalty, positive: false },
    { label: '隔离不足扣分', value: -scoreDetail.isolationPenalty, positive: false },
    { label: '区域错误扣分', value: -scoreDetail.zonePenalty, positive: false },
    { label: '超时扣分', value: -scoreDetail.timePenalty, positive: false }
  ];

  doc.setFillColor(248, 250, 252);
  doc.rect(margin, yPos, pageWidth - margin * 2, 8, 'F');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('项目', margin + 2, yPos + 5);
  doc.text('分值', pageWidth - margin - 25, yPos + 5);
  yPos += 8;

  scoreItems.forEach((item, i) => {
    if (item.value === 0) return;
    if (yPos > 270) {
      doc.addPage();
      yPos = margin;
    }
    doc.setFillColor(i % 2 === 0 ? 255 : 248, i % 2 === 0 ? 255 : 250, i % 2 === 0 ? 255 : 252);
    doc.rect(margin, yPos, pageWidth - margin * 2, 7, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text(item.label, margin + 2, yPos + 5);
    doc.setTextColor(item.positive ? 34 : 239, item.positive ? 197 : 68, item.positive ? 94 : 68);
    doc.setFont('helvetica', 'bold');
    const valueStr = item.value > 0 ? `+${item.value}` : `${item.value}`;
    doc.text(valueStr, pageWidth - margin - 25, yPos + 5);
    yPos += 7;
  });

  yPos += 3;
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.5);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 8;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('最终得分', margin + 2, yPos + 5);
  doc.setTextColor(37, 99, 235);
  doc.setFontSize(14);
  doc.text(`${scoreDetail.totalScore}`, pageWidth - margin - 30, yPos + 5);

  yPos += 15;

  if (violations.length > 0) {
    if (yPos > 250) {
      doc.addPage();
      yPos = margin;
    }

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(239, 68, 68);
    doc.text(`违规记录 (${violations.length}项)`, margin, yPos);
    yPos += 8;

    violations.slice(0, 10).forEach((v, i) => {
      if (yPos > 270) {
        doc.addPage();
        yPos = margin;
      }
      doc.setFillColor(254, 242, 242);
      doc.rect(margin, yPos, pageWidth - margin * 2, 12, 'F');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(127, 29, 29);
      doc.text(`${i + 1}. ${v.description}`, margin + 3, yPos + 5);
      doc.setTextColor(185, 28, 28);
      doc.setFont('helvetica', 'bold');
      const typeLabel = getViolationTypeLabel(v.type);
      const penaltyStr = v.penalty > 0 ? ` -${v.penalty}分` : ' 严重';
      doc.text(`[${typeLabel}${penaltyStr}]`, pageWidth - margin - 40, yPos + 5);
      yPos += 12;
    });

    if (violations.length > 10) {
      doc.setFontSize(9);
      doc.setTextColor(148, 163, 184);
      doc.text(`... 还有 ${violations.length - 10} 项违规记录`, margin, yPos + 5);
      yPos += 10;
    }
    yPos += 5;
  }

  doc.addPage();
  yPos = margin;

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('操作记录', margin, yPos);
  yPos += 8;

  const getOpSummary = (op: Operation): string => {
    const chemical = op.data.chemicalId ? getChemicalById(op.data.chemicalId) : null;
    switch (op.type) {
      case 'place':
        return `摆放 ${chemical?.name || '化学品'} 到 (${op.data.to?.row},${op.data.to?.col})`;
      case 'remove':
        return `移除 ${chemical?.name || '化学品'} 从 (${op.data.from?.row},${op.data.from?.col})`;
      case 'pause':
        return '暂停游戏';
      case 'resume':
        return '继续游戏';
      case 'end':
        return '游戏结束';
      default:
        return '未知操作';
    }
  };

  doc.setFillColor(248, 250, 252);
  doc.rect(margin, yPos, pageWidth - margin * 2, 8, 'F');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('序号', margin + 2, yPos + 5);
  doc.text('操作内容', margin + 15, yPos + 5);
  doc.text('分数变化', pageWidth - margin - 25, yPos + 5);
  yPos += 8;

  operationHistory.slice(0, 30).forEach((op, i) => {
    if (yPos > 270) {
      doc.addPage();
      yPos = margin;
    }
    doc.setFillColor(i % 2 === 0 ? 255 : 248, i % 2 === 0 ? 255 : 250, i % 2 === 0 ? 255 : 252);
    doc.rect(margin, yPos, pageWidth - margin * 2, 7, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`${i + 1}`, margin + 2, yPos + 5);
    doc.setTextColor(51, 65, 85);
    doc.text(getOpSummary(op), margin + 15, yPos + 5);
    if (op.scoreDelta !== 0) {
      doc.setTextColor(op.scoreDelta > 0 ? 34 : 239, op.scoreDelta > 0 ? 197 : 68, op.scoreDelta > 0 ? 94 : 68);
      doc.setFont('helvetica', 'bold');
      const deltaStr = op.scoreDelta > 0 ? `+${op.scoreDelta}` : `${op.scoreDelta}`;
      doc.text(deltaStr, pageWidth - margin - 25, yPos + 5);
    }
    yPos += 7;
  });

  yPos += 10;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('培训总结与建议', margin, yPos);
  yPos += 8;

  doc.setFillColor(240, 249, 255);
  doc.rect(margin, yPos, pageWidth - margin * 2, 55, 'F');
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  
  const suggestions = [];
  
  if (scoreDetail.adjacencyPenalty > 0) {
    suggestions.push('• 需要加强禁忌相邻规则的学习，注意不同危险类别化学品的配伍禁忌');
  }
  if (scoreDetail.temperaturePenalty > 0) {
    suggestions.push('• 关注温湿度监控，及时调整环境条件以满足化学品存储要求');
  }
  if (scoreDetail.isolationPenalty > 0) {
    suggestions.push('• 注意高危化学品的隔离距离要求，避免相互影响');
  }
  if (scoreDetail.zonePenalty > 0) {
    suggestions.push('• 熟悉特殊存储区域的用途，正确使用防爆柜、冷藏区和毒害区');
  }
  if (scoreDetail.timePenalty > 0) {
    suggestions.push('• 提高操作熟练度，在保证安全的前提下提升操作速度');
  }
  if (violations.length === 0) {
    suggestions.push('• 优秀！没有违规记录，继续保持良好的安全意识');
  }
  if (isSuccess && isPassed) {
    suggestions.push('• 恭喜通过考核！建议定期复习以巩固安全知识');
  } else if (!isSuccess) {
    suggestions.push('• 建议重新学习规则后再次尝试，安全操作需要反复练习');
  }

  suggestions.forEach((s, i) => {
    if (yPos > 270) {
      doc.addPage();
      yPos = margin;
    }
    doc.text(s, margin + 5, yPos + 8 + i * 8);
  });

  yPos += suggestions.length * 8 + 15;

  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.setFont('helvetica', 'italic');
  doc.text('本报告由化学品仓库配伍游戏自动生成，仅供安全培训参考。', margin, yPos);
  doc.text('数据基于真实危化品存储规范，实际操作请严格遵守相关安全规定。', margin, yPos + 6);

  const fileName = `化学品仓储培训报告_${level.name}_${dateStr.replace(/\//g, '-')}.pdf`;
  doc.save(fileName);
};
