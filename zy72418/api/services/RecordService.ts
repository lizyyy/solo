import type {
  AudioRecord,
  UpdateRecordRequest,
  ReviewSubstituteRequest,
  ImportBatch,
} from "@shared/types";
import { RecordRepository } from "../repositories/RecordRepository";
import { AuditRepository } from "../repositories/AuditRepository";
import { ConflictRepository } from "../repositories/ConflictRepository";
import crypto from "crypto";

export class RecordService {
  constructor(
    private recordRepo: RecordRepository,
    private auditRepo: AuditRepository,
    private conflictRepo: ConflictRepository
  ) {}

  getAllRecords(status?: string): AudioRecord[] {
    const records = this.recordRepo.findAll(status as any);
    return this.calculateSettlement(records);
  }

  getRecordById(id: string): AudioRecord | null {
    const record = this.recordRepo.findById(id);
    return record ? this.calculateSettlement([record])[0] : null;
  }

  getRecordsForExport(): AudioRecord[] {
    return this.getAllRecords();
  }

  getRecordsForApi(): AudioRecord[] {
    return this.getAllRecords();
  }

  getRecordsForPage(): AudioRecord[] {
    return this.getAllRecords();
  }

  getDataHash(records: AudioRecord[]): string {
    const data = JSON.stringify(
      records.map((r) => ({
        id: r.id,
        status: r.status,
        amount: r.amount,
        settlementAmount: r.settlementAmount,
        isTemporarySubstitute: r.isTemporarySubstitute,
      }))
    );
    return crypto.createHash("md5").update(data).digest("hex");
  }

  updateRecord(id: string, request: UpdateRecordRequest): AudioRecord | null {
    const existing = this.recordRepo.findById(id);
    if (!existing) return null;

    const updated = this.recordRepo.update(id, request);
    if (!updated) return null;

    const changes: { field: string; old: string; new: string }[] = [];
    const fieldLabels: Record<string, string> = {
      remark: "备注",
      courseName: "课程名称",
      therapistName: "治疗师",
      sessionDate: "治疗日期",
      duration: "时长(分钟)",
      amount: "金额",
      authorizationExpiryDate: "授权到期日",
      errorNote: "误差说明",
    };

    for (const [key, label] of Object.entries(fieldLabels)) {
      const typedKey = key as keyof UpdateRecordRequest;
      if (request[typedKey] !== undefined && request[typedKey] !== (existing as any)[key]) {
        changes.push({
          field: label,
          old: String((existing as any)[key] ?? ""),
          new: String(request[typedKey] ?? ""),
        });

        this.auditRepo.create({
          recordId: id,
          operator: request.operator,
          operatorRole: request.operatorRole,
          action: "补录更新",
          fieldName: key,
          oldValue: String((existing as any)[key] ?? ""),
          newValue: String(request[typedKey] ?? ""),
          reason: request.reason,
          affectedResultIds: [`result_${id}`],
        });
      }
    }

    const recalculated = updated;
    recalculated.settlementAmount = this.calculateSettlementAmount(recalculated);

    if (changes.length > 0) {
      this.auditRepo.create({
        recordId: id,
        operator: request.operator,
        operatorRole: request.operatorRole,
        action: "分账重算",
        fieldName: "settlementAmount",
        oldValue: existing.settlementAmount?.toFixed(2) || "0.00",
        newValue: recalculated.settlementAmount.toFixed(2),
        reason: `补录后自动重算，变更字段：${changes.map((c) => c.field).join("、")}`,
        affectedResultIds: [`result_${id}`],
      });
    }

    return this.calculateSettlement([recalculated])[0];
  }

  reviewTemporarySubstitute(request: ReviewSubstituteRequest): AudioRecord | null {
    const record = this.recordRepo.findById(request.recordId);
    if (!record || !record.isTemporarySubstitute) return null;

    const newStatus = request.approved ? "normal" : "pending_review";
    const updated = this.recordRepo.updateStatus(request.recordId, newStatus);

    this.auditRepo.create({
      recordId: request.recordId,
      operator: request.operator,
      operatorRole: request.operatorRole,
      action: request.approved ? "复核通过" : "复核驳回",
      fieldName: "status",
      oldValue: record.status,
      newValue: newStatus,
      reason: request.reason,
      affectedResultIds: [`result_${request.recordId}`],
    });

    return updated ? this.calculateSettlement([updated])[0] : null;
  }

  private calculateSettlement(records: AudioRecord[]): AudioRecord[] {
    return records.map((r) => ({
      ...r,
      settlementAmount: this.calculateSettlementAmount(r),
    }));
  }

  private calculateSettlementAmount(record: AudioRecord): number {
    const baseRate = 0.7;
    const tempSubAdjustment = record.isTemporarySubstitute ? 0.05 : 0;
    const finalRate = baseRate - tempSubAdjustment;
    return Math.round(record.amount * finalRate * 100) / 100;
  }

  getTemporarySubstitutes(): AudioRecord[] {
    const records = this.recordRepo.findTemporarySubstitutes();
    return this.calculateSettlement(records);
  }

  getUnreviewedSubstitutes(): AudioRecord[] {
    return this.getTemporarySubstitutes().filter((r) => r.status === "pending_review");
  }

  getImportBatch(batchId: string): ImportBatch | null {
    const records = this.recordRepo.findByBatchId(batchId);
    if (records.length === 0) return null;

    return {
      id: batchId,
      fileName: records[0].importBatchId,
      totalCount: records.length,
      newCount: records.filter((r) => r.status === "new" || r.status === "normal").length,
      duplicateCurrentCount: records.filter((r) => r.status === "duplicate_current").length,
      duplicateHistoryCount: records.filter((r) => r.status === "duplicate_history").length,
      importedBy: "阿梅",
      createdAt: records[0].createdAt,
    };
  }

  exportToCSV(): string {
    const records = this.getRecordsForExport();
    const headers = [
      "记录ID",
      "音频文件ID",
      "音频文件名",
      "课程名称",
      "治疗师",
      "治疗日期",
      "时长(分钟)",
      "原始金额",
      "分账金额",
      "是否临时替补",
      "替补来源",
      "授权到期日",
      "状态",
      "备注",
      "误差说明",
      "创建时间",
    ];

    const rows = records.map((r) => [
      r.id,
      r.audioFileId,
      r.audioFileName,
      r.courseName,
      r.therapistName,
      r.sessionDate,
      r.duration,
      r.amount.toFixed(2),
      (r.settlementAmount || 0).toFixed(2),
      r.isTemporarySubstitute ? "是" : "否",
      r.substituteSource === "group_message" ? "群消息" : "音频备注",
      r.authorizationExpiryDate,
      this.getStatusLabel(r.status),
      r.remark,
      r.errorNote || "",
      r.createdAt,
    ]);

    const escapeCSV = (val: string | number) => {
      const str = String(val);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    return [headers.join(","), ...rows.map((row) => row.map(escapeCSV).join(","))].join("\n");
  }

  private getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      new: "新记录",
      duplicate_current: "本次重复",
      duplicate_history: "历史重复",
      pending_review: "待票务复核",
      normal: "正常",
      conflict: "存在冲突",
    };
    return labels[status] || status;
  }
}
