import { v4 as uuidv4 } from 'uuid';
import { createObjectCsvWriter } from 'csv-writer';
import { getAll, getOne, runQuery } from '../database';
import { ContractStatus, VerifyResult } from '../types';
import { verifyService } from './verifyService';

export class ContractService {
  async createSupplier(name: string, publicKey: string, signAlgorithm: string = 'RSA256') {
    const id = uuidv4();
    await runQuery(`
      INSERT INTO suppliers (id, name, public_key, sign_algorithm)
      VALUES (?, ?, ?, ?)
    `, [id, name, publicKey, signAlgorithm]);
    return { id, name, publicKey, signAlgorithm };
  }

  async getSupplier(supplierId: string) {
    return getOne('SELECT * FROM suppliers WHERE id = ?', [supplierId]);
  }

  async createContractVersion(
    supplierId: string,
    version: string,
    callbackUrl: string,
    expectedFields: string[],
    signHeaderName: string = 'X-Signature'
  ) {
    const id = uuidv4();
    await runQuery(`
      INSERT INTO contract_versions (id, supplier_id, version, callback_url, expected_fields, sign_header_name)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [id, supplierId, version, callbackUrl, JSON.stringify(expectedFields), signHeaderName]);
    return { id, supplierId, version, callbackUrl, expectedFields, signHeaderName };
  }

  async getContractVersion(contractId: string) {
    const row = await getOne('SELECT * FROM contract_versions WHERE id = ?', [contractId]);
    if (row) {
      row.expected_fields = JSON.parse(row.expected_fields);
    }
    return row;
  }

  async getSupplierContracts(supplierId: string) {
    const rows = await getAll(
      'SELECT * FROM contract_versions WHERE supplier_id = ? ORDER BY created_at DESC',
      [supplierId]
    );
    return rows.map((row: any) => ({
      ...row,
      expected_fields: JSON.parse(row.expected_fields)
    }));
  }

  async compareTwoVersions(versionId1: string, versionId2: string) {
    const v1 = await this.getContractVersion(versionId1);
    const v2 = await this.getContractVersion(versionId2);
    
    if (!v1 || !v2) {
      throw new Error('一个或多个契约版本不存在');
    }

    const fields1 = v1.expected_fields;
    const fields2 = v2.expected_fields;

    const added = fields2.filter((f: string) => !fields1.includes(f));
    const removed = fields1.filter((f: string) => !fields2.includes(f));
    const common = fields1.filter((f: string) => fields2.includes(f));

    return {
      version1: { id: v1.id, version: v1.version, callback_url: v1.callback_url, sign_header_name: v1.sign_header_name },
      version2: { id: v2.id, version: v2.version, callback_url: v2.callback_url, sign_header_name: v2.sign_header_name },
      fieldChanges: {
        added,
        removed,
        common,
        totalInV1: fields1.length,
        totalInV2: fields2.length
      },
      signHeaderChanged: v1.sign_header_name !== v2.sign_header_name,
      callbackUrlChanged: v1.callback_url !== v2.callback_url
    };
  }

  async compareSupplierVersions(supplierId: string) {
    const contracts = await this.getSupplierContracts(supplierId);
    
    if (contracts.length < 2) {
      return {
        supplierId,
        totalVersions: contracts.length,
        message: '供应商契约版本少于2个，无法对比',
        versions: contracts
      };
    }

    const comparisons = [];
    for (let i = 0; i < contracts.length - 1; i++) {
      for (let j = i + 1; j < contracts.length; j++) {
        const comparison = await this.compareTwoVersions(contracts[i].id, contracts[j].id);
        comparisons.push(comparison);
      }
    }

    return {
      supplierId,
      totalVersions: contracts.length,
      versions: contracts,
      comparisons
    };
  }

  async createCallbackSample(
    supplierId: string,
    contractVersionId: string,
    headers: Record<string, string>,
    body: Record<string, any>
  ) {
    const sampleId = uuidv4();
    const rawRequest = JSON.stringify({ headers, body });

    await runQuery(`
      INSERT INTO callback_samples (id, contract_version_id, supplier_id, raw_request, headers, body)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [sampleId, contractVersionId, supplierId, rawRequest, JSON.stringify(headers), JSON.stringify(body)]);

    return { sampleId, supplierId, contractVersionId, headers, body };
  }

  async getCallbackSample(sampleId: string) {
    const row = await getOne('SELECT * FROM callback_samples WHERE id = ?', [sampleId]);
    if (row) {
      row.headers = JSON.parse(row.headers);
      row.body = JSON.parse(row.body);
    }
    return row;
  }

  async processSample(sampleId: string) {
    const sample = await this.getCallbackSample(sampleId);
    if (!sample) {
      throw new Error('样例不存在');
    }

    const supplier = await this.getSupplier(sample.supplier_id);
    if (!supplier) {
      throw new Error('供应商不存在');
    }

    const contract = await this.getContractVersion(sample.contract_version_id);
    if (!contract) {
      throw new Error('契约版本不存在');
    }

    const signHeaderName = contract.sign_header_name || 'X-Signature';
    const signature = sample.headers[signHeaderName] || sample.headers[signHeaderName.toLowerCase()];
    
    if (signature) {
      await verifyService.saveSignHeader(sampleId, signHeaderName, signature, 'RSA-SHA256');
    }
    
    if (!signature) {
      const conclusionId = await verifyService.createConclusion(
        sampleId,
        sample.supplier_id,
        sample.contract_version_id,
        VerifyResult.FAILED,
        VerifyResult.FAILED,
        sample.raw_request,
        `未找到签名头: ${signHeaderName}`,
        `签名头 ${signHeaderName} 缺失`
      );
      return verifyService.getConclusion(conclusionId);
    }

    const signResult = await verifyService.verifySignature(
      supplier.public_key,
      sample.body,
      signature,
      'RSA-SHA256'
    );

    const fieldResult = await verifyService.verifyFields(
      contract.expected_fields,
      sample.body
    );

    await verifyService.saveFieldDiffs(sampleId, fieldResult.diffs);

    const processingBasis = [
      signResult.basis,
      fieldResult.basis
    ].join('; ');

    const conclusionId = await verifyService.createConclusion(
      sampleId,
      sample.supplier_id,
      sample.contract_version_id,
      signResult.valid ? VerifyResult.SUCCESS : VerifyResult.FAILED,
      fieldResult.result,
      sample.raw_request,
      processingBasis
    );

    return verifyService.getConclusion(conclusionId);
  }

  async updateStatus(
    conclusionId: string,
    newStatus: ContractStatus,
    operator: string,
    remark?: string
  ) {
    const conclusion = await verifyService.getConclusion(conclusionId);
    if (!conclusion) {
      throw new Error('验收结论不存在');
    }

    const oldStatus = conclusion.status;

    await runQuery(`
      UPDATE verification_conclusions
      SET status = ?, updated_at = CURRENT_TIMESTAMP, verified_by = ?, verified_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [newStatus, operator, conclusionId]);

    await this.createAuditLog(conclusionId, 'status_change', operator, oldStatus, newStatus, remark);

    return { conclusionId, oldStatus, newStatus, operator, remark };
  }

  async manualCorrect(
    conclusionId: string,
    correctedResult: VerifyResult,
    operator: string,
    correctionRemark: string
  ) {
    const conclusion = await verifyService.getConclusion(conclusionId);
    if (!conclusion) {
      throw new Error('验收结论不存在');
    }

    const oldResult = conclusion.overall_result;
    const newStatus = correctedResult === VerifyResult.SUCCESS 
      ? ContractStatus.CONFIRMED 
      : ContractStatus.BLOCKED;

    await runQuery(`
      UPDATE verification_conclusions
      SET status = ?, overall_result = ?, final_conclusion = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      newStatus, 
      correctedResult, 
      `人工修正: 原结果 ${oldResult}, 新结果 ${correctedResult}, 修正说明: ${correctionRemark}`,
      conclusionId
    ]);

    await this.createAuditLog(
      conclusionId, 
      'manual_correction', 
      operator, 
      conclusion.status, 
      newStatus, 
      `修正结果: ${correctedResult}, 说明: ${correctionRemark}`
    );

    return { conclusionId, oldResult, correctedResult, operator, correctionRemark };
  }

  async createAuditLog(
    conclusionId: string,
    action: string,
    operator: string,
    oldStatus?: string,
    newStatus?: string,
    remark?: string
  ) {
    const logId = uuidv4();
    await runQuery(`
      INSERT INTO audit_logs (id, conclusion_id, action, operator, old_status, new_status, remark)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [logId, conclusionId, action, operator, oldStatus, newStatus, remark]);
    return logId;
  }

  async queryConclusions(filters: {
    supplierId?: string;
    status?: ContractStatus;
    overallResult?: VerifyResult;
    startDate?: string;
    endDate?: string;
  }) {
    let sql = `
      SELECT vc.*, s.name as supplier_name, cv.version as contract_version
      FROM verification_conclusions vc
      LEFT JOIN suppliers s ON vc.supplier_id = s.id
      LEFT JOIN contract_versions cv ON vc.contract_version_id = cv.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters.supplierId) {
      sql += ' AND vc.supplier_id = ?';
      params.push(filters.supplierId);
    }
    if (filters.status) {
      sql += ' AND vc.status = ?';
      params.push(filters.status);
    }
    if (filters.overallResult) {
      sql += ' AND vc.overall_result = ?';
      params.push(filters.overallResult);
    }
    if (filters.startDate) {
      sql += ' AND vc.created_at >= ?';
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      sql += ' AND vc.created_at <= ?';
      params.push(filters.endDate);
    }

    sql += ' ORDER BY vc.created_at DESC';

    return getAll(sql, params);
  }

  async exportToCSV(filters: {
    supplierId?: string;
    status?: ContractStatus;
    startDate?: string;
    endDate?: string;
  }, filePath: string) {
    const conclusions = await this.queryConclusions(filters);

    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: [
        { id: 'id', title: '结论ID' },
        { id: 'supplier_name', title: '供应商名称' },
        { id: 'contract_version', title: '契约版本' },
        { id: 'status', title: '状态' },
        { id: 'sign_result', title: '签名结果' },
        { id: 'field_result', title: '字段结果' },
        { id: 'overall_result', title: '总体结果' },
        { id: 'final_conclusion', title: '最终结论' },
        { id: 'error_message', title: '错误信息' },
        { id: 'processing_basis', title: '处理依据' },
        { id: 'created_at', title: '创建时间' }
      ]
    });

    await csvWriter.writeRecords(conclusions as any[]);
    return { exportedCount: conclusions.length, filePath };
  }

  async getExceptionTrace(conclusionId: string) {
    const conclusion = await verifyService.getConclusion(conclusionId);
    if (!conclusion) {
      throw new Error('验收结论不存在');
    }

    const sample = await this.getCallbackSample(conclusion.callback_sample_id);
    const fieldDiffs = await verifyService.getFieldDiffs(conclusion.callback_sample_id);
    const auditLogs = await verifyService.getAuditLogs(conclusionId);
    const signHeaders = await verifyService.getSignHeadersBySample(conclusion.callback_sample_id);

    return {
      conclusion,
      rawInput: conclusion.raw_input,
      processingBasis: conclusion.processing_basis,
      fieldDiffs,
      signHeaders,
      auditLogs
    };
  }
}

export const contractService = new ContractService();
