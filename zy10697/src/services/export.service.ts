import { createObjectCsvWriter } from 'csv-writer';
import path from 'path';
import fs from 'fs';
import db from '../models/database';
import { SkipApplication } from '../models/types';

export interface SkipRecordExport {
  申请ID: string;
  工作流ID: string;
  任务ID: string;
  任务名称: string;
  跳过原因: string;
  影响范围: string;
  补跑计划: string;
  申请人: string;
  当前状态: string;
  申请时间: string;
  审批人: string;
  审批结果: string;
  审批时间: string;
  补跑状态: string;
  补跑完成时间: string;
}

export class ExportService {
  static async exportSkipRecords(outputPath?: string): Promise<string> {
    const skipApplications: SkipApplication[] = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM skip_applications ORDER BY created_at DESC', (err, rows: any[]) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    const exportPromises = skipApplications.map(async (app) => {
      const approval: any = await new Promise((resolve) => {
        db.get(
          'SELECT * FROM approval_records WHERE skip_application_id = ? ORDER BY approved_at DESC LIMIT 1',
          [app.id],
          (err, row) => resolve(row || {})
        );
      });

      const rerun: any = await new Promise((resolve) => {
        db.get(
          'SELECT * FROM rerun_records WHERE skip_application_id = ? ORDER BY created_at DESC LIMIT 1',
          [app.id],
          (err, row) => resolve(row || {})
        );
      });

      return {
        申请ID: app.id,
        工作流ID: app.workflow_id,
        任务ID: app.task_id,
        任务名称: app.task_name,
        跳过原因: app.skip_reason,
        影响范围: app.impact_scope,
        补跑计划: app.rerun_plan,
        申请人: app.applicant,
        当前状态: this.translateStatus(app.status),
        申请时间: app.created_at,
        审批人: approval.approver || '-',
        审批结果: approval.approval_result ? this.translateApprovalResult(approval.approval_result) : '-',
        审批时间: approval.approved_at || '-',
        补跑状态: rerun.status ? this.translateRerunStatus(rerun.status) : '-',
        补跑完成时间: rerun.completed_at || '-'
      };
    });

    const records = await Promise.all(exportPromises);
    
    const exportsDir = path.resolve(__dirname, '../../exports');
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }
    
    const finalOutputPath = outputPath || path.join(exportsDir, `skip-records-${Date.now()}.csv`);
    
    const csvWriter = createObjectCsvWriter({
      path: finalOutputPath,
      header: [
        { id: '申请ID', title: '申请ID' },
        { id: '工作流ID', title: '工作流ID' },
        { id: '任务ID', title: '任务ID' },
        { id: '任务名称', title: '任务名称' },
        { id: '跳过原因', title: '跳过原因' },
        { id: '影响范围', title: '影响范围' },
        { id: '补跑计划', title: '补跑计划' },
        { id: '申请人', title: '申请人' },
        { id: '当前状态', title: '当前状态' },
        { id: '申请时间', title: '申请时间' },
        { id: '审批人', title: '审批人' },
        { id: '审批结果', title: '审批结果' },
        { id: '审批时间', title: '审批时间' },
        { id: '补跑状态', title: '补跑状态' },
        { id: '补跑完成时间', title: '补跑完成时间' }
      ]
    });

    await csvWriter.writeRecords(records);
    return finalOutputPath;
  }

  private static translateStatus(status: string): string {
    const statusMap: Record<string, string> = {
      'pending': '待审批',
      'approved': '审批通过',
      'rejected': '审批拒绝',
      'downstream_exception': '下游异常',
      'rerun_completed': '补跑完成'
    };
    return statusMap[status] || status;
  }

  private static translateApprovalResult(result: string): string {
    return result === 'approved' ? '通过' : '拒绝';
  }

  private static translateRerunStatus(status: string): string {
    const statusMap: Record<string, string> = {
      'pending': '待补跑',
      'running': '补跑中',
      'success': '补跑成功',
      'failed': '补跑失败'
    };
    return statusMap[status] || status;
  }
}