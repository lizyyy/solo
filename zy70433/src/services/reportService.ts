import { v4 as uuidv4 } from 'uuid';
import { runQuery, runExecute } from '../database/db';

export interface ReportData {
  id: string;
  batchId: string;
  departmentName: string;
  ruleVersion: string;
  ruleDescription: string;
  beforeComparison: string;
  afterComparison: string;
  executionDuration: number;
  nextSteps: string;
  generatedAt: string;
}

export class ReportService {
  private async getBatchDetail(batchId: string) {
    const batches = await runQuery(
      `SELECT 
        qb.*,
        d.name as department_name,
        d.code as department_code,
        rv.description as rule_description,
        ar.before_quota,
        ar.after_quota,
        ar.change_amount,
        ar.status as record_status,
        ar.error_message
      FROM quota_batches qb
      LEFT JOIN departments d ON qb.department_id = d.id
      LEFT JOIN rule_versions rv ON qb.rule_version = rv.version
      LEFT JOIN allocation_records ar ON qb.id = ar.batch_id
      WHERE qb.id = ?`,
      [batchId]
    );
    return batches[0] || null;
  }

  private async getContractSupplements(departmentId: string) {
    return await runQuery(
      'SELECT * FROM offline_contracts WHERE department_id = ? AND status = ?',
      [departmentId, 'approved']
    );
  }

  private formatComparison(batch: any, contracts: any[]): { before: string; after: string } {
    const beforeLines = [
      `部门: ${batch.department_name} (${batch.department_code})`,
      `申请金额: ${(batch.total_quota / 10000).toFixed(2)}万元`,
      `执行前配额余额: ${(batch.before_quota / 10000).toFixed(2)}万元`,
      `规则版本: ${batch.rule_version}`,
      `关联合同补充页数: ${contracts.filter((c: any) => c.supplement_page_no).length}份`,
    ];

    const afterLines = [
      `执行状态: ${batch.status === 'completed' ? '成功' : '失败'}`,
      `实际发放金额: ${(batch.change_amount / 10000).toFixed(2)}万元`,
      `执行后配额余额: ${(batch.after_quota / 10000).toFixed(2)}万元`,
      `执行耗时: ${batch.execution_duration}ms`,
    ];

    if (batch.status === 'failed') {
      afterLines.push(`失败原因: ${batch.error_message || batch.remark}`);
    }

    contracts.forEach((c: any) => {
      if (c.supplement_page_no) {
        afterLines.push(`补充依据: ${c.contract_no} ${c.supplement_page_no}`);
      }
    });

    return {
      before: beforeLines.join('\n'),
      after: afterLines.join('\n'),
    };
  }

  private generateNextSteps(batch: any): string {
    const nextSteps: string[] = [];

    if (batch.status === 'completed') {
      nextSteps.push('1. 请在3个工作日内提交配额使用计划');
      nextSteps.push('2. 每月5日前上报上月配额使用明细');
      if (batch.total_quota > 5000000) {
        nextSteps.push('3. 大额配额需分管领导签字确认后启用');
      }
      nextSteps.push('4. 请关注临时白名单有效期，到期前及时续期');
    } else {
      nextSteps.push('1. 请根据失败原因调整申请材料');
      if (batch.error_message?.includes('超过最大限额')) {
        nextSteps.push('2. 建议将大额申请拆分为多笔');
      }
      if (batch.error_message?.includes('规则版本')) {
        nextSteps.push('2. 请核对使用的规则版本号是否正确');
      }
      nextSteps.push('3. 重新提交前请与风控部门预审');
    }

    return nextSteps.join('\n');
  }

  async generateReport(batchId: string): Promise<ReportData | null> {
    const batch = await this.getBatchDetail(batchId);
    if (!batch) {
      return null;
    }

    const contracts = await this.getContractSupplements(batch.department_id);
    const comparison = this.formatComparison(batch, contracts);
    const nextSteps = this.generateNextSteps(batch);

    const reportId = uuidv4();
    await runExecute(
      'INSERT INTO reports (id, batch_id, before_comparison, after_comparison, execution_duration, next_steps) VALUES (?, ?, ?, ?, ?, ?)',
      [
        reportId,
        batchId,
        comparison.before,
        comparison.after,
        batch.execution_duration || 0,
        nextSteps,
      ]
    );

    return {
      id: reportId,
      batchId,
      departmentName: batch.department_name,
      ruleVersion: batch.rule_version,
      ruleDescription: batch.rule_description,
      beforeComparison: comparison.before,
      afterComparison: comparison.after,
      executionDuration: batch.execution_duration || 0,
      nextSteps,
      generatedAt: new Date().toISOString(),
    };
  }

  async getReport(reportId: string) {
    const reports = await runQuery(
      `SELECT 
        r.*,
        qb.rule_version,
        rv.description as rule_description,
        d.name as department_name
      FROM reports r
      LEFT JOIN quota_batches qb ON r.batch_id = qb.id
      LEFT JOIN rule_versions rv ON qb.rule_version = rv.version
      LEFT JOIN departments d ON qb.department_id = d.id
      WHERE r.id = ?`,
      [reportId]
    );
    return reports[0] || null;
  }

  async getAllReports() {
    return await runQuery(`
      SELECT 
        r.*,
        qb.rule_version,
        rv.description as rule_description,
        d.name as department_name,
        qb.status as batch_status
      FROM reports r
      LEFT JOIN quota_batches qb ON r.batch_id = qb.id
      LEFT JOIN rule_versions rv ON qb.rule_version = rv.version
      LEFT JOIN departments d ON qb.department_id = d.id
      ORDER BY r.generated_at DESC
    `);
  }
}

export default new ReportService();
