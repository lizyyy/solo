import { Record, AnalysisResult, MatrixCell, EvidenceItem, StatusType } from '@/types';
import { detectAllFlags } from './detection';
import { knowledgePoints, errorTypes } from '@/data/mockData';

export function transformRecordsToMatrix(records: Record[]): MatrixCell[][] {
  const matrix: MatrixCell[][] = [];
  
  knowledgePoints.forEach((kp, kpIndex) => {
    matrix[kpIndex] = [];
    errorTypes.forEach((et, etIndex) => {
      const matchingRecords = records.filter(r => {
        const matchesKP = r.knowledgePoint === kp;
        const matchesErrorType = classifyErrorType(r) === et;
        return matchesKP && matchesErrorType;
      });
      
      const hasHighPriorityFlags = matchingRecords.some(r => {
        const flags = detectAllFlags(r);
        return flags.some(f => f.confidence > 0.8);
      });
      
      let status: StatusType = 'normal';
      if (hasHighPriorityFlags) {
        status = 'pending';
      }
      if (matchingRecords.some(r => r.source === 'late' || r.isDuplicate)) {
        status = 'warning';
      }
      
      matrix[kpIndex][etIndex] = {
        knowledgePoint: kp,
        errorType: et,
        count: matchingRecords.length,
        recordIds: matchingRecords.map(r => r.id),
        status
      };
    });
  });
  
  return matrix;
}

export function analyzeRecords(records: Record[]): AnalysisResult[] {
  return records.map(record => {
    const flags = detectAllFlags(record);
    
    let status: StatusType = 'normal';
    if (flags.some(f => f.confidence > 0.8)) {
      status = 'pending';
    }
    if (record.source === 'late' || record.isDuplicate || record.corrections.length > 0) {
      status = 'warning';
    }
    
    return {
      id: `analysis_${record.id}`,
      recordId: record.id,
      status,
      flags,
      matrixPosition: {
        knowledgePoint: record.knowledgePoint,
        errorType: classifyErrorType(record)
      },
      evidenceChain: buildEvidenceChain(record)
    };
  });
}

function classifyErrorType(record: Record): string {
  const { score, fullScore, studentAnswer, standardAnswer } = record;
  const scoreRatio = score / fullScore;
  
  if (scoreRatio === 1) return '计算错误';
  
  const conceptKeywords = ['定义', '概念', '性质', '定理'];
  const hasConceptIssue = conceptKeywords.some(kw => 
    record.knowledgePoint.includes(kw) || 
    record.questionTitle.includes(kw)
  );
  
  if (hasConceptIssue && scoreRatio < 0.5) {
    return '概念误解';
  }
  
  if (studentAnswer.length < standardAnswer.length * 0.5) {
    return '步骤遗漏';
  }
  
  if (scoreRatio >= 0.6 && scoreRatio < 1) {
    return '表达不规范';
  }
  
  return '答案不完整';
}

function buildEvidenceChain(record: Record): EvidenceItem[] {
  const evidence: EvidenceItem[] = [];
  
  evidence.push({
    id: `ev_${record.id}_student`,
    type: 'student_answer',
    content: record.studentAnswer,
    timestamp: record.createdAt
  });
  
  evidence.push({
    id: `ev_${record.id}_standard`,
    type: 'standard_answer',
    content: record.standardAnswer,
    timestamp: record.createdAt
  });
  
  record.attachments.forEach(att => {
    evidence.push({
      id: `ev_${record.id}_${att.id}`,
      type: 'screenshot',
      content: att.name,
      url: att.url,
      timestamp: att.timestamp
    });
  });
  
  record.corrections.forEach(corr => {
    evidence.push({
      id: `ev_${record.id}_${corr.id}`,
      type: 'correction_note',
      content: `${corr.operator} 将 ${corr.field} 从 "${corr.before}" 改为 "${corr.after}"，原因：${corr.reason}`,
      timestamp: corr.timestamp
    });
  });
  
  return evidence.sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
}

export function getRecordsByMatrixCell(
  records: Record[],
  knowledgePoint: string,
  errorType: string
): Record[] {
  return records.filter(r => 
    r.knowledgePoint === knowledgePoint && 
    classifyErrorType(r) === errorType
  );
}
