import type { FileCard, ConfidentialityLevel, RetentionPeriod, ActionRecord } from '@/types';

export function validateConfidentiality(file: FileCard, level: ConfidentialityLevel): { correct: boolean; reason?: string } {
  if (level === file.confidentiality) {
    return { correct: true };
  }
  const reasons: Record<ConfidentialityLevel, string> = {
    open: '该文件内容敏感，不应定为「公开」级别',
    secret: '该文件保密级别应更高或更低，请重新判断',
    confidential: '该文件保密级别判断有误，请重新评估',
    top_secret: '该文件内容敏感度不足以定为「绝密」级别',
  };
  return { correct: false, reason: reasons[level] };
}

export function validateRetention(file: FileCard, period: RetentionPeriod): { correct: boolean; reason?: string } {
  if (period === file.retentionPeriod) {
    return { correct: true };
  }
  return { correct: false, reason: `保管期限应定为「${period}」，请根据文件类型重新判定` };
}

export function validateBoxAssignment(file: FileCard, boxId: string): { correct: boolean; reason?: string } {
  if (boxId === file.correctBoxId) {
    return { correct: true };
  }
  return { correct: false, reason: `该文件应归入「${file.correctBoxId.replace('box-', '')}」档案盒` };
}

export function validateBorrowRequest(
  registered: boolean,
  needsApproval: boolean,
  approved: boolean
): { correct: boolean; reason?: string } {
  if (!registered) {
    return { correct: false, reason: '借阅请求必须登记' };
  }
  if (needsApproval && !approved) {
    return { correct: false, reason: '该借阅请求需要审批才能通过' };
  }
  return { correct: true };
}

export function calculateScore(correctCount: number, wrongCount: number): number {
  return correctCount * 10 - wrongCount * 5;
}

export function getGrade(score: number, total: number): 'S' | 'A' | 'B' | 'C' | 'D' | 'F' {
  const percentage = total > 0 ? (score / (total * 10)) * 100 : 0;
  if (percentage >= 95) return 'S';
  if (percentage >= 85) return 'A';
  if (percentage >= 75) return 'B';
  if (percentage >= 60) return 'C';
  if (percentage >= 40) return 'D';
  return 'F';
}

export function createActionRecord(
  fileId: string,
  action: ActionRecord['action'],
  value: string,
  isCorrect: boolean,
  errorReason?: string
): ActionRecord {
  return {
    timestamp: new Date().toISOString(),
    fileId,
    action,
    value,
    isCorrect,
    errorReason,
  };
}

export function getFileCategoryRuleHint(file: FileCard): string {
  const hints: Record<string, string> = {
    contract: '【合同类】通常保密级别为「机密」或「秘密」，保管期限多为「永久」或「30年」',
    invoice: '【发票类】通常保密级别为「公开」，保管期限多为「5年」或「10年」',
    confidential: '【保密材料】通常保密级别为「绝密」或「机密」，保管期限多为「永久」或「30年」',
    meeting: '【会议记录】通常保密级别为「秘密」或「公开」，保管期限多为「10年」或「30年」',
    project: '【项目文件】通常保密级别为「机密」或「秘密」，保管期限多为「10年」或「30年」',
  };
  return hints[file.type] || '请根据文件内容判断归档规则';
}