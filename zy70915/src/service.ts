import { v4 as uuidv4 } from "uuid";
import { ClaimInput, Claim, AuditLog, ClaimCategory, CompensationReport } from "./types";
import { store } from "./store";
import { classifyClaim, checkTimeLimit } from "./classifier";

function generateReportNumber(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  return `BC${dateStr}${random}`;
}

export function generateCompensationReport(claim: Claim): CompensationReport {
  const photoTimes = claim.photos.map(p => new Date(p.timestamp).getTime());
  const earliestPhotoTime = new Date(Math.min(...photoTimes));
  const latestPhotoTime = new Date(Math.max(...photoTimes));
  const timeCheck = checkTimeLimit(claim);

  let responsibilityConclusion = "";
  switch (claim.responsibility) {
    case "airline":
      responsibilityConclusion = "经核实，该行李破损发生在航空公司运输环节，由航空公司承担赔付责任";
      break;
    case "airport":
      responsibilityConclusion = "经核实，该行李破损发生在机场装卸或存储环节，由机场承担赔付责任";
      break;
    case "transfer":
      responsibilityConclusion = "经核实，该行李破损发生在中转环节，需进一步确认具体责任方";
      break;
    default:
      responsibilityConclusion = "责任方待核实，需补充调查";
  }

  const report: CompensationReport = {
    id: uuidv4(),
    claimId: claim.id,
    reportNumber: generateReportNumber(),
    generateTime: new Date(),
    status: "pending",
    keyFieldsSnapshot: {
      baggageTag: claim.baggage.tagNumber,
      responsibility: claim.responsibility,
      photoCount: claim.photos.length,
      earliestPhotoTime,
      latestPhotoTime,
      estimatedValue: claim.estimatedValue,
      damageDescription: claim.damageDescription
    },
    responsibilityConclusion,
    timeLimitVerification: {
      arrivalTime: new Date(claim.baggage.arrivalDate),
      reportingTime: latestPhotoTime,
      withinLimit: !timeCheck.exceeded,
      hoursDiff: timeCheck.hoursDiff
    }
  };

  store.addReport(report);
  return report;
}

export function submitClaim(input: ClaimInput): Claim & { report?: CompensationReport } {
  const duplicate = store.findDuplicate(input);
  if (duplicate) {
    const existingReport = store.getReportByClaimId(duplicate.id);
    return {
      ...duplicate,
      isDuplicate: true,
      originalClaimId: duplicate.id,
      report: existingReport
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
    responsibilityAnalysis: categoryResult.responsibilityAnalysis,
    reportGenerated: categoryResult.category === ClaimCategory.NORMAL
  };

  store.addClaim(claim);

  let report: CompensationReport | undefined;
  if (claim.category === ClaimCategory.NORMAL) {
    report = generateCompensationReport(claim);
    store.updateClaim(claim.id, { reportId: report.id });
  }

  addAuditLog({
    claimId: claim.id,
    modifiedBy: input.submittedBy,
    fieldName: "category",
    oldValue: null,
    newValue: claim.category,
    reason: "系统自动分类"
  });

  return { ...claim, report };
}

export function getClaim(id: string): Claim | undefined {
  return store.getClaim(id);
}

export function getAllClaims(): Claim[] {
  return store.getAllClaims();
}

export function getReport(id: string): CompensationReport | undefined {
  return store.getReport(id);
}

export function getReportByClaimId(claimId: string): CompensationReport | undefined {
  return store.getReportByClaimId(claimId);
}

export function getAllReports(): CompensationReport[] {
  return store.getAllReports();
}

export function approveReport(
  reportId: string,
  approvedAmount: number,
  reviewer: string,
  reviewNotes?: string
): CompensationReport | undefined {
  const report = store.getReport(reportId);
  if (!report) return undefined;

  return store.updateReport(reportId, {
    status: "approved",
    approvedAmount,
    reviewer,
    reviewNotes
  });
}

export function rejectReport(
  reportId: string,
  reviewer: string,
  reviewNotes: string
): CompensationReport | undefined {
  const report = store.getReport(reportId);
  if (!report) return undefined;

  return store.updateReport(reportId, {
    status: "rejected",
    reviewer,
    reviewNotes
  });
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

    if (newCategory === ClaimCategory.NORMAL && !claim.reportId) {
      const report = generateCompensationReport(updated);
      store.updateClaim(claimId, { reportId: report.id, reportGenerated: true });
    }
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
  const report = store.getReportByClaimId(claimId);

  return {
    claimId: claim.id,
    originalInput: {
      baggage: claim.baggage,
      passengerName: claim.passengerName,
      passengerPhone: claim.passengerPhone,
      damageDescription: claim.damageDescription,
      photos: claim.photos.map(p => ({
        url: p.url,
        timestamp: p.timestamp,
        description: p.description
      })),
      estimatedValue: claim.estimatedValue,
      submittedBy: claim.submittedBy,
      responsibility: claim.responsibility
    },
    keyFields: {
      baggageTag: claim.baggage.tagNumber,
      responsibility: claim.responsibility,
      responsibilityAnalysis: claim.responsibilityAnalysis,
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
      reportGenerated: claim.reportGenerated,
      reportId: claim.reportId
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
    })),
    report: report ? {
      reportNumber: report.reportNumber,
      generateTime: report.generateTime,
      status: report.status,
      approvedAmount: report.approvedAmount,
      reviewer: report.reviewer,
      reviewNotes: report.reviewNotes,
      keyFieldsSnapshot: report.keyFieldsSnapshot,
      responsibilityConclusion: report.responsibilityConclusion,
      timeLimitVerification: report.timeLimitVerification
    } : null
  };
}
