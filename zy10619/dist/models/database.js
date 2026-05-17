"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = exports.historyQueries = exports.certificateQueries = void 0;
exports.rowToCertificate = rowToCertificate;
exports.rowToHistory = rowToHistory;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const db = new better_sqlite3_1.default('certificates.db');
exports.db = db;
db.exec(`
  CREATE TABLE IF NOT EXISTS domain_certificates (
    id TEXT PRIMARY KEY,
    domain TEXT NOT NULL UNIQUE,
    certificate_chain TEXT,
    expiry_date TEXT,
    deploy_nodes TEXT NOT NULL,
    verified_nodes TEXT NOT NULL,
    status TEXT NOT NULL,
    remarks TEXT,
    force_proceed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS certificate_history (
    id TEXT PRIMARY KEY,
    certificate_id TEXT NOT NULL,
    operation_source TEXT NOT NULL,
    operator TEXT NOT NULL,
    action TEXT NOT NULL,
    old_status TEXT,
    new_status TEXT,
    changes TEXT,
    remarks TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (certificate_id) REFERENCES domain_certificates(id)
  );

  CREATE INDEX IF NOT EXISTS idx_history_certificate_id ON certificate_history(certificate_id);
  CREATE INDEX IF NOT EXISTS idx_certificates_status ON domain_certificates(status);
`);
exports.certificateQueries = {
    create: db.prepare(`
    INSERT INTO domain_certificates (
      id, domain, certificate_chain, expiry_date, deploy_nodes,
      verified_nodes, status, remarks, force_proceed, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
    findById: db.prepare(`
    SELECT * FROM domain_certificates WHERE id = ?
  `),
    findByDomain: db.prepare(`
    SELECT * FROM domain_certificates WHERE domain = ?
  `),
    list: db.prepare(`
    SELECT * FROM domain_certificates ORDER BY updated_at DESC
  `),
    update: db.prepare(`
    UPDATE domain_certificates SET
      certificate_chain = COALESCE(?, certificate_chain),
      expiry_date = COALESCE(?, expiry_date),
      deploy_nodes = COALESCE(?, deploy_nodes),
      verified_nodes = COALESCE(?, verified_nodes),
      status = COALESCE(?, status),
      remarks = COALESCE(?, remarks),
      force_proceed = COALESCE(?, force_proceed),
      updated_at = ?
    WHERE id = ?
  `),
    delete: db.prepare(`
    DELETE FROM domain_certificates WHERE id = ?
  `),
};
exports.historyQueries = {
    create: db.prepare(`
    INSERT INTO certificate_history (
      id, certificate_id, operation_source, operator, action,
      old_status, new_status, changes, remarks, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
    findByCertificateId: db.prepare(`
    SELECT * FROM certificate_history WHERE certificate_id = ? ORDER BY created_at DESC
  `),
};
function rowToCertificate(row) {
    return {
        id: row.id,
        domain: row.domain,
        certificateChain: row.certificate_chain,
        expiryDate: row.expiry_date,
        deployNodes: JSON.parse(row.deploy_nodes),
        verifiedNodes: JSON.parse(row.verified_nodes),
        status: row.status,
        remarks: row.remarks,
        forceProceed: Boolean(row.force_proceed),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
function rowToHistory(row) {
    return {
        id: row.id,
        certificateId: row.certificate_id,
        operationSource: row.operation_source,
        operator: row.operator,
        action: row.action,
        oldStatus: row.old_status,
        newStatus: row.new_status,
        changes: row.changes ? JSON.parse(row.changes) : null,
        remarks: row.remarks,
        createdAt: row.created_at,
    };
}
