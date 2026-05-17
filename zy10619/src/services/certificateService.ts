import { randomUUID } from 'crypto';
import { certificateQueries, historyQueries, rowToCertificate, rowToHistory } from '../models/database';
import { CertificateStatus, OperationSource, CreateCertificateRequest, UpdateCertificateRequest, DomainCertificate, CertificateHistory } from '../models/types';

export class CertificateError extends Error {
  code: string;
  details?: Record<string, any>;
  suggestion: 'retry' | 'fix_data' | 'manual' | 'none';

  constructor(code: string, message: string, suggestion: 'retry' | 'fix_data' | 'manual' | 'none' = 'none', details?: Record<string, any>) {
    super(message);
    this.code = code;
    this.suggestion = suggestion;
    this.details = details;
    this.name = 'CertificateError';
  }
}

function generateId(): string {
  return randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

export function createCertificate(request: CreateCertificateRequest): DomainCertificate {
  const existingRow = certificateQueries.findByDomain.get(request.domain);
  if (existingRow) {
    const existing = rowToCertificate(existingRow);
    throw new CertificateError(
      'DOMAIN_EXISTS',
      `域名 ${request.domain} 已存在`,
      'fix_data',
      { existingId: existing.id }
    );
  }

  if (!request.deployNodes || request.deployNodes.length === 0) {
    throw new CertificateError(
      'INVALID_DEPLOY_NODES',
      '部署节点不能为空',
      'fix_data'
    );
  }

  const id = generateId();
  const timestamp = now();
  const status = request.certificateChain ? CertificateStatus.VERIFYING : CertificateStatus.PENDING_UPLOAD;

  certificateQueries.create.run(
    id,
    request.domain,
    request.certificateChain || null,
    request.expiryDate || null,
    JSON.stringify(request.deployNodes),
    JSON.stringify([]),
    status,
    null,
    0,
    timestamp,
    timestamp
  );

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

  const row = certificateQueries.findById.get(id);
  return rowToCertificate(row);
}

export function getCertificate(id: string): DomainCertificate | null {
  const row = certificateQueries.findById.get(id);
  return row ? rowToCertificate(row) : null;
}

export function getCertificateByDomain(domain: string): DomainCertificate | null {
  const row = certificateQueries.findByDomain.get(domain);
  return row ? rowToCertificate(row) : null;
}

export function listCertificates(): DomainCertificate[] {
  const rows = certificateQueries.list.all();
  return rows.map(rowToCertificate);
}

export function updateCertificate(id: string, request: UpdateCertificateRequest): DomainCertificate {
  const existingRow = certificateQueries.findById.get(id);
  if (!existingRow) {
    throw new CertificateError(
      'CERTIFICATE_NOT_FOUND',
      `证书记录 ${id} 不存在`,
      'fix_data'
    );
  }

  const existing = rowToCertificate(existingRow);
  const changes: Record<string, any> = {};

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

  certificateQueries.update.run(
    request.certificateChain !== undefined ? request.certificateChain : null,
    request.expiryDate !== undefined ? request.expiryDate : null,
    request.deployNodes !== undefined ? JSON.stringify(request.deployNodes) : null,
    request.verifiedNodes !== undefined ? JSON.stringify(request.verifiedNodes) : null,
    newStatus,
    request.remarks !== undefined ? request.remarks : null,
    request.forceProceed !== undefined ? (request.forceProceed ? 1 : 0) : null,
    now(),
    id
  );

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

  const updatedRow = certificateQueries.findById.get(id);
  return rowToCertificate(updatedRow);
}

function validateStatusTransition(
  oldStatus: CertificateStatus,
  newStatus: CertificateStatus,
  certificate: DomainCertificate,
  request: UpdateCertificateRequest
): void {
  if (oldStatus === newStatus) return;

  const validTransitions: Record<CertificateStatus, CertificateStatus[]> = {
    [CertificateStatus.PENDING_UPLOAD]: [CertificateStatus.VERIFYING],
    [CertificateStatus.VERIFYING]: [CertificateStatus.DEPLOYED, CertificateStatus.NEED_ROLLBACK],
    [CertificateStatus.DEPLOYED]: [CertificateStatus.NEED_ROLLBACK, CertificateStatus.VERIFYING],
    [CertificateStatus.NEED_ROLLBACK]: [CertificateStatus.VERIFYING, CertificateStatus.DEPLOYED],
  };

  if (!validTransitions[oldStatus]?.includes(newStatus)) {
    throw new CertificateError(
      'INVALID_STATUS_TRANSITION',
      `不允许从 ${oldStatus} 变更到 ${newStatus}`,
      'fix_data',
      { validTransitions: validTransitions[oldStatus] }
    );
  }

  if (newStatus === CertificateStatus.DEPLOYED) {
    const allVerified = certificate.deployNodes.every(node =>
      certificate.verifiedNodes.includes(node)
    );

    if (!allVerified && !request.forceProceed) {
      const unverified = certificate.deployNodes.filter(
        node => !certificate.verifiedNodes.includes(node)
      );
      throw new CertificateError(
        'PARTIAL_NODES_NOT_VERIFIED',
        `部分边缘节点未验证: ${unverified.join(', ')}`,
        'manual',
        {
          unverifiedNodes: unverified,
          hint: '添加备注并设置 forceProceed=true 可人工强制推进'
        }
      );
    }
  }
}

function createHistory(params: {
  certificateId: string;
  operationSource: OperationSource;
  operator: string;
  action: string;
  oldStatus: CertificateStatus | null;
  newStatus: CertificateStatus | null;
  changes: Record<string, any> | null;
  remarks: string | null;
}): void {
  historyQueries.create.run(
    generateId(),
    params.certificateId,
    params.operationSource,
    params.operator,
    params.action,
    params.oldStatus,
    params.newStatus,
    params.changes ? JSON.stringify(params.changes) : null,
    params.remarks,
    now()
  );
}

export function getCertificateHistory(certificateId: string): CertificateHistory[] {
  const rows = historyQueries.findByCertificateId.all(certificateId);
  return rows.map(rowToHistory);
}

export function importCertificates(
  data: Array<{ domain: string; certificateChain?: string; expiryDate?: string; deployNodes: string[] }>,
  operator: string
): { success: DomainCertificate[]; errors: Array<{ row: number; error: string; data: any }> } {
  const success: DomainCertificate[] = [];
  const errors: Array<{ row: number; error: string; data: any }> = [];

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
        operationSource: OperationSource.IMPORT,
      });
      success.push(cert);
    } catch (error: any) {
      errors.push({
        row: index + 1,
        error: error.message,
        data: item,
      });
    }
  });

  return { success, errors };
}

export function exportCertificates(): string {
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
