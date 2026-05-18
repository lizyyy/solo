import { v4 as uuidv4 } from 'uuid';
import {
  FoulAppeal,
  AppealStatus,
  CreateAppealRequest,
  SubmitAppealRequest,
  ReviewAppealRequest,
  SupplementInfoRequest,
  AuditLog
} from '../types';
import { validateStateTransition, isTerminalStatus } from '../utils/statusWorkflow';

let appeals: FoulAppeal[] = [];

function generateAppealNumber(): string {
  const year = new Date().getFullYear();
  const count = appeals.filter(a => a.createdAt.startsWith(year.toString())).length + 1;
  return `BSK-APL-${year}-${String(count).padStart(4, '0')}`;
}

function createAuditLog(
  action: string,
  operator: { id: string; name: string; role: string },
  changes: Record<string, { old: any; new: any }>
): AuditLog {
  return {
    action,
    operatorId: operator.id,
    operatorName: operator.name,
    operatorRole: operator.role,
    timestamp: new Date().toISOString(),
    changes
  };
}

export function createAppeal(request: CreateAppealRequest): { success: boolean; data?: FoulAppeal; error?: { message: string; suggestions: string[] } } {
  const requiredFields = [
    { field: 'gameInfo.leagueName', name: '联赛名称' },
    { field: 'gameInfo.gameDate', name: '比赛日期' },
    { field: 'gameInfo.homeTeam', name: '主队名称' },
    { field: 'gameInfo.awayTeam', name: '客队名称' },
    { field: 'foulDetail.foulType', name: '犯规类型' },
    { field: 'foulDetail.fouler.playerName', name: '犯规球员姓名' },
    { field: 'appealContent.appealingTeam', name: '申诉球队' },
    { field: 'appealContent.teamRepresentative.name', name: '球队代表姓名' },
    { field: 'appealContent.appealReason', name: '申诉理由' }
  ];

  const missingFields: string[] = [];
  for (const { field, name } of requiredFields) {
    const value = field.split('.').reduce((obj: any, key) => obj?.[key], request as any);
    if (!value) {
      missingFields.push(name);
    }
  }

  if (missingFields.length > 0) {
    return {
      success: false,
      error: {
        message: `缺少必填字段: ${missingFields.join('、')}`,
        suggestions: [
          '请补充比赛的完整信息，包括联赛名称、对阵双方和比赛时间',
          '犯规详情需要明确犯规类型和涉事球员信息',
          '申诉内容必须包含申诉球队、代表人和具体理由'
        ]
      }
    };
  }

  const now = new Date().toISOString();
  const appeal: FoulAppeal = {
    id: uuidv4(),
    appealNumber: generateAppealNumber(),
    gameInfo: {
      ...request.gameInfo,
      gameId: uuidv4()
    },
    foulDetail: {
      ...request.foulDetail,
      foulId: uuidv4()
    },
    appealContent: request.appealContent,
    status: AppealStatus.DRAFT,
    reviewHistory: [],
    auditLogs: [createAuditLog('create', request.operator, { appeal: { old: null, new: 'created' } })],
    createdAt: now,
    updatedAt: now,
    crossReferencedAppeals: [],
    tags: []
  };

  appeals.push(appeal);
  return { success: true, data: appeal };
}

export function submitAppeal(request: SubmitAppealRequest): { success: boolean; data?: FoulAppeal; error?: { message: string; suggestions: string[] } } {
  const appeal = appeals.find(a => a.id === request.appealId);
  
  if (!appeal) {
    return {
      success: false,
      error: {
        message: '申诉记录不存在',
        suggestions: ['请检查申诉ID是否正确', '确认该申诉未被删除']
      }
    };
  }

  const validation = validateStateTransition(appeal.status, AppealStatus.SUBMITTED, request.operator.role);
  if (!validation.valid) {
    return { success: false, error: { message: validation.message, suggestions: validation.suggestions } };
  }

  if (appeal.appealContent.supportingDocuments.length === 0) {
    return {
      success: false,
      error: {
        message: '提交申诉必须附带证明材料',
        suggestions: [
          '请上传现场照片或视频录像作为证据',
          '可添加球员或裁判的书面证词',
          '提交比赛记录表或技术统计截图'
        ]
      }
    };
  }

  const oldStatus = appeal.status;
  appeal.status = AppealStatus.SUBMITTED;
  appeal.submittedAt = new Date().toISOString();
  appeal.updatedAt = new Date().toISOString();
  appeal.auditLogs.push(createAuditLog('submit', request.operator, { status: { old: oldStatus, new: AppealStatus.SUBMITTED } }));

  detectCrossReferences(appeal);
  calculateConsistencyScore(appeal);

  return { success: true, data: appeal };
}

export function reviewAppeal(request: ReviewAppealRequest): { success: boolean; data?: FoulAppeal; error?: { message: string; suggestions: string[] } } {
  const appeal = appeals.find(a => a.id === request.appealId);
  
  if (!appeal) {
    return {
      success: false,
      error: {
        message: '申诉记录不存在',
        suggestions: ['请检查申诉ID是否正确', '确认该申诉未被删除']
      }
    };
  }

  const targetStatus = request.reviewResult === 'approved' 
    ? AppealStatus.APPROVED 
    : request.reviewResult === 'rejected'
    ? AppealStatus.REJECTED
    : AppealStatus.NEEDS_MORE_INFO;

  const validation = validateStateTransition(appeal.status, targetStatus, request.reviewer.role);
  if (!validation.valid) {
    return { success: false, error: { message: validation.message, suggestions: validation.suggestions } };
  }

  if (!request.reviewComments || request.reviewComments.length < 10) {
    return {
      success: false,
      error: {
        message: '审核意见不能为空且至少需要10个字符',
        suggestions: [
          '请详细说明审核依据和理由',
          '如驳回需明确指出申诉不成立的原因',
          '如需补充材料请列出具体清单'
        ]
      }
    };
  }

  const oldStatus = appeal.status;
  appeal.status = targetStatus;
  appeal.currentReviewer = request.reviewer.name;
  appeal.reviewHistory.push({
    reviewerId: request.reviewer.id,
    reviewerName: request.reviewer.name,
    reviewTime: new Date().toISOString(),
    reviewResult: request.reviewResult,
    reviewComments: request.reviewComments,
    requiredActions: request.requiredActions
  });

  if (isTerminalStatus(targetStatus)) {
    appeal.resolvedAt = new Date().toISOString();
  }

  appeal.updatedAt = new Date().toISOString();
  appeal.auditLogs.push(createAuditLog('review', request.reviewer, { 
    status: { old: oldStatus, new: targetStatus },
    reviewComments: { old: '', new: request.reviewComments }
  }));

  return { success: true, data: appeal };
}

export function supplementInfo(request: SupplementInfoRequest): { success: boolean; data?: FoulAppeal; error?: { message: string; suggestions: string[] } } {
  const appeal = appeals.find(a => a.id === request.appealId);
  
  if (!appeal) {
    return {
      success: false,
      error: {
        message: '申诉记录不存在',
        suggestions: ['请检查申诉ID是否正确', '确认该申诉未被删除']
      }
    };
  }

  const validation = validateStateTransition(appeal.status, AppealStatus.UNDER_REVIEW, request.operator.role);
  if (!validation.valid) {
    return { success: false, error: { message: validation.message, suggestions: validation.suggestions } };
  }

  if (!request.additionalNotes || request.additionalNotes.length < 20) {
    return {
      success: false,
      error: {
        message: '补充说明不能为空且至少需要20个字符',
        suggestions: [
          '请详细解释或补充之前缺失的信息',
          '如有新证据请一并上传并在此说明',
          '针对审核意见逐条回应'
        ]
      }
    };
  }

  if (request.additionalDocuments) {
    appeal.appealContent.supportingDocuments.push(...request.additionalDocuments);
  }
  appeal.appealContent.additionalNotes = (appeal.appealContent.additionalNotes || '') + '\n\n[补充材料] ' + request.additionalNotes;
  
  const oldStatus = appeal.status;
  appeal.status = AppealStatus.UNDER_REVIEW;
  appeal.updatedAt = new Date().toISOString();
  appeal.auditLogs.push(createAuditLog('supplement', request.operator, { 
    status: { old: oldStatus, new: AppealStatus.UNDER_REVIEW },
    additionalNotes: { old: '', new: request.additionalNotes }
  }));

  return { success: true, data: appeal };
}

export function getAppealById(id: string): FoulAppeal | undefined {
  return appeals.find(a => a.id === id);
}

export function getAllAppeals(filters?: { status?: AppealStatus; team?: string }): FoulAppeal[] {
  let result = [...appeals];
  if (filters?.status) {
    result = result.filter(a => a.status === filters.status);
  }
  if (filters?.team) {
    result = result.filter(a => a.appealContent.appealingTeam.includes(filters.team!));
  }
  return result;
}

function detectCrossReferences(appeal: FoulAppeal): void {
  const sameFoulAppeals = appeals.filter(a => 
    a.id !== appeal.id &&
    a.gameInfo.gameDate === appeal.gameInfo.gameDate &&
    a.gameInfo.homeTeam === appeal.gameInfo.homeTeam &&
    a.gameInfo.awayTeam === appeal.gameInfo.awayTeam &&
    a.foulDetail.fouler.playerNumber === appeal.foulDetail.fouler.playerNumber &&
    Math.abs(a.gameInfo.gameMinute - appeal.gameInfo.gameMinute) <= 2
  );

  appeal.crossReferencedAppeals = sameFoulAppeals.map(a => a.id);
  
  sameFoulAppeals.forEach(a => {
    if (!a.crossReferencedAppeals.includes(appeal.id)) {
      a.crossReferencedAppeals.push(appeal.id);
    }
  });

  if (sameFoulAppeals.length > 0) {
    appeal.tags.push('multi-team-reference');
  }
}

function calculateConsistencyScore(appeal: FoulAppeal): void {
  let score = 100;

  if (appeal.appealContent.supportingDocuments.length === 0) score -= 30;
  if (appeal.appealContent.appealBasis.length === 0) score -= 20;
  if (!appeal.foulDetail.videoEvidence || appeal.foulDetail.videoEvidence.length === 0) score -= 25;
  if (!appeal.appealContent.teamRepresentative.phone) score -= 10;
  if (appeal.appealContent.appealReason.length < 50) score -= 15;

  if (appeal.crossReferencedAppeals.length > 0) {
    const crossRefAppeals = appeal.crossReferencedAppeals.map(id => getAppealById(id)).filter(Boolean) as FoulAppeal[];
    const sameOutcomeCount = crossRefAppeals.filter(a => 
      a.appealContent.requestedOutcome === appeal.appealContent.requestedOutcome
    ).length;
    if (sameOutcomeCount === crossRefAppeals.length && crossRefAppeals.length > 0) {
      score += 15;
    } else {
      score -= 10;
    }
  }

  appeal.consistencyScore = Math.max(0, Math.min(100, score));
}

export function exportAppealsToCSV(status?: AppealStatus): FoulAppeal[] {
  return status ? appeals.filter(a => a.status === status) : [...appeals];
}

export function getAppealStats() {
  return {
    total: appeals.length,
    byStatus: {
      draft: appeals.filter(a => a.status === AppealStatus.DRAFT).length,
      submitted: appeals.filter(a => a.status === AppealStatus.SUBMITTED).length,
      underReview: appeals.filter(a => a.status === AppealStatus.UNDER_REVIEW).length,
      needsMoreInfo: appeals.filter(a => a.status === AppealStatus.NEEDS_MORE_INFO).length,
      approved: appeals.filter(a => a.status === AppealStatus.APPROVED).length,
      rejected: appeals.filter(a => a.status === AppealStatus.REJECTED).length
    },
    crossReferenced: appeals.filter(a => a.crossReferencedAppeals.length > 0).length,
    averageConsistencyScore: appeals.length > 0 
      ? appeals.reduce((sum, a) => sum + (a.consistencyScore || 0), 0) / appeals.length 
      : 0
  };
}

export function setAppeals(data: FoulAppeal[]): void {
  appeals = data;
}
