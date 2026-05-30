import type {
  Case,
  EvidenceMark,
  RiskAssessment,
  CorrectAnswer,
  RiskLevel,
  ConclusionType
} from '../types';

export const calculateRiskLevel = (score: number): RiskLevel => {
  if (score < 25) return 'low';
  if (score < 50) return 'medium';
  if (score < 75) return 'high';
  return 'critical';
};

export const calculateScoreFromMarks = (
  marks: EvidenceMark[],
  correctAnswer: CorrectAnswer
): number => {
  const requiredMarks = correctAnswer.requiredMarks;
  let matchedCount = 0;

  requiredMarks.forEach(required => {
    const playerMark = marks.find(
      m => m.evidenceType === required.evidenceType &&
           m.evidenceId === required.evidenceId &&
           m.markType === required.markType
    );
    if (playerMark) matchedCount++;
  });

  const baseScore = (matchedCount / requiredMarks.length) * 60;
  const extraMarks = marks.length - matchedCount;
  const penalty = Math.min(extraMarks * 5, 20);
  
  return Math.max(0, Math.min(100, baseScore + 40 - penalty));
};

export const checkMarkCorrectness = (
  mark: EvidenceMark,
  correctAnswer: CorrectAnswer
): { isCorrect: boolean; explanation: string } => {
  const required = correctAnswer.requiredMarks.find(
    r => r.evidenceType === mark.evidenceType &&
         r.evidenceId === mark.evidenceId &&
         r.markType === mark.markType
  );

  if (required) {
    return { isCorrect: true, explanation: required.explanation };
  }

  const partialMatch = correctAnswer.requiredMarks.find(
    r => r.evidenceType === mark.evidenceType &&
         r.evidenceId === mark.evidenceId
  );

  if (partialMatch) {
    return { 
      isCorrect: false, 
      explanation: `证据识别正确，但标记类型有误。正确标记应为：${partialMatch.markType}` 
    };
  }

  return { 
    isCorrect: false, 
    explanation: '此标记不在正确答案范围内，属于过度标记或错误标记' 
  };
};

export const checkConclusionCorrectness = (
  playerConclusion: ConclusionType,
  correctAnswer: CorrectAnswer
): { isCorrect: boolean; explanation: string } => {
  if (playerConclusion === correctAnswer.conclusion) {
    return { isCorrect: true, explanation: '结论判断正确' };
  }

  const explanations: Record<string, string> = {
    'approve-reject': '错误地批准了本应拒赔的案件',
    'approve-supplement': '错误地批准了本应补证的案件',
    'reject-approve': '错误地拒赔了本应批准的案件',
    'reject-supplement': '错误地拒赔了本应补证的案件',
    'supplement-approve': '错误地要求补证，本应直接批准',
    'supplement-reject': '错误地要求补证，本应直接拒赔'
  };

  const key = `${playerConclusion}-${correctAnswer.conclusion}`;
  return { 
    isCorrect: false, 
    explanation: explanations[key] || `结论判断错误，正确结论应为：${correctAnswer.conclusion}` 
  };
};

export const validateJudgment = (
  currentCase: Case,
  marks: EvidenceMark[],
  assessment: RiskAssessment | null
): { isValid: boolean; errors: string[]; warnings: string[] } => {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!assessment) {
    errors.push('请完成风险评分');
    return { isValid: false, errors, warnings };
  }

  if (!assessment.conclusion) {
    errors.push('请选择案件结论');
  }

  if (marks.length === 0) {
    warnings.push('您还没有标记任何疑点，请确认是否已仔细审查所有材料');
  }

  const exemptionClauses = currentCase.policyClauses.filter(c => c.isExemption);
  const hasMarkedExemption = marks.some(m => m.markType === 'exemption');
  
  if (exemptionClauses.length > 0 && !hasMarkedExemption) {
    warnings.push('本案涉及免责条款，建议仔细核查是否适用');
  }

  const photosWithContradictions = currentCase.photoEvidence.filter(p => p.contradictions.length > 0);
  const hasMarkedContradiction = marks.some(m => m.markType === 'contradiction');
  
  if (photosWithContradictions.length > 0 && !hasMarkedContradiction) {
    warnings.push('部分材料中存在矛盾点，建议仔细核查');
  }

  const oldDamagePhotos = currentCase.photoEvidence.filter(p => p.isNewDamage === false);
  const hasMarkedOldDamage = marks.some(m => m.markType === 'old_damage');
  
  if (oldDamagePhotos.length > 0 && !hasMarkedOldDamage) {
    warnings.push('存在疑似旧损的照片，建议仔细识别新旧损伤');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

export const getMarkTypeLabel = (markType: string): string => {
  const labels: Record<string, string> = {
    'suspicious': '可疑点',
    'contradiction': '材料矛盾',
    'exemption': '免责条款',
    'old_damage': '旧损识别'
  };
  return labels[markType] || markType;
};

export const getConclusionLabel = (conclusion: ConclusionType): string => {
  const labels: Record<ConclusionType, string> = {
    'approve': '正常赔付',
    'reject': '拒赔',
    'supplement': '需补证'
  };
  return labels[conclusion] || conclusion;
};

export const getRiskLevelLabel = (level: RiskLevel): string => {
  const labels: Record<RiskLevel, string> = {
    'low': '低风险',
    'medium': '中风险',
    'high': '高风险',
    'critical': '极高风险'
  };
  return labels[level] || level;
};

export const getRiskLevelColor = (level: RiskLevel): string => {
  const colors: Record<RiskLevel, string> = {
    'low': 'text-emerald-500',
    'medium': 'text-amber-500',
    'high': 'text-orange-500',
    'critical': 'text-red-500'
  };
  return colors[level] || 'text-gray-500';
};

export const getRiskLevelBgColor = (level: RiskLevel): string => {
  const colors: Record<RiskLevel, string> = {
    'low': 'bg-emerald-500/20',
    'medium': 'bg-amber-500/20',
    'high': 'bg-orange-500/20',
    'critical': 'bg-red-500/20'
  };
  return colors[level] || 'bg-gray-500/20';
};

export const getMarkTypeColor = (markType: string): string => {
  const colors: Record<string, string> = {
    'suspicious': 'text-detective-accent',
    'contradiction': 'text-red-400',
    'exemption': 'text-purple-400',
    'old_damage': 'text-orange-400'
  };
  return colors[markType] || 'text-gray-400';
};

export const getMarkTypeBgColor = (markType: string): string => {
  const colors: Record<string, string> = {
    'suspicious': 'bg-detective-accent/20',
    'contradiction': 'bg-red-500/20',
    'exemption': 'bg-purple-500/20',
    'old_damage': 'bg-orange-500/20'
  };
  return colors[markType] || 'bg-gray-500/20';
};
