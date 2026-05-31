import { Record, Flag } from '@/types';

export function detectEquivalentAnswerMismatch(
  studentAnswer: string,
  standardAnswer: string
): Flag | null {
  const normalizedStudent = normalizeAnswer(studentAnswer);
  const normalizedStandard = normalizeAnswer(standardAnswer);
  
  if (normalizedStudent === normalizedStandard) {
    return null;
  }
  
  const similarity = calculateSimilarity(normalizedStudent, normalizedStandard);
  
  if (similarity > 0.7 && similarity < 0.95) {
    return {
      type: 'equivalent_answer_mismatch',
      description: `学生答案"${studentAnswer}"与标准答案"${standardAnswer}"疑似等价表达，建议人工确认`,
      confidence: similarity
    };
  }
  
  return null;
}

export function detectEmptySetBoundary(record: Record): Flag | null {
  const { studentAnswer, standardAnswer, questionTitle, knowledgePoint } = record;
  
  const isSetRelated = ['集合', '定义域', '值域', '解集'].some(
    keyword => questionTitle.includes(keyword) || knowledgePoint.includes(keyword)
  );
  
  if (!isSetRelated) return null;
  
  const studentMentionsEmpty = ['空集', '∅', '{}', '无解'].some(
    keyword => studentAnswer.includes(keyword)
  );
  
  const standardMentionsEmpty = ['空集', '∅', '{}', '无解'].some(
    keyword => standardAnswer.includes(keyword)
  );
  
  const standardHasZero = standardAnswer.includes('{0}') || standardAnswer.includes('0');
  const studentSaysEmpty = studentMentionsEmpty && !studentAnswer.includes('0');
  
  if (standardHasZero && studentSaysEmpty) {
    return {
      type: 'empty_set_boundary',
      description: `学生将"{0}"误判为空集，边界概念可能混淆`,
      confidence: 0.85
    };
  }
  
  if (studentMentionsEmpty !== standardMentionsEmpty) {
    return {
      type: 'empty_set_boundary',
      description: `空集边界判定存在差异：学生${studentMentionsEmpty ? '认为' : '未提'}空集，标准答案${standardMentionsEmpty ? '包含' : '不包含'}空集`,
      confidence: 0.75
    };
  }
  
  return null;
}

export function detectStepScoringBias(record: Record): Flag | null {
  const { score, fullScore, studentAnswer, standardAnswer, corrections } = record;
  
  const scoreRatio = score / fullScore;
  
  const studentLength = studentAnswer.length;
  const standardLength = standardAnswer.length;
  const completenessRatio = studentLength / standardLength;
  
  const hasCorrection = corrections.length > 0;
  
  if (hasCorrection) {
    return {
      type: 'step_scoring_bias',
      description: `该记录存在人工更正（${corrections[0].reason}），建议复核分步得分合理性`,
      confidence: 0.9
    };
  }
  
  if (completenessRatio > 0.6 && scoreRatio < 0.4) {
    return {
      type: 'step_scoring_bias',
      description: `答案完整度约${Math.round(completenessRatio * 100)}%，但得分率仅${Math.round(scoreRatio * 100)}%，可能分步给分偏严`,
      confidence: 0.65
    };
  }
  
  if (completenessRatio < 0.4 && scoreRatio > 0.7) {
    return {
      type: 'step_scoring_bias',
      description: `答案完整度约${Math.round(completenessRatio * 100)}%，但得分率达${Math.round(scoreRatio * 100)}%，可能分步给分偏宽`,
      confidence: 0.65
    };
  }
  
  return null;
}

function normalizeAnswer(answer: string): string {
  return answer
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/，/g, ',')
    .replace(/。/g, '.')
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/【/g, '[')
    .replace(/】/g, ']')
    .replace(/∈/g, 'in')
    .replace(/∪/g, 'u')
    .replace(/∩/g, 'n')
    .replace(/∞/g, 'inf')
    .replace(/-∞/g, '-inf')
    .replace(/\+∞/g, '+inf');
}

function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const costs: number[] = [];
  for (let i = 0; i <= shorter.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= longer.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (shorter.charAt(i - 1) !== longer.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[longer.length] = lastValue;
  }
  
  return (longer.length - costs[longer.length]) / longer.length;
}

export function detectAllFlags(record: Record): Flag[] {
  const flags: Flag[] = [];
  
  const equivalentFlag = detectEquivalentAnswerMismatch(
    record.studentAnswer,
    record.standardAnswer
  );
  if (equivalentFlag) flags.push(equivalentFlag);
  
  const emptySetFlag = detectEmptySetBoundary(record);
  if (emptySetFlag) flags.push(emptySetFlag);
  
  const stepScoringFlag = detectStepScoringBias(record);
  if (stepScoringFlag) flags.push(stepScoringFlag);
  
  return flags;
}
