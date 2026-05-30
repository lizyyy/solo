import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import type {
  Case,
  EvidenceMark,
  RiskAssessment,
  InvestigationReport,
  EvidenceAnalysis,
  ClauseMatch,
  MistakeItem,
  PlayerPerformance,
  PlaybackRecord
} from '../types';
import {
  getMarkTypeLabel,
  getConclusionLabel,
  getRiskLevelLabel,
  checkMarkCorrectness,
  checkConclusionCorrectness
} from './gameEngine';
import { getPlaybackDuration, formatTime } from './playbackManager';

export const generateReport = (
  currentCase: Case,
  marks: EvidenceMark[],
  assessment: RiskAssessment | null,
  playbackRecord: PlaybackRecord | null
): InvestigationReport => {
  const evidenceAnalysis: EvidenceAnalysis[] = [];
  const clauseMatches: ClauseMatch[] = [];
  const errorsFound: MistakeItem[] = [];

  const correctAnswer = currentCase.correctAnswer;

  correctAnswer.requiredMarks.forEach(required => {
    const playerMark = marks.find(
      m => m.evidenceType === required.evidenceType &&
           m.evidenceId === required.evidenceId
    );

    let description = '';
    if (required.evidenceType === 'accident') {
      description = currentCase.accidentCard.mainInfo.substring(0, 50) + '...';
    } else if (required.evidenceType === 'clause') {
      const clause = currentCase.policyClauses.find(c => c.id === required.evidenceId);
      description = clause ? clause.clauseNo : '';
    } else if (required.evidenceType === 'photo') {
      const photo = currentCase.photoEvidence.find(p => p.id === required.evidenceId);
      description = photo ? photo.description.substring(0, 50) + '...' : '';
    }

    evidenceAnalysis.push({
      evidenceType: required.evidenceType,
      evidenceId: required.evidenceId,
      description,
      playerMark: playerMark ? getMarkTypeLabel(playerMark.markType) : '未标记',
      correctMark: getMarkTypeLabel(required.markType),
      isCorrect: !!playerMark && playerMark.markType === required.markType
    });
  });

  marks.forEach(mark => {
    const isInCorrect = correctAnswer.requiredMarks.some(
      r => r.evidenceType === mark.evidenceType &&
           r.evidenceId === mark.evidenceId &&
           r.markType === mark.markType
    );
    if (!isInCorrect) {
      let description = '';
      if (mark.evidenceType === 'accident') {
        description = currentCase.accidentCard.mainInfo.substring(0, 50) + '...';
      } else if (mark.evidenceType === 'clause') {
        const clause = currentCase.policyClauses.find(c => c.id === mark.evidenceId);
        description = clause ? clause.clauseNo : '';
      } else if (mark.evidenceType === 'photo') {
        const photo = currentCase.photoEvidence.find(p => p.id === mark.evidenceId);
        description = photo ? photo.description.substring(0, 50) + '...' : '';
      }
      evidenceAnalysis.push({
        evidenceType: mark.evidenceType,
        evidenceId: mark.evidenceId,
        description,
        playerMark: getMarkTypeLabel(mark.markType),
        correctMark: '无需标记',
        isCorrect: false
      });
    }
  });

  currentCase.policyClauses.forEach(clause => {
    const shouldMatch = correctAnswer.requiredMarks.some(
      r => r.evidenceType === 'clause' && r.evidenceId === clause.id
    );
    const playerMatched = marks.some(
      m => m.matchedClauseId === clause.id ||
           (m.evidenceType === 'clause' && m.evidenceId === clause.id)
    );

    const required = correctAnswer.requiredMarks.find(
      r => r.evidenceType === 'clause' && r.evidenceId === clause.id
    );

    clauseMatches.push({
      clauseId: clause.id,
      clauseNo: clause.clauseNo,
      playerMatched,
      shouldMatch,
      explanation: required?.explanation || (shouldMatch ? '此条款与本案相关，应予以关注' : '此条款与本案无直接关联')
    });
  });

  if (assessment) {
    const conclusionCheck = checkConclusionCorrectness(assessment.conclusion, correctAnswer);
    if (!conclusionCheck.isCorrect) {
      const mistake = correctAnswer.commonMistakes.find(m => 
        m.description.includes(conclusionCheck.explanation) ||
        conclusionCheck.explanation.includes(m.mistakeType)
      );
      errorsFound.push({
        type: '结论判断错误',
        description: conclusionCheck.explanation,
        ruleBasis: mistake?.ruleBasis || '理赔结论判断规范',
        severity: 'critical'
      });
    }
  }

  const missedMarks = correctAnswer.requiredMarks.filter(required => {
    return !marks.some(
      m => m.evidenceType === required.evidenceType &&
           m.evidenceId === required.evidenceId &&
           m.markType === required.markType
    );
  });

  missedMarks.forEach(missed => {
    const mistake = correctAnswer.commonMistakes.find(m => 
      m.description.includes(missed.explanation) ||
      missed.explanation.includes(m.mistakeType) ||
      (missed.markType === 'exemption' && m.mistakeType === '免责条款漏看') ||
      (missed.markType === 'old_damage' && m.mistakeType === '旧损当新损') ||
      (missed.markType === 'contradiction' && m.mistakeType === '材料矛盾未识别')
    );

    const mistakeTypeMap: Record<string, string> = {
      'exemption': '免责条款漏看',
      'old_damage': '旧损识别错误',
      'contradiction': '材料矛盾未识别',
      'suspicious': '可疑点未发现'
    };

    errorsFound.push({
      type: mistake?.mistakeType || mistakeTypeMap[missed.markType] || '证据漏检',
      description: missed.explanation,
      ruleBasis: mistake?.ruleBasis || '理赔调查操作规范',
      severity: mistake ? 'major' : 'minor'
    });
  });

  const extraMarks = marks.filter(mark => {
    return !correctAnswer.requiredMarks.some(
      r => r.evidenceType === mark.evidenceType &&
           r.evidenceId === mark.evidenceId &&
           r.markType === mark.markType
    );
  });

  extraMarks.forEach(extra => {
    const check = checkMarkCorrectness(extra, correctAnswer);
    errorsFound.push({
      type: '过度标记',
      description: check.explanation,
      ruleBasis: '证据标记操作规范',
      severity: 'minor'
    });
  });

  const correctCount = evidenceAnalysis.filter(e => e.isCorrect).length;
  const totalCount = correctAnswer.requiredMarks.length;
  const accuracy = totalCount > 0 ? (correctCount / totalCount) * 100 : 0;
  const timeSpent = playbackRecord ? getPlaybackDuration(playbackRecord) : 0;

  const strengths: string[] = [];
  const improvements: string[] = [];

  if (accuracy >= 80) {
    strengths.push('证据识别准确率高');
  }
  if (marks.some(m => m.markType === 'exemption') && 
      correctAnswer.requiredMarks.some(r => r.markType === 'exemption')) {
    strengths.push('能够正确识别免责条款');
  }
  if (marks.some(m => m.markType === 'old_damage') && 
      correctAnswer.requiredMarks.some(r => r.markType === 'old_damage')) {
    strengths.push('能够准确识别新旧损伤');
  }
  if (marks.some(m => m.markType === 'contradiction') && 
      correctAnswer.requiredMarks.some(r => r.markType === 'contradiction')) {
    strengths.push('能够发现材料之间的矛盾点');
  }

  if (accuracy < 60) {
    improvements.push('提升证据识别的准确性');
  }
  if (missedMarks.some(m => m.markType === 'exemption')) {
    improvements.push('加强对免责条款的敏感度');
  }
  if (missedMarks.some(m => m.markType === 'old_damage')) {
    improvements.push('提高新旧损伤的识别能力');
  }
  if (missedMarks.some(m => m.markType === 'contradiction')) {
    improvements.push('注意发现材料之间的矛盾点');
  }
  if (extraMarks.length > 2) {
    improvements.push('避免过度标记，聚焦关键证据');
  }

  const report: InvestigationReport = {
    id: `report_${currentCase.id}_${Date.now()}`,
    caseId: currentCase.id,
    caseSummary: {
      title: currentCase.title,
      accidentTime: currentCase.accidentCard.accidentTime,
      location: currentCase.accidentCard.location,
      claimAmount: currentCase.accidentCard.claimAmount
    },
    evidenceAnalysis,
    clauseMatches,
    errorsFound,
    riskAssessment: assessment || {
      caseId: currentCase.id,
      score: 0,
      level: 'low',
      conclusion: 'supplement',
      supplementReasons: [],
      riskPoints: []
    },
    playerPerformance: {
      totalPoints: correctAnswer.requiredMarks.length * 10 + 20,
      earnedPoints: correctCount * 10 + (assessment?.conclusion === correctAnswer.conclusion ? 20 : 0),
      accuracy,
      timeSpent,
      strengths,
      improvements
    },
    finalConclusion: generateFinalConclusion(currentCase, assessment, errorsFound),
    generatedAt: Date.now()
  };

  return report;
};

const generateFinalConclusion = (
  currentCase: Case,
  assessment: RiskAssessment | null,
  errorsFound: MistakeItem[]
): string => {
  const correctAnswer = currentCase.correctAnswer;
  const playerConclusion = assessment?.conclusion;
  const isCorrect = playerConclusion === correctAnswer.conclusion;

  if (isCorrect && errorsFound.length === 0) {
    return `本案调查完成，结论判断正确（${getConclusionLabel(correctAnswer.conclusion)}）。` +
           `所有关键证据均已正确识别，风险评估准确。` +
           `建议加强对类似案件的经验总结。`;
  }

  let conclusion = `本案调查已完成。`;
  
  if (playerConclusion) {
    conclusion += `您的判断为"${getConclusionLabel(playerConclusion)}"，` +
                  `正确结论应为"${getConclusionLabel(correctAnswer.conclusion)}"。`;
  }

  if (errorsFound.length > 0) {
    const criticalErrors = errorsFound.filter(e => e.severity === 'critical').length;
    const majorErrors = errorsFound.filter(e => e.severity === 'major').length;
    const minorErrors = errorsFound.filter(e => e.severity === 'minor').length;

    conclusion += `本次调查共发现 ${errorsFound.length} 处问题：` +
                  `严重错误 ${criticalErrors} 处，` +
                  `重要错误 ${majorErrors} 处，` +
                  `一般问题 ${minorErrors} 处。`;
  }

  conclusion += `请仔细阅读错误分析部分，理解相关规则依据，` +
                `通过回放功能回顾调查过程，避免在实际工作中出现类似问题。`;

  return conclusion;
};

export const saveReportToStorage = (report: InvestigationReport): void => {
  try {
    const key = `report_${report.caseId}`;
    const existingReports = JSON.parse(localStorage.getItem('reports') || '[]');
    const filtered = existingReports.filter((r: InvestigationReport) => r.caseId !== report.caseId);
    filtered.push(report);
    localStorage.setItem('reports', JSON.stringify(filtered));
    localStorage.setItem(key, JSON.stringify(report));
  } catch (e) {
    console.error('Failed to save report:', e);
  }
};

export const loadReportFromStorage = (caseId: string): InvestigationReport | null => {
  try {
    const key = `report_${caseId}`;
    const data = localStorage.getItem(key);
    if (data) {
      return JSON.parse(data) as InvestigationReport;
    }
    return null;
  } catch (e) {
    console.error('Failed to load report:', e);
    return null;
  }
};

export const exportReportToPDF = async (
  report: InvestigationReport,
  elementId: string
): Promise<void> => {
  try {
    const element = document.getElementById(elementId);
    if (!element) {
      throw new Error('Report element not found');
    }

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
    const imgX = (pdfWidth - imgWidth * ratio) / 2;
    const imgY = 10;

    pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
    pdf.save(`理赔调查报告_${report.caseId}_${new Date(report.generatedAt).toLocaleDateString('zh-CN')}.pdf`);
  } catch (e) {
    console.error('Failed to export PDF:', e);
    throw e;
  }
};

export const getSeverityLabel = (severity: string): string => {
  const labels: Record<string, string> = {
    'minor': '一般',
    'major': '重要',
    'critical': '严重'
  };
  return labels[severity] || severity;
};

export const getSeverityColor = (severity: string): string => {
  const colors: Record<string, string> = {
    'minor': 'text-amber-500',
    'major': 'text-orange-500',
    'critical': 'text-red-500'
  };
  return colors[severity] || 'text-gray-500';
};
