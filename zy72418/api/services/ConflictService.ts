import type { ConflictRecord, ResolveConflictRequest } from "@shared/types";
import { ConflictRepository } from "../repositories/ConflictRepository";
import { AuthorizationRepository } from "../repositories/AuthorizationRepository";
import { RecordRepository } from "../repositories/RecordRepository";
import { AuditRepository } from "../repositories/AuditRepository";

export class ConflictService {
  constructor(
    private conflictRepo: ConflictRepository,
    private authRepo: AuthorizationRepository,
    private recordRepo: RecordRepository,
    private auditRepo: AuditRepository
  ) {}

  detectConflicts(recordId: string): ConflictRecord[] {
    const record = this.recordRepo.findById(recordId);
    if (!record) return [];

    const authPage = this.authRepo.findByRecordId(recordId);
    if (!authPage) return [];

    const conflicts: ConflictRecord[] = [];

    if (record.authorizationExpiryDate && record.authorizationExpiryDate !== authPage.expiryDate) {
      const existing = this.conflictRepo
        .findByRecordId(recordId)
        .find(
          (c) =>
            c.fieldName === "authorization_expiry_date" &&
            c.audioRemarkValue === record.authorizationExpiryDate &&
            c.authorizationValue === authPage.expiryDate &&
            c.resolution === null
        );

      if (!existing) {
        const conflict = this.conflictRepo.create({
          id: `conf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          recordId,
          fieldName: "authorization_expiry_date",
          audioRemarkValue: record.authorizationExpiryDate,
          authorizationValue: authPage.expiryDate,
          audioRemarkSource: `audio_remark:${record.audioFileId}`,
          authorizationSource: `authorization_pages:${authPage.id}`,
        });
        conflicts.push(conflict);

        this.auditRepo.create({
          recordId,
          operator: "系统",
          operatorRole: "system",
          action: "冲突检测",
          fieldName: "authorization_expiry_date",
          oldValue: record.authorizationExpiryDate,
          newValue: authPage.expiryDate,
          reason: "音频备注与授权期限页不一致，待人工处理",
          affectedResultIds: [`result_${recordId}`],
        });

        this.recordRepo.updateStatus(recordId, "conflict");
      }
    }

    if (Math.abs(record.amount - authPage.authorizedAmount) > 0.01) {
      const existing = this.conflictRepo
        .findByRecordId(recordId)
        .find(
          (c) =>
            c.fieldName === "amount" &&
            Math.abs(parseFloat(c.audioRemarkValue) - record.amount) < 0.01 &&
            Math.abs(parseFloat(c.authorizationValue) - authPage.authorizedAmount) < 0.01 &&
            c.resolution === null
        );

      if (!existing) {
        const conflict = this.conflictRepo.create({
          id: `conf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          recordId,
          fieldName: "amount",
          audioRemarkValue: record.amount.toString(),
          authorizationValue: authPage.authorizedAmount.toString(),
          audioRemarkSource: `audio_remark:${record.audioFileId}`,
          authorizationSource: `authorization_pages:${authPage.id}`,
        });
        conflicts.push(conflict);

        this.auditRepo.create({
          recordId,
          operator: "系统",
          operatorRole: "system",
          action: "冲突检测",
          fieldName: "amount",
          oldValue: record.amount.toString(),
          newValue: authPage.authorizedAmount.toString(),
          reason: "音频备注金额与授权金额不一致，待人工处理",
          affectedResultIds: [`result_${recordId}`],
        });

        this.recordRepo.updateStatus(recordId, "conflict");
      }
    }

    return conflicts;
  }

  async detectAllConflicts(): Promise<ConflictRecord[]> {
    const records = this.recordRepo.findAll();
    const allConflicts: ConflictRecord[] = [];

    for (const record of records) {
      if (record.status === "normal" || record.status === "new") {
        const conflicts = this.detectConflicts(record.id);
        allConflicts.push(...conflicts);
      }
    }

    return allConflicts;
  }

  resolveConflict(conflictId: string, request: ResolveConflictRequest): ConflictRecord | null {
    const conflict = this.conflictRepo.findById(conflictId);
    if (!conflict || conflict.resolution !== null) return null;

    const resolved = this.conflictRepo.resolve(
      conflictId,
      request.resolution,
      request.reason,
      request.operator
    );

    if (!resolved) return null;

    if (request.resolution === "confirm") {
      const valueToUse =
        resolved.fieldName === "authorization_expiry_date"
          ? resolved.authorizationValue
          : resolved.authorizationValue;

      const updateData: any = {};
      if (resolved.fieldName === "authorization_expiry_date") {
        updateData.authorizationExpiryDate = valueToUse;
      } else if (resolved.fieldName === "amount") {
        updateData.amount = parseFloat(valueToUse);
      }

      this.recordRepo.update(conflict.recordId, updateData);
      this.recordRepo.updateStatus(conflict.recordId, "normal");
    } else {
      const unresolvedCount = this.conflictRepo
        .findByRecordId(conflict.recordId)
        .filter((c) => c.resolution === null).length;
      if (unresolvedCount === 0) {
        const record = this.recordRepo.findById(conflict.recordId);
        if (record && record.isTemporarySubstitute && record.substituteSource === "group_message") {
          this.recordRepo.updateStatus(conflict.recordId, "pending_review");
        } else {
          this.recordRepo.updateStatus(conflict.recordId, "normal");
        }
      }
    }

    this.auditRepo.create({
      recordId: conflict.recordId,
      operator: request.operator,
      operatorRole: request.operatorRole,
      action: request.resolution === "confirm" ? "确认冲突" : "驳回冲突",
      fieldName: conflict.fieldName,
      oldValue: conflict.audioRemarkValue,
      newValue: conflict.authorizationValue,
      reason: request.reason,
      affectedResultIds: [`result_${conflict.recordId}`],
    });

    return resolved;
  }

  getUnresolvedConflicts(): ConflictRecord[] {
    return this.conflictRepo.findAll(false);
  }
}
