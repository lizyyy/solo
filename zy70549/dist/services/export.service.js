"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExportService = void 0;
const uuid_1 = require("uuid");
const database_1 = require("../database");
const hash_service_1 = require("./hash.service");
const types_1 = require("../models/types");
class ExportService {
    static async createExportRequest(topicId, startTime, endTime, requester, reason, idempotencyKey) {
        const rangeIdentifier = `${startTime}-${endTime}`;
        const finalIdempotencyKey = idempotencyKey || hash_service_1.HashService.generateIdempotencyKey(requester, topicId, rangeIdentifier);
        const existingRequest = await (0, database_1.getOne)("SELECT * FROM export_requests WHERE idempotency_key = ?", [finalIdempotencyKey]);
        if (existingRequest) {
            return { isNew: false, request: existingRequest };
        }
        const rangeId = (0, uuid_1.v4)();
        const requestId = (0, uuid_1.v4)();
        const now = new Date().toISOString();
        const events = await (0, database_1.getAll)("SELECT id FROM audit_log_events WHERE topic_id = ? AND timestamp >= ? AND timestamp <= ? ORDER BY timestamp", [topicId, startTime, endTime]);
        const originalInput = {
            topicId,
            startTime,
            endTime,
            requester,
            reason,
            idempotencyKey: finalIdempotencyKey,
            timestamp: now
        };
        await (0, database_1.runQuery)(`INSERT INTO event_ranges (id, topic_id, start_time, end_time, event_count, created_at)`
            +
                `VALUES (?, ?, ?, ?, ?, ?)`, [rangeId, topicId, startTime, endTime, events.length, now]);
        await (0, database_1.runQuery)(`INSERT INTO export_requests `
            +
                `(id, topic_id, range_id, requester, reason, status, idempotency_key, original_input, created_at, updated_at)`
            +
                `VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            requestId,
            topicId,
            rangeId,
            requester,
            reason,
            types_1.ExportRequestStatus.PENDING,
            finalIdempotencyKey,
            JSON.stringify(originalInput),
            now,
            now
        ]);
        await this.addProcessingHistory(requestId, "create", requester, {
            rangeCreated: true,
            eventCount: events.length
        });
        const request = await (0, database_1.getOne)("SELECT * FROM export_requests WHERE id = ?", [requestId]);
        return { isNew: true, request };
    }
    static async approveRequest(requestId, approver, comment) {
        const now = new Date().toISOString();
        await (0, database_1.runQuery)(`UPDATE export_requests `
            +
                `SET status = ?, approver = ?, approval_comment = ?, approved_at = ?, updated_at = ?`
            +
                `WHERE id = ?`, [types_1.ExportRequestStatus.APPROVED, approver, comment || null, now, now, requestId]);
        await this.addProcessingHistory(requestId, "approve", approver, { comment });
        return this.getRequestById(requestId);
    }
    static async rejectRequest(requestId, approver, reason) {
        const now = new Date().toISOString();
        await (0, database_1.runQuery)(`UPDATE export_requests `
            +
                `SET status = ?, approver = ?, approval_comment = ?, updated_at = ?, final_conclusion = ?`
            +
                `WHERE id = ?`, [types_1.ExportRequestStatus.REJECTED, approver, reason, now, `请求被拒绝: ${reason}`, requestId]);
        await this.addProcessingHistory(requestId, "reject", approver, { reason });
        return this.getRequestById(requestId);
    }
    static async verifyHashChain(requestId, verifier) {
        const request = await this.getRequestById(requestId);
        if (!request) {
            throw new Error("Export request not found");
        }
        const range = await (0, database_1.getOne)("SELECT * FROM event_ranges WHERE id = ?", [request.range_id]);
        if (!range) {
            throw new Error("Event range not found");
        }
        await (0, database_1.runQuery)(`UPDATE export_requests SET status = ?, updated_at = ? WHERE id = ?`, [types_1.ExportRequestStatus.PROCESSING, new Date().toISOString(), requestId]);
        const hashChains = await (0, database_1.getAll)(`SELECT * FROM hash_chains `
            +
                `WHERE topic_id = ? AND event_timestamp >= ? AND event_timestamp <= ?`
            +
                `ORDER BY chain_sequence`, [range.topic_id, range.start_time, range.end_time]);
        let isValid = true;
        const mismatches = [];
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
        const verificationId = (0, uuid_1.v4)();
        const now = new Date().toISOString();
        await (0, database_1.runQuery)(`INSERT INTO verification_results `
            +
                `(id, request_id, range_id, status, hash_chain_valid, first_hash, last_hash, `
            +
                `verified_count, total_count, mismatch_details, verified_at, verified_by)`
            +
                `VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            verificationId,
            requestId,
            range.id,
            isValid ? types_1.VerificationStatus.VERIFIED : types_1.VerificationStatus.FAILED,
            isValid ? 1 : 0,
            hashChains[0]?.current_hash || "",
            hashChains[hashChains.length - 1]?.current_hash || "",
            hashChains.length,
            range.event_count,
            JSON.stringify(mismatches),
            now,
            verifier
        ]);
        const newStatus = isValid ? types_1.ExportRequestStatus.PROCESSING : types_1.ExportRequestStatus.FAILED;
        const failureReason = isValid ? null : `哈希链校验失败: ${mismatches.length}处不匹配`;
        await (0, database_1.runQuery)(`UPDATE export_requests `
            +
                `SET status = ?, failure_reason = ?, updated_at = ?`
            +
                `WHERE id = ?`, [newStatus, failureReason, now, requestId]);
        await this.addProcessingHistory(requestId, "verify_hash_chain", verifier, {
            isValid,
            verifiedCount: hashChains.length,
            mismatches: mismatches.length
        });
        return { verificationId, isValid, mismatches, hashChains };
    }
    static async getRequestById(requestId) {
        const request = await (0, database_1.getOne)("SELECT * FROM export_requests WHERE id = ?", [requestId]);
        if (!request)
            return null;
        return {
            ...request,
            original_input: typeof request.original_input === "string" ? JSON.parse(request.original_input) : request.original_input,
            processing_evidence: request.processing_evidence ? JSON.parse(request.processing_evidence) : null
        };
    }
    static async getRequests(filters) {
        let sql = "SELECT * FROM export_requests WHERE 1=1";
        const params = [];
        if (filters?.status) {
            sql += " AND status = ?";
            params.push(filters.status);
        }
        if (filters?.topicId) {
            sql += " AND topic_id = ?";
            params.push(filters.topicId);
        }
        if (filters?.requester) {
            sql += " AND requester = ?";
            params.push(filters.requester);
        }
        sql += " ORDER BY created_at DESC";
        const requests = await (0, database_1.getAll)(sql, params);
        return requests.map(r => ({
            ...r,
            original_input: typeof r.original_input === "string" ? JSON.parse(r.original_input) : r.original_input
        }));
    }
    static async addProcessingHistory(requestId, action, actor, details) {
        const historyId = (0, uuid_1.v4)();
        await (0, database_1.runQuery)(`INSERT INTO processing_history (id, request_id, action, actor, details, timestamp)`
            +
                `VALUES (?, ?, ?, ?, ?, ?)`, [historyId, requestId, action, actor, JSON.stringify(details), new Date().toISOString()]);
        return historyId;
    }
    static async getProcessingHistory(requestId) {
        const history = await (0, database_1.getAll)("SELECT * FROM processing_history WHERE request_id = ? ORDER BY timestamp", [requestId]);
        return history.map(h => ({
            ...h,
            details: typeof h.details === "string" ? JSON.parse(h.details) : h.details
        }));
    }
    static async generateProofReport(requestId, generator, format = "json") {
        const verification = await (0, database_1.getOne)("SELECT * FROM verification_results WHERE request_id = ? ORDER BY verified_at DESC LIMIT 1", [requestId]);
        if (!verification) {
            throw new Error("Verification result not found");
        }
        const request = await this.getRequestById(requestId);
        const range = await (0, database_1.getOne)("SELECT * FROM event_ranges WHERE id = ?", [request.range_id]);
        const reportId = (0, uuid_1.v4)();
        const now = new Date().toISOString();
        const reportContent = {
            summary: `审计日志导出证明报告 - 主题: ${range.topic_id}`,
            verification_details: {
                hash_chain_integrity: verification.hash_chain_valid === 1,
                event_count_match: verification.verified_count === verification.total_count,
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
            conclusion: verification.hash_chain_valid === 1
                ? "该审计日志范围哈希链完整，数据未被篡改，可以安全导出。"
                : "该审计日志范围哈希链存在不匹配，数据可能被篡改，导出被阻止。"
        };
        await (0, database_1.runQuery)(`INSERT INTO proof_reports (id, request_id, verification_id, report_content, file_format, generated_at)`
            +
                `VALUES (?, ?, ?, ?, ?, ?)`, [reportId, requestId, verification.id, JSON.stringify(reportContent), format, now]);
        const finalStatus = verification.hash_chain_valid === 1
            ? types_1.ExportRequestStatus.COMPLETED
            : types_1.ExportRequestStatus.FAILED;
        await (0, database_1.runQuery)(`UPDATE export_requests `
            +
                `SET status = ?, final_conclusion = ?, updated_at = ?`
            +
                `WHERE id = ?`, [finalStatus, reportContent.conclusion, now, requestId]);
        await this.addProcessingHistory(requestId, "generate_report", generator, {
            reportId,
            format,
            status: finalStatus
        });
        return { reportId, reportContent, format };
    }
    static async exportEvents(requestId) {
        const request = await this.getRequestById(requestId);
        if (!request) {
            throw new Error("Export request not found");
        }
        if (request.status !== types_1.ExportRequestStatus.APPROVED && request.status !== types_1.ExportRequestStatus.PROCESSING) {
            throw new Error("Request not approved or already processed");
        }
        const range = await (0, database_1.getOne)("SELECT * FROM event_ranges WHERE id = ?", [request.range_id]);
        const events = await (0, database_1.getAll)(`SELECT e.*, hc.current_hash, hc.chain_sequence`
            +
                `FROM audit_log_events e`
            +
                `LEFT JOIN hash_chains hc ON e.id = hc.event_id`
            +
                `WHERE e.topic_id = ? AND e.timestamp >= ? AND e.timestamp <= ?`
            +
                `ORDER BY e.timestamp`, [range.topic_id, range.start_time, range.end_time]);
        return events.map(e => ({
            ...e,
            details: typeof e.details === "string" ? JSON.parse(e.details) : e.details
        }));
    }
}
exports.ExportService = ExportService;
