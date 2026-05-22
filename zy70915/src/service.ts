import { v4 as uuidv4 } from "uuid";
import { ClaimInput, Claim, AuditLog, ClaimCategory } from "./types";
import { store } from "./store";
import { classifyClaim, checkTimeLimit } from "./classifier";

export function submitClaim(input: ClaimInput): Claim {
  const duplicate = store.findDuplicate(input);
  if (duplicate) {
    return {
      ...duplicate,
      isDuplicate: true,
      originalClaimId: duplicate.id
    };
  }

  const categoryResult = classifyClaim(input);
  const timeCheck = checkTimeLimit(input);

  const claim: Claim = {
    ...input,
    id: uuidv4(),
    category: categoryResult.category,
    categoryReason: categoryResult.reason,
    nextAction: categoryResult.nextAction,
    submitTime: new Date(),
    updateTime: new Date(),
    isDuplicate: false,
    timeLimitExceeded: timeCheck.exceeded,
    timeLimitReason: timeCheck.reason,
    reportGenerated: categoryResult.category === ClaimCategory.NORMAL
  };

  store.addClaim(claim);

  addAuditLog({
    claimId: claim.id,
    modifiedBy: input.submittedBy,
    fieldName: "category",
    oldValue: null,
    newValue: claim.category,
    reason: "系统自动分类"
  });

  return claim;
}

export function getClaim(id: string): Claim | undefined {
  return store.getClaim(id);
}

export function getAllClaims(): Claim[] {
  return store.getAllClaims();
}

export function updateClaimCategory(
  claimId: string,
  newCategory: ClaimCategory,
  reason: string,
  modifiedBy: string
): Claim | undefined {
  const claim = store.getClaim(claimId);
  if (!claim) return undefined;

  const oldCategory = claim.category;

  const updated = store.updateClaim(claimId, {
    category: newCategory,
    categoryReason: reason,
    nextAction: getNextActionForCategory(newCategory)
  });

  if (updated) {
    addAuditLog({
      claimId,
      modifiedBy,
      fieldName: "category",
      oldValue: oldCategory,
      newValue: newCategory,
      reason
    });
  }

  return updated;
}

function getNextActionForCategory(category: ClaimCategory): string {
  switch (category) {
    case ClaimCategory.NORMAL:
      return "进入正常赔付流程，预计3个工作日内完成审核";
    case ClaimCategory.PENDING_SUPPLEMENT:
      return "请地服人员联系乘客补充缺失材料";
    case ClaimCategory.BLOCKED:
      return "已拦截，需主管审批后才能继续处理";
    default:
      return "待处理";
  }
}

export function addAuditLog(log: Omit<AuditLog, "id" | "modifyTime">): void {
  const auditLog: AuditLog = {
    ...log,
    id: uuidv4(),
    modifyTime: new Date()
  };
  store.addAuditLog(auditLog);
}

export function getAuditLogs(claimId: string): AuditLog[] {
  return store.getAuditLogs(claimId);
}

export function getClaimTraceability(claimId: string): any {
  const claim = store.getClaim(claimId);
  if (!claim) return null;

  const auditLogs = store.getAuditLogs(claimId);

  return {
    claimId: claim.id,
    keyFields: {
      baggageTag: claim.baggage.tagNumber,
      responsibility: claim.responsibility,
      photoTimes: claim.photos.map(p => ({
        url: p.url,
        timestamp: p.timestamp,
        description: p.description
      })),
      estimatedValue: claim.estimatedValue,
      damageDescription: claim.damageDescription
    },
    currentStatus: {
      category: claim.category,
      reason: claim.categoryReason,
      nextAction: claim.nextAction,
      reportGenerated: claim.reportGenerated
    },
    timeLimit: {
      exceeded: claim.timeLimitExceeded,
      reason: claim.timeLimitReason
    },
    auditTrail: auditLogs.map(log => ({
      time: log.modifyTime,
      operator: log.modifiedBy,
      field: log.fieldName,
      from: log.oldValue,
      to: log.newValue,
      reason: log.reason
    }))
  };
}
