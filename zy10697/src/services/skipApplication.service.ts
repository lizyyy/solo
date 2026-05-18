import db from '../models/database';
import { v4 as uuidv4 } from 'uuid';
import {
  SkipApplication,
  SkipApplicationStatus,
  TaskStatus,
  RerunStatus,
  CreateSkipApplicationRequest,
  ApproveSkipRequest,
  ExecuteTaskRequest,
  ReportDownstreamExceptionRequest
} from '../models/types';

export class SkipApplicationService {
  static async create(request: CreateSkipApplicationRequest): Promise<SkipApplication> {
    const id = uuidv4();
    const now = new Date().toISOString();
    
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO skip_applications 
         (id, workflow_id, task_id, task_name, skip_reason, impact_scope, rerun_plan, applicant, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, request.workflow_id, request.task_id, request.task_name, request.skip_reason, 
         request.impact_scope, request.rerun_plan, request.applicant, SkipApplicationStatus.PENDING, now, now],
        function(err) {
          if (err) reject(err);
          else resolve({ ...request, id, status: SkipApplicationStatus.PENDING, created_at: now, updated_at: now });
        }
      );
    });
  }

  static async getById(id: string): Promise<SkipApplication | null> {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM skip_applications WHERE id = ?', [id], (err, row: any) => {
        if (err) reject(err);
        else resolve(row || null);
      });
    });
  }

  static async getAll(): Promise<SkipApplication[]> {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM skip_applications ORDER BY created_at DESC', (err, rows: any[]) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static async updateStatus(id: string, status: SkipApplicationStatus): Promise<void> {
    const now = new Date().toISOString();
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE skip_applications SET status = ?, updated_at = ? WHERE id = ?',
        [status, now, id],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  static async approve(request: ApproveSkipRequest): Promise<void> {
    const application = await this.getById(request.skip_application_id);
    
    if (!application) {
      throw new Error('跳过申请不存在');
    }
    
    if (application.status !== SkipApplicationStatus.PENDING) {
      throw new Error('该申请已处理，无法重复审批');
    }
    
    const approvalId = uuidv4();
    const now = new Date().toISOString();
    
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run(
          `INSERT INTO approval_records 
           (id, skip_application_id, approver, approval_result, approval_comment, approved_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [approvalId, request.skip_application_id, request.approver, 
           request.approval_result, request.approval_comment || null, now]
        );
        
        const newStatus = request.approval_result === 'approved' 
          ? SkipApplicationStatus.APPROVED 
          : SkipApplicationStatus.REJECTED;
        
        db.run(
          'UPDATE skip_applications SET status = ?, updated_at = ? WHERE id = ?',
          [newStatus, now, request.skip_application_id],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    });
  }
}