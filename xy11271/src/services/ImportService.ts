import * as fs from "fs";
import * as path from "path";
import * as csv from "csv-parser";
import { ImportBatchRepository } from "../repositories/ImportBatchRepository";
import { TranscriptRepository } from "../repositories/TranscriptRepository";
import { CallRecordRepository } from "../repositories/CallRecordRepository";
import { SensitiveWordRepository } from "../repositories/SensitiveWordRepository";
import { TranscriptSegment, SpeakerRole } from "../models/Transcript";
import { BatchStatus } from "../models/ImportBatch";
import { QualityCheckService } from "./QualityCheckService";

export interface ImportResult {
  batchId: string;
  batchNumber: string;
  total: number;
  success: number;
  failed: number;
  errors: Array<{
    lineNumber: number;
    message: string;
    originalContent?: string;
    suggestion?: string;
  }>;
}

export class ImportService {
  private batchRepo = new ImportBatchRepository();
  private transcriptRepo = new TranscriptRepository();
  private callRecordRepo = new CallRecordRepository();
  private sensitiveWordRepo = new SensitiveWordRepository();
  private qualityCheckService = new QualityCheckService();

  async importTranscripts(filePath: string): Promise<ImportResult> {
    const fileName = path.basename(filePath);
    const batch = await this.batchRepo.createBatch("transcript", fileName);
    await this.batchRepo.setBatchStatus(batch.id, "processing");

    let success = 0;
    let failed = 0;
    const errors: ImportResult["errors"] = [];
    const transcriptsToImport: Array<{
      callId: string;
      rawContent: string;
      segments?: TranscriptSegment[];
      fullText?: string;
    }> = [];

    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split(/\r?\n/);

    let currentCallId: string | null = null;
    let currentSegments: TranscriptSegment[] = [];
    let currentFullText = "";

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lineNumber = i + 1;

      if (!line) continue;

      try {
        const callIdMatch = line.match(/^\[CALL_ID\]\s*:\s*(.+)$/i);
        if (callIdMatch) {
          if (currentCallId && currentSegments.length > 0) {
            transcriptsToImport.push({
              callId: currentCallId,
              rawContent: currentSegments.map((s) => `${s.timestamp} ${s.speaker}: ${s.text}`).join("\n"),
              segments: currentSegments,
              fullText: currentFullText,
            });
          }
          currentCallId = callIdMatch[1].trim();
          currentSegments = [];
          currentFullText = "";
          continue;
        }

        if (!currentCallId) {
          failed++;
          errors.push({
            lineNumber,
            message: "缺少CALL_ID标识",
            originalContent: line,
            suggestion: '在该行之前添加: [CALL_ID]: YOUR_CALL_ID_HERE',
          });
          await this.batchRepo.addError(
            batch.id,
            lineNumber,
            "缺少CALL_ID标识",
            line,
            '在该行之前添加: [CALL_ID]: YOUR_CALL_ID_HERE'
          );
          continue;
        }

        const segmentMatch = line.match(/^\[(\d{2}:\d{2}:\d{2})\]\s*(.+?)\s*:\s*(.+)$/);
        if (segmentMatch) {
          const [, timestamp, speaker, text] = segmentMatch;
          const role = this.detectSpeakerRole(speaker);
          currentSegments.push({ timestamp, speaker, role, text });
          currentFullText += text + " ";
        } else {
          currentSegments.push({
            timestamp: new Date().toISOString().substr(11, 8),
            speaker: "Unknown",
            role: "unknown" as SpeakerRole,
            text: line,
          });
          currentFullText += line + " ";
        }
      } catch (error: any) {
        failed++;
        errors.push({
          lineNumber,
          message: error.message,
          originalContent: line,
        });
        await this.batchRepo.addError(batch.id, lineNumber, error.message, line);
      }
    }

    if (currentCallId && currentSegments.length > 0) {
      transcriptsToImport.push({
        callId: currentCallId,
        rawContent: currentSegments.map((s) => `${s.timestamp} ${s.speaker}: ${s.text}`).join("\n"),
        segments: currentSegments,
        fullText: currentFullText,
      });
    }

    await this.batchRepo.executeInTransaction(async (manager) => {
      for (const transcript of transcriptsToImport) {
        try {
          const exists = await this.transcriptRepo.exists(transcript.callId);
          if (exists) {
            await this.transcriptRepo.updateByCallId(
              transcript.callId,
              {
                rawContent: transcript.rawContent,
                segments: transcript.segments,
                fullText: transcript.fullText,
                batchId: batch.id,
              },
              manager
            );
          } else {
            await this.transcriptRepo.create(
              {
                ...transcript,
                batchId: batch.id,
                status: "pending",
                hasApology: false,
                hasRefundPromise: false,
                hasSensitiveWords: false,
                issueCount: 0,
              },
              manager
            );
          }
          success++;
        } catch (error: any) {
          failed++;
          errors.push({
            lineNumber: 0,
            message: `导入通话 ${transcript.callId} 失败: ${error.message}`,
          });
        }
      }
    });

    const total = success + failed;
    const status: BatchStatus = failed === 0 ? "completed" : success > 0 ? "partial_failed" : "failed";
    await this.batchRepo.updateBatchProgress(batch.id, total, success, failed, status);

    if (success > 0) {
      const batchErrors = await this.batchRepo.getErrors(batch.id);
      for (const error of batchErrors) {
        if (!error.resolved) {
          await this.qualityCheckService.processBatch(batch.id);
          break;
        }
      }
      if (batchErrors.length === 0) {
        await this.qualityCheckService.processBatch(batch.id);
      }
    }

    return {
      batchId: batch.id,
      batchNumber: batch.batchNumber,
      total,
      success,
      failed,
      errors,
    };
  }

  async importMetadata(filePath: string): Promise<ImportResult> {
    const fileName = path.basename(filePath);
    const batch = await this.batchRepo.createBatch("metadata", fileName);
    await this.batchRepo.setBatchStatus(batch.id, "processing");

    let success = 0;
    let failed = 0;
    const errors: ImportResult["errors"] = [];
    const recordsToImport: any[] = [];

    return new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on("data", async (row) => {
          try {
            const callId = row.callId || row.call_id || row["通话ID"];
            if (!callId) {
              failed++;
              errors.push({
                lineNumber: success + failed,
                message: "缺少callId字段",
                originalContent: JSON.stringify(row),
                suggestion: "确保CSV包含callId列",
              });
              await this.batchRepo.addError(
                batch.id,
                success + failed,
                "缺少callId字段",
                JSON.stringify(row),
                "确保CSV包含callId列"
              );
              return;
            }

            recordsToImport.push({
              callId: callId.trim(),
              agentId: row.agentId || row.agent_id,
              agentName: row.agentName || row.agent_name || row.坐席姓名,
              customerPhone: row.customerPhone || row.customer_phone || row.客户电话,
              startTime: row.startTime || row.start_time ? new Date(row.startTime || row.start_time) : null,
              duration: row.duration ? parseInt(row.duration) : null,
              direction: row.direction || row.通话方向,
              status: row.status || row.通话状态,
              queueName: row.queueName || row.queue_name || row.队列名称,
              tags: row.tags || row.标签,
              batchId: batch.id,
            });
            success++;
          } catch (error: any) {
            failed++;
            errors.push({
              lineNumber: success + failed,
              message: error.message,
              originalContent: JSON.stringify(row),
            });
            await this.batchRepo.addError(batch.id, success + failed, error.message, JSON.stringify(row));
          }
        })
        .on("end", async () => {
          try {
            await this.batchRepo.executeInTransaction(async (manager) => {
              for (const record of recordsToImport) {
                const exists = await this.callRecordRepo.exists(record.callId);
                if (exists) {
                  await this.callRecordRepo.update(record.callId, record, manager);
                } else {
                  await this.callRecordRepo.create(record, manager);
                }
              }
            });

            const total = success + failed;
            const status: BatchStatus = failed === 0 ? "completed" : success > 0 ? "partial_failed" : "failed";
            await this.batchRepo.updateBatchProgress(batch.id, total, success, failed, status);

            resolve({
              batchId: batch.id,
              batchNumber: batch.batchNumber,
              total,
              success,
              failed,
              errors,
            });
          } catch (error) {
            reject(error);
          }
        })
        .on("error", reject);
    });
  }

  async importSensitiveWords(filePath: string): Promise<ImportResult> {
    const fileName = path.basename(filePath);
    const batch = await this.batchRepo.createBatch("sensitive_words", fileName);
    await this.batchRepo.setBatchStatus(batch.id, "processing");

    let success = 0;
    let failed = 0;
    const errors: ImportResult["errors"] = [];
    const wordsToImport: any[] = [];

    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lineNumber = i + 1;

      if (!line || line.startsWith("#")) continue;

      try {
        const parts = line.split(",").map((p) => p.trim());
        const word = parts[0];
        if (!word) {
          failed++;
          errors.push({
            lineNumber,
            message: "敏感词不能为空",
            originalContent: line,
          });
          await this.batchRepo.addError(batch.id, lineNumber, "敏感词不能为空", line);
          continue;
        }

        wordsToImport.push({
          word,
          category: parts[1] || "other",
          severity: parts[2] ? parseInt(parts[2]) : 1,
          description: parts[3] || "",
          suggestion: parts[4] || "",
          isActive: true,
          batchId: batch.id,
        });
        success++;
      } catch (error: any) {
        failed++;
        errors.push({
          lineNumber,
          message: error.message,
          originalContent: line,
        });
        await this.batchRepo.addError(batch.id, lineNumber, error.message, line);
      }
    }

    await this.batchRepo.executeInTransaction(async (manager) => {
      for (const word of wordsToImport) {
        const exists = await this.sensitiveWordRepo.exists(word.word);
        if (!exists) {
          await this.sensitiveWordRepo.create(word, manager);
        }
      }
    });

    const total = success + failed;
    const status: BatchStatus = failed === 0 ? "completed" : success > 0 ? "partial_failed" : "failed";
    await this.batchRepo.updateBatchProgress(batch.id, total, success, failed, status);

    return {
      batchId: batch.id,
      batchNumber: batch.batchNumber,
      total,
      success,
      failed,
      errors,
    };
  }

  private detectSpeakerRole(speaker: string): SpeakerRole {
    const lower = speaker.toLowerCase();
    if (lower.includes("客服") || lower.includes("坐席") || lower.includes("agent") || lower.includes("representative")) {
      return "agent";
    }
    if (lower.includes("客户") || lower.includes("customer") || lower.includes("user")) {
      return "customer";
    }
    return "unknown";
  }

  async getBatchInfo(batchId: string) {
    return this.batchRepo.getById(batchId);
  }

  async retryFailedBatch(batchId: string): Promise<ImportResult> {
    const batch = await this.batchRepo.getById(batchId);
    if (!batch) {
      throw new Error("批次不存在");
    }

    const errors = await this.batchRepo.getUnprocessedErrors(batchId);
    let success = 0;
    let failed = 0;

    for (const error of errors) {
      try {
        await this.batchRepo.markErrorResolved(error.id, true);
        success++;
      } catch {
        failed++;
      }
    }

    return {
      batchId: batch.id,
      batchNumber: batch.batchNumber,
      total: errors.length,
      success,
      failed,
      errors: [],
    };
  }
}
