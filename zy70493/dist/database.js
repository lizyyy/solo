"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initDatabase = initDatabase;
exports.insertOfflineMemberRenewal = insertOfflineMemberRenewal;
exports.queryOfflineMemberRenewals = queryOfflineMemberRenewals;
exports.insertWhitelistRecord = insertWhitelistRecord;
exports.queryWhitelistRecords = queryWhitelistRecords;
exports.insertLabSample = insertLabSample;
exports.queryLabSamples = queryLabSamples;
exports.insertAbnormalSample = insertAbnormalSample;
exports.queryAbnormalSamples = queryAbnormalSamples;
exports.markSampleAsExported = markSampleAsExported;
exports.insertBuildArtifact = insertBuildArtifact;
exports.getDatabase = getDatabase;
exports.closeDatabase = closeDatabase;
const sqlite3_1 = __importDefault(require("sqlite3"));
const sqlite_1 = require("sqlite");
const path_1 = __importDefault(require("path"));
const uuid_1 = require("uuid");
let db = null;
async function initDatabase(dbPath) {
    if (db)
        return db;
    const databasePath = dbPath || path_1.default.join(process.cwd(), 'audit-data.db');
    db = await (0, sqlite_1.open)({
        filename: databasePath,
        driver: sqlite3_1.default.Database
    });
    await db.exec(`
    CREATE TABLE IF NOT EXISTS offline_member_renewals (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      member_id TEXT NOT NULL,
      member_name TEXT NOT NULL,
      phone_number TEXT NOT NULL,
      original_plan TEXT NOT NULL,
      renewed_plan TEXT NOT NULL,
      renewal_amount REAL NOT NULL,
      payment_method TEXT NOT NULL,
      transaction_id TEXT NOT NULL,
      operator_id TEXT NOT NULL,
      operator_name TEXT NOT NULL,
      renewal_date TEXT NOT NULL,
      effective_date TEXT NOT NULL,
      expiry_date TEXT NOT NULL,
      store_id TEXT NOT NULL,
      store_name TEXT NOT NULL,
      risk_type TEXT NOT NULL,
      risk_level TEXT NOT NULL,
      is_whitelisted INTEGER NOT NULL DEFAULT 0,
      whitelist_expiry TEXT,
      whitelist_operator TEXT,
      whitelist_reason TEXT,
      lab_sample_id TEXT,
      lab_notes TEXT,
      raw_input TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS build_artifacts (
      id TEXT PRIMARY KEY,
      artifact_name TEXT NOT NULL,
      version TEXT NOT NULL,
      build_number TEXT NOT NULL,
      checksum TEXT NOT NULL,
      signature TEXT NOT NULL,
      signer TEXT NOT NULL,
      signed_at TEXT NOT NULL,
      build_date TEXT NOT NULL,
      commit_hash TEXT NOT NULL,
      branch TEXT NOT NULL,
      build_agent TEXT NOT NULL,
      metadata TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS whitelist_records (
      id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL,
      member_name TEXT NOT NULL,
      reason TEXT NOT NULL,
      operator_id TEXT NOT NULL,
      operator_name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expiry_date TEXT NOT NULL,
      is_revoked INTEGER NOT NULL DEFAULT 0,
      revoked_at TEXT,
      revoked_by TEXT,
      revoke_reason TEXT,
      batch_id TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS lab_samples (
      id TEXT PRIMARY KEY,
      sample_code TEXT NOT NULL,
      batch_id TEXT NOT NULL,
      member_id TEXT,
      sample_type TEXT NOT NULL,
      collection_date TEXT NOT NULL,
      collection_site TEXT NOT NULL,
      collector TEXT NOT NULL,
      tester TEXT NOT NULL,
      test_result TEXT NOT NULL,
      test_date TEXT,
      manual_notes TEXT NOT NULL,
      reviewer TEXT,
      review_date TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS abnormal_samples (
      id TEXT PRIMARY KEY,
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      batch_id TEXT NOT NULL,
      risk_type TEXT NOT NULL,
      risk_level TEXT NOT NULL,
      description TEXT NOT NULL,
      detected_at TEXT NOT NULL,
      detected_by TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      assignee TEXT,
      export_status TEXT NOT NULL DEFAULT 'not_exported',
      exported_at TEXT,
      notes TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_renewals_batch ON offline_member_renewals(batch_id);
    CREATE INDEX IF NOT EXISTS idx_renewals_operator ON offline_member_renewals(operator_id);
    CREATE INDEX IF NOT EXISTS idx_renewals_risk ON offline_member_renewals(risk_type);
    CREATE INDEX IF NOT EXISTS idx_whitelist_revoked ON whitelist_records(is_revoked);
    CREATE INDEX IF NOT EXISTS idx_abnormal_batch ON abnormal_samples(batch_id);
  `);
    return db;
}
async function insertOfflineMemberRenewal(item) {
    const database = await initDatabase();
    const id = (0, uuid_1.v4)();
    const now = new Date().toISOString();
    await database.run(`
    INSERT INTO offline_member_renewals (
      id, batch_id, member_id, member_name, phone_number, original_plan,
      renewed_plan, renewal_amount, payment_method, transaction_id,
      operator_id, operator_name, renewal_date, effective_date, expiry_date,
      store_id, store_name, risk_type, risk_level, is_whitelisted,
      whitelist_expiry, whitelist_operator, whitelist_reason,
      lab_sample_id, lab_notes, raw_input, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
        id, item.batchId, item.memberId, item.memberName, item.phoneNumber,
        item.originalPlan, item.renewedPlan, item.renewalAmount, item.paymentMethod,
        item.transactionId, item.operatorId, item.operatorName, item.renewalDate,
        item.effectiveDate, item.expiryDate, item.storeId, item.storeName,
        item.riskType, item.riskLevel, item.isWhitelisted ? 1 : 0,
        item.whitelistExpiry, item.whitelistOperator, item.whitelistReason,
        item.labSampleId, item.labNotes, JSON.stringify(item.rawInput), now, now
    ]);
    return id;
}
async function queryOfflineMemberRenewals(filter = {}) {
    const database = await initDatabase();
    let query = 'SELECT * FROM offline_member_renewals WHERE 1=1';
    const params = [];
    if (filter.batchId) {
        query += ' AND batch_id = ?';
        params.push(filter.batchId);
    }
    if (filter.operatorId) {
        query += ' AND operator_id = ?';
        params.push(filter.operatorId);
    }
    if (filter.operatorName) {
        query += ' AND operator_name LIKE ?';
        params.push(`%${filter.operatorName}%`);
    }
    if (filter.riskType) {
        query += ' AND risk_type = ?';
        params.push(filter.riskType);
    }
    if (filter.startDate) {
        query += ' AND renewal_date >= ?';
        params.push(filter.startDate);
    }
    if (filter.endDate) {
        query += ' AND renewal_date <= ?';
        params.push(filter.endDate);
    }
    const rows = await database.all(query, params);
    return rows.map((row) => ({
        id: row.id,
        batchId: row.batch_id,
        memberId: row.member_id,
        memberName: row.member_name,
        phoneNumber: row.phone_number,
        originalPlan: row.original_plan,
        renewedPlan: row.renewed_plan,
        renewalAmount: row.renewal_amount,
        paymentMethod: row.payment_method,
        transactionId: row.transaction_id,
        operatorId: row.operator_id,
        operatorName: row.operator_name,
        renewalDate: row.renewal_date,
        effectiveDate: row.effective_date,
        expiryDate: row.expiry_date,
        storeId: row.store_id,
        storeName: row.store_name,
        riskType: row.risk_type,
        riskLevel: row.risk_level,
        isWhitelisted: row.is_whitelisted === 1,
        whitelistExpiry: row.whitelist_expiry,
        whitelistOperator: row.whitelist_operator,
        whitelistReason: row.whitelist_reason,
        labSampleId: row.lab_sample_id,
        labNotes: row.lab_notes,
        rawInput: JSON.parse(row.raw_input),
        createdAt: row.created_at,
        updatedAt: row.updated_at
    }));
}
async function insertWhitelistRecord(item) {
    const database = await initDatabase();
    const id = (0, uuid_1.v4)();
    await database.run(`
    INSERT INTO whitelist_records (
      id, member_id, member_name, reason, operator_id, operator_name,
      created_at, expiry_date, is_revoked, revoked_at, revoked_by,
      revoke_reason, batch_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
        id, item.memberId, item.memberName, item.reason, item.operatorId,
        item.operatorName, item.createdAt, item.expiryDate,
        item.isRevoked ? 1 : 0, item.revokedAt, item.revokedBy,
        item.revokeReason, item.batchId
    ]);
    return id;
}
async function queryWhitelistRecords(filter = {}) {
    const database = await initDatabase();
    let query = 'SELECT * FROM whitelist_records WHERE 1=1';
    const params = [];
    if (filter.batchId) {
        query += ' AND batch_id = ?';
        params.push(filter.batchId);
    }
    if (filter.operatorId) {
        query += ' AND operator_id = ?';
        params.push(filter.operatorId);
    }
    if (filter.status) {
        query += ' AND is_revoked = ?';
        params.push(filter.status === 'active' ? 0 : 1);
    }
    const rows = await database.all(query, params);
    return rows.map((row) => ({
        id: row.id,
        memberId: row.member_id,
        memberName: row.member_name,
        reason: row.reason,
        operatorId: row.operator_id,
        operatorName: row.operator_name,
        createdAt: row.created_at,
        expiryDate: row.expiry_date,
        isRevoked: row.is_revoked === 1,
        revokedAt: row.revoked_at,
        revokedBy: row.revoked_by,
        revokeReason: row.revoke_reason,
        batchId: row.batch_id
    }));
}
async function insertLabSample(item) {
    const database = await initDatabase();
    const id = (0, uuid_1.v4)();
    await database.run(`
    INSERT INTO lab_samples (
      id, sample_code, batch_id, member_id, sample_type, collection_date,
      collection_site, collector, tester, test_result, test_date,
      manual_notes, reviewer, review_date, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
        id, item.sampleCode, item.batchId, item.memberId, item.sampleType,
        item.collectionDate, item.collectionSite, item.collector, item.tester,
        item.testResult, item.testDate, item.manualNotes, item.reviewer,
        item.reviewDate, item.status, item.createdAt
    ]);
    return id;
}
async function queryLabSamples(filter = {}) {
    const database = await initDatabase();
    let query = 'SELECT * FROM lab_samples WHERE 1=1';
    const params = [];
    if (filter.batchId) {
        query += ' AND batch_id = ?';
        params.push(filter.batchId);
    }
    if (filter.status) {
        query += ' AND status = ?';
        params.push(filter.status);
    }
    const rows = await database.all(query, params);
    return rows.map((row) => ({
        id: row.id,
        sampleCode: row.sample_code,
        batchId: row.batch_id,
        memberId: row.member_id,
        sampleType: row.sample_type,
        collectionDate: row.collection_date,
        collectionSite: row.collection_site,
        collector: row.collector,
        tester: row.tester,
        testResult: row.test_result,
        testDate: row.test_date,
        manualNotes: row.manual_notes,
        reviewer: row.reviewer,
        reviewDate: row.review_date,
        status: row.status,
        createdAt: row.created_at
    }));
}
async function insertAbnormalSample(item) {
    const database = await initDatabase();
    const id = (0, uuid_1.v4)();
    await database.run(`
    INSERT INTO abnormal_samples (
      id, source_type, source_id, batch_id, risk_type, risk_level,
      description, detected_at, detected_by, status, assignee,
      export_status, exported_at, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
        id, item.sourceType, item.sourceId, item.batchId, item.riskType,
        item.riskLevel, item.description, item.detectedAt, item.detectedBy,
        item.status, item.assignee, item.exportStatus, item.exportedAt, item.notes
    ]);
    return id;
}
async function queryAbnormalSamples(filter = {}) {
    const database = await initDatabase();
    let query = 'SELECT * FROM abnormal_samples WHERE 1=1';
    const params = [];
    if (filter.batchId) {
        query += ' AND batch_id = ?';
        params.push(filter.batchId);
    }
    if (filter.riskType) {
        query += ' AND risk_type = ?';
        params.push(filter.riskType);
    }
    if (filter.status) {
        query += ' AND status = ?';
        params.push(filter.status);
    }
    const rows = await database.all(query, params);
    return rows.map((row) => ({
        id: row.id,
        sourceType: row.source_type,
        sourceId: row.source_id,
        batchId: row.batch_id,
        riskType: row.risk_type,
        riskLevel: row.risk_level,
        description: row.description,
        detectedAt: row.detected_at,
        detectedBy: row.detected_by,
        status: row.status,
        assignee: row.assignee,
        exportStatus: row.export_status,
        exportedAt: row.exported_at,
        notes: row.notes
    }));
}
async function markSampleAsExported(id) {
    const database = await initDatabase();
    const now = new Date().toISOString();
    await database.run('UPDATE abnormal_samples SET export_status = ?, exported_at = ? WHERE id = ?', ['exported', now, id]);
}
async function insertBuildArtifact(item) {
    const database = await initDatabase();
    const id = (0, uuid_1.v4)();
    await database.run(`
    INSERT INTO build_artifacts (
      id, artifact_name, version, build_number, checksum, signature,
      signer, signed_at, build_date, commit_hash, branch, build_agent, metadata
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
        id, item.artifactName, item.version, item.buildNumber, item.checksum,
        item.signature, item.signer, item.signedAt, item.buildDate,
        item.commitHash, item.branch, item.buildAgent, JSON.stringify(item.metadata)
    ]);
    return id;
}
async function getDatabase() {
    return initDatabase();
}
async function closeDatabase() {
    if (db) {
        await db.close();
        db = null;
    }
}
