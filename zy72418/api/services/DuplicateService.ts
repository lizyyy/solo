import type { AudioRecord, RecordStatus } from "@shared/types";
import { RecordRepository } from "../repositories/RecordRepository";

export class DuplicateService {
  constructor(private recordRepo: RecordRepository) {}

  identifyDuplicates(records: Omit<AudioRecord, "id" | "createdAt" | "updatedAt" | "importBatchId">[]): {
    newRecords: AudioRecord[];
    duplicateCurrent: AudioRecord[];
    duplicateHistory: AudioRecord[];
  } {
    const newRecords: AudioRecord[] = [];
    const duplicateCurrent: AudioRecord[] = [];
    const duplicateHistory: AudioRecord[] = [];

    const seenInCurrentBatch = new Set<string>();

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const recordWithStatus = {
        ...record,
        id: `rec_${Date.now()}_${i.toString().padStart(3, "0")}`,
        status: "new" as RecordStatus,
        importBatchId: "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as AudioRecord;

      if (seenInCurrentBatch.has(record.audioFileId)) {
        recordWithStatus.status = "duplicate_current";
        duplicateCurrent.push(recordWithStatus);
      } else {
        const existingRecords = this.recordRepo.findByAudioFileId(record.audioFileId);
        if (existingRecords.length > 0) {
          recordWithStatus.status = "duplicate_history";
          duplicateHistory.push(recordWithStatus);
        } else {
          if (this.isTemporarySubstitute(record)) {
            recordWithStatus.status = "pending_review";
            recordWithStatus.isTemporarySubstitute = true;
            recordWithStatus.substituteSource = "group_message";
          }
          newRecords.push(recordWithStatus);
        }
      }

      seenInCurrentBatch.add(record.audioFileId);
    }

    return { newRecords, duplicateCurrent, duplicateHistory };
  }

  private isTemporarySubstitute(record: { remark?: string; therapistName?: string }): boolean {
    const remark = record.remark || "";
    const therapist = record.therapistName || "";
    return (
      remark.includes("只在群里说了一句") ||
      remark.includes("临时替补") ||
      therapist.includes("替补") ||
      therapist.includes("临时")
    );
  }

  classifyRecords(records: AudioRecord[]): {
    newRecords: AudioRecord[];
    duplicateCurrent: AudioRecord[];
    duplicateHistory: AudioRecord[];
    pendingReview: AudioRecord[];
  } {
    return {
      newRecords: records.filter((r) => r.status === "new"),
      duplicateCurrent: records.filter((r) => r.status === "duplicate_current"),
      duplicateHistory: records.filter((r) => r.status === "duplicate_history"),
      pendingReview: records.filter((r) => r.status === "pending_review"),
    };
  }
}
