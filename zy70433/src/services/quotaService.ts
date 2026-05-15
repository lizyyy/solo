import { v4 as uuidv4 } from 'uuid';
import { runQuery, runExecute } from '../database/db';

export interface AllocationRequest {
  departmentId: string;
  ruleVersion: string;
  requestedAmount: number;
  callerId?: string;
}

export interface AllocationResult {
  success: boolean;
  batchId?: string;
  beforeQuota: number;
  afterQuota: number;
  changeAmount: number;
  errorMessage?: string;
  executionDuration: number;
}

export class QuotaService {
  private async getRuleVersion(version: string) {
    const rules = await runQuery(
      'SELECT * FROM rule_versions WHERE version = ?',
      [version]
    );
    return rules[0] || null;
  }

  private async getDepartmentQuota(departmentId: string) {
    const records = await runQuery(
      'SELECT after_quota FROM allocation_records WHERE department_id = ? AND status = ? ORDER BY executed_at DESC LIMIT 1',
      [departmentId, 'success']
    );
    return records[0]?.after_quota || 0;
  }

  private async getActiveWhitelistAmount(departmentId: string) {
    const whitelist = await runQuery(
      'SELECT SUM(quota_amount) as total FROM temporary_whitelist WHERE department_id = ? AND is_revoked = 0 AND effective_date <= datetime("now") AND expiry_date >= datetime("now")',
      [departmentId]
    );
    return whitelist[0]?.total || 0;
  }

  private async getApprovedContractSupplement(departmentId: string) {
    const contracts = await runQuery(
      'SELECT * FROM offline_contracts WHERE department_id = ? AND status = ? AND supplement_page_no IS NOT NULL',
      [departmentId, 'approved']
    );
    return contracts;
  }

  private calculateQuotaByVersion(
    baseAmount: number,
    ruleVersion: any,
    whitelistAmount: number,
    hasContractSupplement: boolean
  ): number {
    let calculatedQuota = baseAmount;
    
    if (ruleVersion.version === 'v1.0.0') {
      calculatedQuota = baseAmount * 1.0;
    } else if (ruleVersion.version === 'v1.1.0') {
      calculatedQuota = baseAmount + whitelistAmount * 1.2;
    } else if (ruleVersion.version === 'v2.0.0') {
      calculatedQuota = baseAmount + whitelistAmount * 1.2;
      if (hasContractSupplement) {
        calculatedQuota = calculatedQuota * 1.15;
      }
    }

    return Math.round(calculatedQuota);
  }

  async allocateQuota(request: AllocationRequest): Promise<AllocationResult> {
    const startTime = Date.now();
    const batchId = uuidv4();

    try {
      const ruleVersion = await this.getRuleVersion(request.ruleVersion);
      if (!ruleVersion) {
        throw new Error(`规则版本 ${request.ruleVersion} 不存在`);
      }

      const beforeQuota = await this.getDepartmentQuota(request.departmentId);
      const whitelistAmount = await this.getActiveWhitelistAmount(request.departmentId);
      const contractSupplements = await this.getApprovedContractSupplement(request.departmentId);
      const hasContractSupplement = contractSupplements.length > 0;

      const calculatedQuota = this.calculateQuotaByVersion(
        request.requestedAmount,
        ruleVersion,
        whitelistAmount,
        hasContractSupplement
      );

      if (calculatedQuota <= 0) {
        throw new Error('计算后配额为非正数，发放失败');
      }

      if (calculatedQuota > 10000000) {
        throw new Error('配额超过最大限额1000万，请拆分申请');
      }

      const afterQuota = beforeQuota + calculatedQuota;

      await runExecute(
        'INSERT INTO quota_batches (id, rule_version, department_id, total_quota, status, executed_at, remark) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          batchId,
          request.ruleVersion,
          request.departmentId,
          calculatedQuota,
          'completed',
          new Date().toISOString(),
          `使用规则${ruleVersion.version}计算，白名单权重${hasContractSupplement ? '+合同加成' : ''}`,
        ]
      );

      await runExecute(
        'INSERT INTO allocation_records (id, batch_id, department_id, before_quota, after_quota, change_amount, status, executed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [
          uuidv4(),
          batchId,
          request.departmentId,
          beforeQuota,
          afterQuota,
          calculatedQuota,
          'success',
          new Date().toISOString(),
        ]
      );

      const executionDuration = Date.now() - startTime;

      await runExecute(
        'UPDATE quota_batches SET execution_duration = ? WHERE id = ?',
        [executionDuration, batchId]
      );

      return {
        success: true,
        batchId,
        beforeQuota,
        afterQuota,
        changeAmount: calculatedQuota,
        executionDuration,
      };
    } catch (error: any) {
      const executionDuration = Date.now() - startTime;
      const beforeQuota = await this.getDepartmentQuota(request.departmentId);

      await runExecute(
        'INSERT INTO quota_batches (id, rule_version, department_id, total_quota, status, executed_at, execution_duration, remark) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [
          batchId,
          request.ruleVersion,
          request.departmentId,
          0,
          'failed',
          new Date().toISOString(),
          executionDuration,
          error.message,
        ]
      );

      await runExecute(
        'INSERT INTO allocation_records (id, batch_id, department_id, before_quota, after_quota, change_amount, status, error_message, executed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          uuidv4(),
          batchId,
          request.departmentId,
          beforeQuota,
          beforeQuota,
          0,
          'failed',
          error.message,
          new Date().toISOString(),
        ]
      );

      return {
        success: false,
        batchId,
        beforeQuota,
        afterQuota: beforeQuota,
        changeAmount: 0,
        errorMessage: error.message,
        executionDuration,
      };
    }
  }

  async getBatchRecords(batchId?: string, departmentId?: string, status?: string) {
    let sql = `
      SELECT 
        qb.id,
        qb.rule_version,
        rv.description as rule_description,
        d.name as department_name,
        d.code as department_code,
        qb.total_quota,
        qb.status,
        qb.executed_at,
        qb.execution_duration,
        qb.remark,
        ar.before_quota,
        ar.after_quota,
        ar.change_amount,
        ar.error_message
      FROM quota_batches qb
      LEFT JOIN rule_versions rv ON qb.rule_version = rv.version
      LEFT JOIN departments d ON qb.department_id = d.id
      LEFT JOIN allocation_records ar ON qb.id = ar.batch_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (batchId) {
      sql += ' AND qb.id = ?';
      params.push(batchId);
    }
    if (departmentId) {
      sql += ' AND qb.department_id = ?';
      params.push(departmentId);
    }
    if (status) {
      sql += ' AND qb.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY qb.executed_at DESC';

    return await runQuery(sql, params);
  }

  async getWhitelistForReview() {
    return await runQuery(`
      SELECT 
        tw.*,
        d.name as department_name,
        d.code as department_code
      FROM temporary_whitelist tw
      LEFT JOIN departments d ON tw.department_id = d.id
      WHERE tw.is_revoked = 0
      ORDER BY tw.created_at DESC
    `);
  }
}

export default new QuotaService();
