import type { SelfCheckReport } from "@shared/types";
import { RecordRepository } from "../repositories/RecordRepository";
import { ConflictRepository } from "../repositories/ConflictRepository";
import { AuditRepository } from "../repositories/AuditRepository";
import { RecordService } from "./RecordService";

export class SelfCheckService {
  constructor(
    private recordRepo: RecordRepository,
    private conflictRepo: ConflictRepository,
    private auditRepo: AuditRepository,
    private recordService: RecordService
  ) {}

  runSelfCheck(): SelfCheckReport {
    const checkDuplicateImport = this.checkDuplicateImport();
    const checkTemporarySubstitute = this.checkTemporarySubstitute();
    const checkRecalculationAfterSupplement = this.checkRecalculationAfterSupplement();
    const checkExportConsistency = this.checkExportConsistency();

    const overallPassed =
      checkDuplicateImport.passed &&
      checkTemporarySubstitute.passed &&
      checkRecalculationAfterSupplement.passed &&
      checkExportConsistency.passed;

    return {
      checkDuplicateImport,
      checkTemporarySubstitute,
      checkRecalculationAfterSupplement,
      checkExportConsistency,
      overallPassed,
      checkedAt: new Date().toISOString(),
    };
  }

  private checkDuplicateImport(): SelfCheckReport["checkDuplicateImport"] {
    const details: SelfCheckReport["checkDuplicateImport"]["details"] = [];

    const allRecords = this.recordRepo.findAll();
    const fileIdMap = new Map<string, string[]>();

    for (const record of allRecords) {
      const existing = fileIdMap.get(record.audioFileId) || [];
      existing.push(record.id);
      fileIdMap.set(record.audioFileId, existing);
    }

    let passed = true;
    for (const [fileId, recordIds] of fileIdMap) {
      if (recordIds.length > 1) {
        const dupeRecords = allRecords.filter((r) => r.audioFileId === fileId);
        const extraDupes = dupeRecords.slice(1);
        const hasProperStatus = extraDupes.every(
          (r) => r.status === "duplicate_current" || r.status === "duplicate_history"
        );

        if (!hasProperStatus) {
          passed = false;
        }

        details.push({
          batchId: dupeRecords[0].importBatchId,
          duplicateCount: recordIds.length - 1,
          message: hasProperStatus
            ? `音频文件 ${fileId} 有 ${recordIds.length - 1} 条重复，已正确标记`
            : `音频文件 ${fileId} 有 ${recordIds.length - 1} 条重复，但状态标记不正确`,
        });
      }
    }

    if (details.length === 0) {
      details.push({
        batchId: "all",
        duplicateCount: 0,
        message: "未检测到重复导入记录",
      });
    }

    return { passed, details };
  }

  private checkTemporarySubstitute(): SelfCheckReport["checkTemporarySubstitute"] {
    const details: SelfCheckReport["checkTemporarySubstitute"]["details"] = [];

    const tempSubs = this.recordRepo.findTemporarySubstitutes();
    let passed = true;

    for (const record of tempSubs) {
      const hasGroupMessageSource = record.substituteSource === "group_message";
      const hasProperStatus =
        record.status === "pending_review" || record.status === "normal";

      const containsKeyPhrase =
        record.remark.includes("只在群里说了一句") || record.remark.includes("临时替补");

      const isCorrect =
        hasGroupMessageSource && hasProperStatus && containsKeyPhrase;

      if (!isCorrect) {
        passed = false;
      }

      details.push({
        recordId: record.id,
        status: record.status,
        message: isCorrect
          ? `临时替补记录 ${record.id} 处理正确，状态：${record.status}`
          : `临时替补记录 ${record.id} 处理异常：来源=${record.substituteSource}，状态=${record.status}，包含关键短语=${containsKeyPhrase}`,
      });
    }

    if (details.length === 0) {
      details.push({
        recordId: "none",
        status: "n/a",
        message: "未检测到临时替补记录",
      });
    }

    return { passed, details };
  }

  private checkRecalculationAfterSupplement(): SelfCheckReport["checkRecalculationAfterSupplement"] {
    const details: SelfCheckReport["checkRecalculationAfterSupplement"]["details"] = [];

    const auditLogs = this.auditRepo.findAll();
    const supplementLogs = auditLogs.filter((log) => log.action === "补录更新");

    let passed = true;

    for (const log of supplementLogs) {
      const recalcLogs = auditLogs.filter(
        (l) =>
          l.recordId === log.recordId &&
          l.action === "分账重算" &&
          new Date(l.createdAt).getTime() >= new Date(log.createdAt).getTime()
      );

      const recalculated = recalcLogs.length > 0;

      if (!recalculated) {
        passed = false;
      }

      details.push({
        recordId: log.recordId,
        recalculated,
        message: recalculated
          ? `记录 ${log.recordId} 补录后已正确重算分账`
          : `记录 ${log.recordId} 补录后未触发分账重算`,
      });
    }

    if (details.length === 0) {
      details.push({
        recordId: "none",
        recalculated: true,
        message: "未检测到补录记录，无需重算",
      });
    }

    return { passed, details };
  }

  private checkExportConsistency(): SelfCheckReport["checkExportConsistency"] {
    const details: SelfCheckReport["checkExportConsistency"]["details"] = [];

    const exportRecords = this.recordService.getRecordsForExport();
    const pageRecords = this.recordService.getRecordsForPage();
    const apiRecords = this.recordService.getRecordsForApi();

    const exportHash = this.recordService.getDataHash(exportRecords);
    const pageHash = this.recordService.getDataHash(pageRecords);
    const apiHash = this.recordService.getDataHash(apiRecords);

    const consistent = exportHash === pageHash && pageHash === apiHash;

    details.push({
      exportHash,
      pageHash,
      apiHash,
      consistent,
    });

    return {
      passed: consistent,
      details,
    };
  }
}
