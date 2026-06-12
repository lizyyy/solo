import Papa from "papaparse";
import type { AudioRecord, ImportPreviewResult, SubstituteSource } from "@shared/types";
import { RecordRepository } from "../repositories/RecordRepository";
import { AuditRepository } from "../repositories/AuditRepository";
import { DuplicateService } from "./DuplicateService";
import { ConflictService } from "./ConflictService";

export class ImportService {
  constructor(
    private recordRepo: RecordRepository,
    private auditRepo: AuditRepository,
    private duplicateService: DuplicateService,
    private conflictService: ConflictService
  ) {}

  parseCSV(csvContent: string): Omit<AudioRecord, "id" | "createdAt" | "updatedAt" | "importBatchId">[] {
    const result = Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
    });

    return result.data.map((row: any, index: number) => {
      const remark = row.remark || row.备注 || "";
      const therapistName = row.therapistName || row.治疗师 || "";
      const isTempSub =
        remark.includes("只在群里说了一句") ||
        remark.includes("临时替补") ||
        therapistName.includes("替补") ||
        therapistName.includes("临时");

      const substituteSource: SubstituteSource = isTempSub
        ? remark.includes("只在群里说了一句")
          ? "group_message"
          : "audio_remark"
        : "audio_remark";

      return {
        audioFileId: row.audioFileId || row.音频文件ID || `AUD${Date.now()}_${index}`,
        audioFileName: row.audioFileName || row.音频文件名 || "",
        remark,
        courseName: row.courseName || row.课程名称 || "",
        therapistName,
        sessionDate: row.sessionDate || row.治疗日期 || new Date().toISOString().split("T")[0],
        duration: parseInt(row.duration || row.时长 || "60", 10),
        amount: parseFloat(row.amount || row.金额 || "0"),
        isTemporarySubstitute: isTempSub,
        substituteSource,
        authorizationExpiryDate: row.authorizationExpiryDate || row.授权到期日 || "",
        status: "new",
      };
    });
  }

  previewImport(records: Omit<AudioRecord, "id" | "createdAt" | "updatedAt" | "importBatchId">[]): ImportPreviewResult {
    const { newRecords, duplicateCurrent, duplicateHistory } = this.duplicateService.identifyDuplicates(records);

    const temporarySubstituteCount = [
      ...newRecords,
      ...duplicateCurrent,
      ...duplicateHistory,
    ].filter((r) => r.isTemporarySubstitute).length;

    let potentialConflicts = 0;
    for (const record of [...newRecords, ...duplicateCurrent, ...duplicateHistory]) {
      if (record.authorizationExpiryDate && record.authorizationExpiryDate < "2026-12-01") {
        potentialConflicts++;
      }
      if (Math.abs(record.amount - 300) > 100) {
        potentialConflicts++;
      }
    }

    const importBatchId = `batch_${Date.now().toString().slice(-6)}`;

    return {
      newRecords,
      duplicateCurrent,
      duplicateHistory,
      temporarySubstituteCount,
      potentialConflicts,
      importBatchId,
    };
  }

  confirmImport(preview: ImportPreviewResult, importedBy: string = "阿梅"): AudioRecord[] {
    const allRecords = [
      ...preview.newRecords,
      ...preview.duplicateCurrent,
      ...preview.duplicateHistory,
    ];

    const createdRecords: AudioRecord[] = [];

    for (const record of allRecords) {
      const created = this.recordRepo.create({
        ...record,
        importBatchId: preview.importBatchId,
      });
      createdRecords.push(created);

      this.auditRepo.create({
        recordId: created.id,
        operator: importedBy,
        operatorRole: "coordinator",
        action: "导入",
        fieldName: null,
        oldValue: null,
        newValue: JSON.stringify(record),
        reason: `导入批次 ${preview.importBatchId}`,
        affectedResultIds: [`result_${created.id}`],
      });
    }

    for (const record of createdRecords) {
      if (record.status === "normal" || record.status === "new") {
        this.conflictService.detectConflicts(record.id);
      }
    }

    return createdRecords;
  }

  generateSampleCSV(): string {
    const headers = [
      "audioFileId",
      "audioFileName",
      "remark",
      "courseName",
      "therapistName",
      "sessionDate",
      "duration",
      "amount",
      "authorizationExpiryDate",
    ];

    const sampleData = [
      {
        audioFileId: "AUD009",
        audioFileName: "20260604_上午场_放松训练.wav",
        remark: "患者呼吸节奏明显改善",
        courseName: "放松训练治疗",
        therapistName: "周医生",
        sessionDate: "2026-06-04",
        duration: "60",
        amount: "300.00",
        authorizationExpiryDate: "2026-12-31",
      },
      {
        audioFileId: "AUD010",
        audioFileName: "20260604_下午场_情绪释放.wav",
        remark: "临时替补吴医生，只在群里说了一句",
        courseName: "情绪释放治疗",
        therapistName: "吴医生(替补)",
        sessionDate: "2026-06-04",
        duration: "60",
        amount: "300.00",
        authorizationExpiryDate: "2026-12-31",
      },
      {
        audioFileId: "AUD001",
        audioFileName: "20260601_上午场_音乐放松.wav",
        remark: "历史重复导入测试",
        courseName: "音乐放松治疗",
        therapistName: "李医生",
        sessionDate: "2026-06-01",
        duration: "60",
        amount: "300.00",
        authorizationExpiryDate: "2026-12-31",
      },
      {
        audioFileId: "AUD011",
        audioFileName: "20260605_上午场_认知训练.wav",
        remark: "授权到2026-06-15，与授权页冲突",
        courseName: "认知训练治疗",
        therapistName: "郑医生",
        sessionDate: "2026-06-05",
        duration: "45",
        amount: "225.00",
        authorizationExpiryDate: "2026-06-15",
      },
    ];

    const rows = sampleData.map((row) =>
      headers.map((h) => {
        const val = (row as any)[h];
        return String(val).includes(",") ? `"${val}"` : val;
      }).join(",")
    );

    return [headers.join(","), ...rows].join("\n");
  }
}
