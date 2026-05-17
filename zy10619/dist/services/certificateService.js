"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CertificateError = void 0;
exports.createCertificate = createCertificate;
exports.getCertificate = getCertificate;
exports.getCertificateByDomain = getCertificateByDomain;
exports.listCertificates = listCertificates;
exports.updateCertificate = updateCertificate;
exports.getCertificateHistory = getCertificateHistory;
exports.importCertificates = importCertificates;
exports.exportCertificates = exportCertificates;
const crypto_1 = require("crypto");
const database_1 = require("../models/database");
const types_1 = require("../models/types");
class CertificateError extends Error {
    constructor(code, message, suggestion = 'none', details) {
        super(message);
        this.code = code;
        this.suggestion = suggestion;
        this.details = details;
        this.name = 'CertificateError';
    }
}
exports.CertificateError = CertificateError;
function generateId() {
    return (0, crypto_1.randomUUID)();
}
function now() {
    return new Date().toISOString();
}
function createCertificate(request) {
    const existingRow = database_1.certificateQueries.findByDomain.get(request.domain);
    if (existingRow) {
        const existing = (0, database_1.rowToCertificate)(existingRow);
        throw new CertificateError('DOMAIN_EXISTS', `域名 ${request.domain} 已存在`, 'fix_data', { existingId: existing.id });
    }
    if (!request.deployNodes || request.deployNodes.length === 0) {
        throw new CertificateError('INVALID_DEPLOY_NODES', '部署节点不能为空', 'fix_data');
    }
    const id = generateId();
    const timestamp = now();
    const status = request.certificateChain ? types_1.CertificateStatus.VERIFYING : types_1.CertificateStatus.PENDING_UPLOAD;
    database_1.certificateQueries.create.run(id, request.domain, request.certificateChain || null, request.expiryDate || null, JSON.stringify(request.deployNodes), JSON.stringify([]), status, null, 0, timestamp, timestamp);
    createHistory({
        certificateId: id,
        operationSource: request.operationSource,
        operator: request.operator,
        action: 'CREATE',
        oldStatus: null,
        newStatus: status,
        changes: {
            domain: request.domain,
            deployNodes: request.deployNodes,
            ...(request.certificateChain && { hasCertificate: true }),
        },
        remarks: null,
    });
    const row = database_1.certificateQueries.findById.get(id);
    return (0, database_1.rowToCertificate)(row);
}
function getCertificate(id) {
    const row = database_1.certificateQueries.findById.get(id);
    return row ? (0, database_1.rowToCertificate)(row) : null;
}
function getCertificateByDomain(domain) {
    const row = database_1.certificateQueries.findByDomain.get(domain);
    return row ? (0, database_1.rowToCertificate)(row) : null;
}
function listCertificates() {
    const rows = database_1.certificateQueries.list.all();
    return rows.map(database_1.rowToCertificate);
}
function updateCertificate(id, request) {
    const existingRow = database_1.certificateQueries.findById.get(id);
    if (!existingRow) {
        throw new CertificateError('CERTIFICATE_NOT_FOUND', `证书记录 ${id} 不存在`, 'fix_data');
    }
    const existing = (0, database_1.rowToCertificate)(existingRow);
    const changes = {};
    if (request.certificateChain !== undefined && request.certificateChain !== existing.certificateChain) {
        changes.certificateChain = { old: existing.certificateChain, new: request.certificateChain };
    }
    if (request.expiryDate !== undefined && request.expiryDate !== existing.expiryDate) {
        changes.expiryDate = { old: existing.expiryDate, new: request.expiryDate };
    }
    if (request.deployNodes !== undefined) {
        const oldNodes = existing.deployNodes;
        const newNodes = request.deployNodes;
        if (JSON.stringify(oldNodes) !== JSON.stringify(newNodes)) {
            changes.deployNodes = { old: oldNodes, new: newNodes };
        }
    }
    if (request.verifiedNodes !== undefined) {
        const oldNodes = existing.verifiedNodes;
        const newNodes = request.verifiedNodes;
        if (JSON.stringify(oldNodes) !== JSON.stringify(newNodes)) {
            changes.verifiedNodes = { old: oldNodes, new: newNodes };
        }
    }
    if (request.remarks !== undefined && request.remarks !== existing.remarks) {
        changes.remarks = { old: existing.remarks, new: request.remarks };
    }
    if (request.forceProceed !== undefined && request.forceProceed !== existing.forceProceed) {
        changes.forceProceed = { old: existing.forceProceed, new: request.forceProceed };
    }
    const newStatus = request.status || existing.status;
    const statusChanged = newStatus !== existing.status;
    validateStatusTransition(existing.status, newStatus, existing, request);
    database_1.certificateQueries.update.run(request.certificateChain !== undefined ? request.certificateChain : null, request.expiryDate !== undefined ? request.expiryDate : null, request.deployNodes !== undefined ? JSON.stringify(request.deployNodes) : null, request.verifiedNodes !== undefined ? JSON.stringify(request.verifiedNodes) : null, newStatus, request.remarks !== undefined ? request.remarks : null, request.forceProceed !== undefined ? (request.forceProceed ? 1 : 0) : null, now(), id);
    createHistory({
        certificateId: id,
        operationSource: request.operationSource,
        operator: request.operator,
        action: statusChanged ? 'STATUS_CHANGE' : 'UPDATE',
        oldStatus: existing.status,
        newStatus: newStatus,
        changes: Object.keys(changes).length > 0 ? changes : null,
        remarks: request.remarks || null,
    });
    const updatedRow = database_1.certificateQueries.findById.get(id);
    return (0, database_1.rowToCertificate)(updatedRow);
}
function validateStatusTransition(oldStatus, newStatus, certificate, request) {
    if (oldStatus === newStatus)
        return;
    const validTransitions = {
        [types_1.CertificateStatus.PENDING_UPLOAD]: [types_1.CertificateStatus.VERIFYING],
        [types_1.CertificateStatus.VERIFYING]: [types_1.CertificateStatus.DEPLOYED, types_1.CertificateStatus.NEED_ROLLBACK],
        [types_1.CertificateStatus.DEPLOYED]: [types_1.CertificateStatus.NEED_ROLLBACK, types_1.CertificateStatus.VERIFYING],
        [types_1.CertificateStatus.NEED_ROLLBACK]: [types_1.CertificateStatus.VERIFYING, types_1.CertificateStatus.DEPLOYED],
    };
    if (!validTransitions[oldStatus]?.includes(newStatus)) {
        throw new CertificateError('INVALID_STATUS_TRANSITION', `不允许从 ${oldStatus} 变更到 ${newStatus}`, 'fix_data', { validTransitions: validTransitions[oldStatus] });
    }
    if (newStatus === types_1.CertificateStatus.DEPLOYED) {
        const allVerified = certificate.deployNodes.every(node => certificate.verifiedNodes.includes(node));
        if (!allVerified && !request.forceProceed) {
            const unverified = certificate.deployNodes.filter(node => !certificate.verifiedNodes.includes(node));
            throw new CertificateError('PARTIAL_NODES_NOT_VERIFIED', `部分边缘节点未验证: ${unverified.join(', ')}`, 'manual', {
                unverifiedNodes: unverified,
                hint: '添加备注并设置 forceProceed=true 可人工强制推进'
            });
        }
    }
}
function createHistory(params) {
    database_1.historyQueries.create.run(generateId(), params.certificateId, params.operationSource, params.operator, params.action, params.oldStatus, params.newStatus, params.changes ? JSON.stringify(params.changes) : null, params.remarks, now());
}
function getCertificateHistory(certificateId) {
    const rows = database_1.historyQueries.findByCertificateId.all(certificateId);
    return rows.map(database_1.rowToHistory);
}
function importCertificates(data, operator) {
    const success = [];
    const errors = [];
    data.forEach((item, index) => {
        try {
            if (!item.domain) {
                throw new Error('域名不能为空');
            }
            if (!item.deployNodes || item.deployNodes.length === 0) {
                throw new Error('部署节点不能为空');
            }
            const cert = createCertificate({
                ...item,
                operator,
                operationSource: types_1.OperationSource.IMPORT,
            });
            success.push(cert);
        }
        catch (error) {
            errors.push({
                row: index + 1,
                error: error.message,
                data: item,
            });
        }
    });
    return { success, errors };
}
function exportCertificates() {
    const certificates = listCertificates();
    const headers = ['域名', '状态', '到期日', '部署节点', '已验证节点', '创建时间', '更新时间'];
    const rows = certificates.map(cert => [
        cert.domain,
        cert.status,
        cert.expiryDate || '',
        cert.deployNodes.join('; '),
        cert.verifiedNodes.join('; '),
        cert.createdAt,
        cert.updatedAt,
    ]);
    const csv = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');
    return csv;
}
