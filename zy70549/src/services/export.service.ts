import { v4 as uuidv4 } from "uuid";
import { getDb, runQuery, getOne, getAll } from "../database";
import { HashService } from "./hash.service";
import { ExportRequestStatus, VerificationStatus } from "../models/types";

export class ExportService {
  static async createExportRequest(
    topicId: string,
    startTime: string,
    endTime: string,
    requester: string,
    reason: string,
    idempotencyKey?: string
  ) {
    // 前置校验：topicId必须存在
    const topic = await getOne("SELECT * FROM log_topics WHERE id = ?", [topicId]);
    if (!topic) {
      throw new Error(`Topic not found: ${topicId}`);
    }

    const rangeIdentifier = `${startTime}-${endTime}`;
    const finalIdempotencyKey = idempotencyKey || HashService.generateIdempotencyKey(requester, topicId, rangeIdentifier);

    const existingRequest = await getOne(
      "SELECT * FROM export_requests WHERE idempotency_key = ?",
      [finalIdempotencyKey]
    );

    if (existingRequest) {
      return { isNew: false, request: existingRequest };
    }

    const rangeId = uuidv4();
    const requestId = uuidv4();
    const now = new Date().toISOString();

    const events = await getAll(
      "SELECT id FROM audit_log_events WHERE topic_id = ? AND timestamp >= ? AND timestamp <= ? ORDER BY timestamp",
      [topicId, startTime, endTime]
    );

    const originalInput = {
      topicId,
      startTime,
      endTime,
      requester,
      reason,
      idempotencyKey: finalIdempotencyKey,
      timestamp: now
    };

    await runQuery(
      `INSERT INTO event_ranges (id, topic_id, start_time, end_time, event_count, created_at)` 
+
      `VALUES (?, ?, ?, ?, ?, ?)`,
      [rangeId, topicId, startTime, endTime, events.length, now]
    );

    await runQuery(
      `INSERT INTO export_requests ` 
+
      `(id, topic_id, range_id, requester, reason, status, idempotency_key, original_input, created_at, updated_at)` 
+
      `VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        requestId,
        topicId,
        rangeId,
        requester,
        reason,
        ExportRequestStatus.PENDING,
        finalIdempotencyKey,
        JSON.stringify(originalInput),
        now,
        now
      ]
    );

    await this.addProcessingHistory(requestId, "create", requester, {
      rangeCreated: true,
      eventCount: events.length
    });

    const request = await getOne("SELECT * FROM export_requests WHERE id = ?", [requestId]);
    return { isNew: true, request };
  }

  static async approveRequest(requestId: string, approver: string, comment?: string) {
    const now = new Date().toISOString();
    
    await runQuery(
      `UPDATE export_requests ` 
+
      `SET status = ?, approver = ?, approval_comment = ?, approved_at = ?, updated_at = ?` 
+
      `WHERE id = ?`,
      [ExportRequestStatus.APPROVED, approver, comment || null, now, now, requestId]
    );

    await this.addProcessingHistory(requestId, "approve", approver, { comment });
    return this.getRequestById(requestId);
  }

  static async rejectRequest(requestId: string, approver: string, reason: string) {
    const now = new Date().toISOString();
    
    await runQuery(
      `UPDATE export_requests ` 
+
      `SET status = ?, approver = ?, approval_comment = ?, updated_at = ?, final_conclusion = ?` 
+
      `WHERE id = ?`,
      [ExportRequestStatus.REJECTED, approver, reason, now, `请求被拒绝: ${reason}`, requestId]
    );

    await this.addProcessingHistory(requestId, "reject", approver, { reason });
    return this.getRequestById(requestId);
  }

  static async verifyHashChain(requestId: string, verifier: string) {
    const request = await this.getRequestById(requestId);
    if (!request) {
      throw new Error("Export request not found");
    }

    // 前置校验：申请必须已审批
    if (request.status !== ExportRequestStatus.APPROVED) {
      throw new Error(`Request must be approved before verification. Current status: ${request.status}`);
    }

    const range = await getOne("SELECT * FROM event_ranges WHERE id = ?", [request.range_id]);
    if (!range) {
      throw new Error("Event range not found");
    }

    await runQuery(
      `UPDATE export_requests SET status = ?, updated_at = ? WHERE id = ?`,
      [ExportRequestStatus.PROCESSING, new Date().toISOString(), requestId]
    );

    const hashChains = await getAll(
      `SELECT * FROM hash_chains 
       WHERE topic_id = ? AND event_timestamp >= ? AND event_timestamp <= ?
       ORDER BY chain_sequence`,
      [range.topic_id, range.start_time, range.end_time]
    );

    // 没有哈希链数据时直接标记为失败
    let isValid = hashChains.length > 0;
    const mismatches: any[] = [];

    if (hashChains.length === 0) {
      mismatches.push({
        event_id: "N/A",
        expected_hash: "N/A",
        actual_hash: "N/A",
        sequence: 0,
        issue: "no_hash_chain_data_found"
      });
    }

    for (let i = 1; i < hashChains.length; i++) {
      if (hashChains[i].previous_hash !== hashChains[i - 1].current_hash) {
        isValid = false;
        mismatches.push({
          event_id: hashChains[i].event_id,
          expected_hash: hashChains[i - 1].current_hash,
          actual_hash: hashChains[i].previous_hash,
          sequence: hashChains[i].chain_sequence,
          issue: "previous_hash_mismatch"
        });
      }
    }

    const verificationId = uuidv4();
    const now = new Date().toISOString();

    await runQuery(
      `INSERT INTO verification_results ` 
+
      `(id, request_id, range_id, status, hash_chain_valid, first_hash, last_hash, ` 
+
      `verified_count, total_count, mismatch_details, verified_at, verified_by)` 
+
      `VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        verificationId,
        requestId,
        range.id,
        isValid ? VerificationStatus.VERIFIED : VerificationStatus.FAILED,
        isValid ? 1 : 0,
        hashChains[0]?.current_hash || "",
        hashChains[hashChains.length - 1]?.current_hash || "",
        hashChains.length,
        range.event_count,
        JSON.stringify(mismatches),
        now,
        verifier
      ]
    );

    const newStatus = isValid ? ExportRequestStatus.PROCESSING : ExportRequestStatus.FAILED;
    const failureReason = isValid ? null : `哈希链校验失败: ${mismatches.length}处不匹配`;
    
    await runQuery(
      `UPDATE export_requests ` 
+
      `SET status = ?, failure_reason = ?, updated_at = ?` 
+
      `WHERE id = ?`,
      [newStatus, failureReason, now, requestId]
    );

    await this.addProcessingHistory(requestId, "verify_hash_chain", verifier, {
      isValid,
      verifiedCount: hashChains.length,
      mismatches: mismatches.length
    });

    return { verificationId, isValid, mismatches, hashChains };
  }

  static async getRequestById(requestId: string) {
    const request = await getOne("SELECT * FROM export_requests WHERE id = ?", [requestId]);
    if (!request) return null;
    return {
      ...request,
      original_input: typeof request.original_input === "string" ? JSON.parse(request.original_input) : request.original_input,
      processing_evidence: request.processing_evidence ? JSON.parse(request.processing_evidence) : null
    };
  }

  static async getRequests(filters?: { status?: string; topicId?: string; requester?: string }) {
    let sql = "SELECT * FROM export_requests WHERE 1=1";
    const params: any[] = [];
    if (filters?.status) { sql += " AND status = ?"; params.push(filters.status); }
    if (filters?.topicId) { sql += " AND topic_id = ?"; params.push(filters.topicId); }
    if (filters?.requester) { sql += " AND requester = ?"; params.push(filters.requester); }
    sql += " ORDER BY created_at DESC";
    const requests = await getAll(sql, params);
    return requests.map(r => ({
      ...r,
      original_input: typeof r.original_input === "string" ? JSON.parse(r.original_input) : r.original_input
    }));
  }

  static async addProcessingHistory(requestId: string, action: string, actor: string, details: Record<string, any>) {
    const historyId = uuidv4();
    await runQuery(
      `INSERT INTO processing_history (id, request_id, action, actor, details, timestamp)` 
+
      `VALUES (?, ?, ?, ?, ?, ?)`,
      [historyId, requestId, action, actor, JSON.stringify(details), new Date().toISOString()]
    );
    return historyId;
  }

  static async getProcessingHistory(requestId: string) {
    const history = await getAll(
      "SELECT * FROM processing_history WHERE request_id = ? ORDER BY timestamp",
      [requestId]
    );
    return history.map(h => ({
      ...h,
      details: typeof h.details === "string" ? JSON.parse(h.details) : h.details
    }));
  }

  static async generateProofReport(requestId: string, generator: string, format: "json" | "csv" = "json") {
    const verification = await getOne(
      "SELECT * FROM verification_results WHERE request_id = ? ORDER BY verified_at DESC LIMIT 1",
      [requestId]
    );
    if (!verification) {
      throw new Error("Verification result not found");
    }

    const request = await this.getRequestById(requestId);
    const range = await getOne("SELECT * FROM event_ranges WHERE id = ?", [request!.range_id]);

    const reportId = uuidv4();
    const now = new Date().toISOString();

    const hasValidData = verification.hash_chain_valid === 1 && verification.verified_count > 0;
    
    let conclusion = "该审计日志范围哈希链存在不匹配，数据可能被篡改，导出被阻止。";
    if (verification.verified_count === 0) {
      conclusion = "该审计日志范围未找到任何哈希链数据，无法证明数据完整性，导出被阻止。";
    } else if (hasValidData) {
      conclusion = "该审计日志范围哈希链完整，数据未被篡改，可以安全导出。";
    }

    const reportContent = {
      summary: `审计日志导出证明报告 - 主题: ${range!.topic_id}`,
      verification_details: {
        hash_chain_integrity: hasValidData,
        event_count_match: verification.verified_count === verification.total_count,
        has_hash_data: verification.verified_count > 0,
        time_range_match: true
      },
      hash_chain_summary: {
        start_hash: verification.first_hash,
        end_hash: verification.last_hash,
        total_links: verification.verified_count
      },
      export_metadata: {
        exported_at: now,
        exported_by: generator,
        record_count: verification.verified_count
      },
      conclusion
    };

    await runQuery(
      `INSERT INTO proof_reports (id, request_id, verification_id, report_content, file_format, generated_at)` 
+
      `VALUES (?, ?, ?, ?, ?, ?)`,
      [reportId, requestId, verification.id, JSON.stringify(reportContent), format, now]
    );

    const finalStatus = hasValidData
      ? ExportRequestStatus.COMPLETED
      : ExportRequestStatus.FAILED;

    await runQuery(
      `UPDATE export_requests ` 
+
      `SET status = ?, final_conclusion = ?, updated_at = ?` 
+
      `WHERE id = ?`,
      [finalStatus, reportContent.conclusion, now, requestId]
    );

    await this.addProcessingHistory(requestId, "generate_report", generator, {
      reportId,
      format,
      status: finalStatus
    });

    return { reportId, reportContent, format };
  }

  static async exportEvents(requestId: string) {
    const request = await this.getRequestById(requestId);
    if (!request) {
      throw new Error("Export request not found");
    }
    const allowedStatuses = [
      ExportRequestStatus.APPROVED, 
      ExportRequestStatus.PROCESSING, 
      ExportRequestStatus.COMPLETED
    ];
    if (!allowedStatuses.includes(request.status as ExportRequestStatus)) {
      throw new Error("Request not approved or already processed");
    }
    const range = await getOne("SELECT * FROM event_ranges WHERE id = ?", [request.range_id]);
    const events = await getAll(
      `SELECT e.*, hc.current_hash, hc.chain_sequence
       FROM audit_log_events e
       LEFT JOIN hash_chains hc ON e.id = hc.event_id
       WHERE e.topic_id = ? AND e.timestamp >= ? AND e.timestamp <= ?
       ORDER BY e.timestamp`,
      [range!.topic_id, range!.start_time, range!.end_time]
    );
    return events.map(e => ({
      ...e,
      details: typeof e.details === "string" ? JSON.parse(e.details) : e.details
    }));
  }

  static async addManualCorrection(
    requestId: string,
    corrector: string,
    correctionType: string,
    originalValue: Record<string, any>,
    correctedValue: Record<string, any>,
    reason: string
  ) {
    const request = await this.getRequestById(requestId);
    if (!request) {
      throw new Error("Export request not found");
    }

    const correctionId = uuidv4();
    const now = new Date().toISOString();

    await runQuery(
      `INSERT INTO manual_corrections 
       (id, request_id, corrector, correction_type, original_value, corrected_value, reason, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        correctionId,
        requestId,
        corrector,
        correctionType,
        JSON.stringify(originalValue),
        JSON.stringify(correctedValue),
        reason,
        now
      ]
    );

    await this.addProcessingHistory(requestId, "manual_correction", corrector, {
      correctionId,
      correctionType,
      reason
    });

    return { correctionId, requestId, corrector, correctionType, reason, createdAt: now };
  }

  static async handleFailure(
    requestId: string,
    handler: string,
    error: Error,
    processingEvidence: Record<string, any>
  ) {
    const now = new Date().toISOString();
    const finalConclusion = `处理失败: ${error.message} - 请联系管理员进行人工核查`;

    await runQuery(
      `UPDATE export_requests 
       SET status = ?, processing_evidence = ?, failure_reason = ?, final_conclusion = ?, updated_at = ?
       WHERE id = ?`,
      [
        ExportRequestStatus.FAILED,
        JSON.stringify(processingEvidence),
        error.message,
        finalConclusion,
        now,
        requestId
      ]
    );

    await this.addProcessingHistory(requestId, "handle_failure", handler, {
      error: error.message,
      processingEvidence
    });

    return this.getRequestById(requestId);
  }
}
