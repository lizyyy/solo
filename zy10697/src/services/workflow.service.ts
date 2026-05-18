import db from '../models/database';
import { v4 as uuidv4 } from 'uuid';
import {
  SkipApplicationStatus,
  TaskStatus,
  RerunStatus,
  ExecuteTaskRequest,
  ReportDownstreamExceptionRequest,
  WorkflowRecord,
  RerunRecord
} from '../models/types';
import { SkipApplicationService } from './skipApplication.service';

export class WorkflowService {
  static async executeTask(request: ExecuteTaskRequest, skipApplicationId?: string): Promise<WorkflowRecord> {
    const id = uuidv4();
    const now = new Date().toISOString();
    const isSkipped = skipApplicationId ? 1 : 0;
    const status = isSkipped ? TaskStatus.SKIPPED : TaskStatus.SUCCESS;
    const dataCompleteness = isSkipped ? 'incomplete' : 'complete';
    
    const record: WorkflowRecord = {
      id,
      workflow_id: request.workflow_id,
      task_id: request.task_id,
      task_name: request.task_name,
      status,
      is_skipped: isSkipped,
      skip_application_id: skipApplicationId,
      downstream_tasks: JSON.stringify(request.downstream_tasks),
      data_completeness: dataCompleteness,
      started_at: now,
      completed_at: now,
      created_at: now
    };

    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO workflow_records 
         (id, workflow_id, task_id, task_name, status, is_skipped, skip_application_id, 
          downstream_tasks, data_completeness, started_at, completed_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, request.workflow_id, request.task_id, request.task_name, status, isSkipped,
         skipApplicationId || null, JSON.stringify(request.downstream_tasks), 
         dataCompleteness, now, now, now],
        function(err) {
          if (err) reject(err);
          else resolve(record);
        }
      );
    });
  }

  static async checkDownstreamDataCompleteness(workflowRecordId: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT data_completeness FROM workflow_records WHERE id = ?',
        [workflowRecordId],
        (err, row: any) => {
          if (err) reject(err);
          else resolve(row?.data_completeness === 'complete');
        }
      );
    });
  }

  static async reportDownstreamException(request: ReportDownstreamExceptionRequest): Promise<void> {
    const now = new Date().toISOString();
    
    await SkipApplicationService.updateStatus(
      request.skip_application_id,
      SkipApplicationStatus.DOWNSTREAM_EXCEPTION
    );

    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE workflow_records SET status = ?, completed_at = ? WHERE id = ?',
        [TaskStatus.FAILED, now, request.workflow_record_id],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  static async createRerunRecord(skipApplicationId: string, taskId: string, taskName: string): Promise<RerunRecord> {
    const id = uuidv4();
    const now = new Date().toISOString();
    
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO rerun_records 
         (id, skip_application_id, rerun_task_id, rerun_task_name, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, skipApplicationId, taskId, taskName, RerunStatus.PENDING, now],
        function(err) {
          if (err) reject(err);
          else resolve({
            id,
            skip_application_id: skipApplicationId,
            rerun_task_id: taskId,
            rerun_task_name: taskName,
            status: RerunStatus.PENDING,
            created_at: now
          });
        }
      );
    });
  }

  static async startRerun(rerunId: string): Promise<void> {
    const now = new Date().toISOString();
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE rerun_records SET status = ?, started_at = ? WHERE id = ?',
        [RerunStatus.RUNNING, now, rerunId],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  static async completeRerun(rerunId: string, success: boolean = true): Promise<void> {
    const now = new Date().toISOString();
    const status = success ? RerunStatus.SUCCESS : RerunStatus.FAILED;
    
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT skip_application_id FROM rerun_records WHERE id = ?',
        [rerunId],
        (err, row: any) => {
          if (err) {
            reject(err);
            return;
          }
          
          db.serialize(() => {
            db.run(
              'UPDATE rerun_records SET status = ?, completed_at = ? WHERE id = ?',
              [status, now, rerunId]
            );
            
            if (success) {
              db.run(
                'UPDATE skip_applications SET status = ?, updated_at = ? WHERE id = ?',
                [SkipApplicationStatus.RERUN_COMPLETED, now, row.skip_application_id],
                function(updateErr) {
                  if (updateErr) reject(updateErr);
                  else resolve();
                }
              );
            } else {
              resolve();
            }
          });
        }
      );
    });
  }

  static async canCloseService(workflowId: string): Promise<{ canClose: boolean; reason?: string }> {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT sa.id, sa.task_name, sa.status 
         FROM skip_applications sa
         WHERE sa.workflow_id = ? 
         AND sa.status IN (?, ?)`,
        [workflowId, SkipApplicationStatus.APPROVED, SkipApplicationStatus.DOWNSTREAM_EXCEPTION],
        (err, rows: any[]) => {
          if (err) {
            reject(err);
            return;
          }
          
          if (rows.length > 0) {
            resolve({
              canClose: false,
              reason: `存在未完成补跑的跳过任务: ${rows.map(r => r.task_name).join(', ')}，请先完成补跑记录`
            });
          } else {
            resolve({ canClose: true });
          }
        }
      );
    });
  }

  static async getWorkflowRecords(workflowId?: string): Promise<WorkflowRecord[]> {
    return new Promise((resolve, reject) => {
      let sql = 'SELECT * FROM workflow_records';
      let params: any[] = [];
      
      if (workflowId) {
        sql += ' WHERE workflow_id = ?';
        params.push(workflowId);
      }
      
      sql += ' ORDER BY created_at DESC';
      
      db.all(sql, params, (err, rows: any[]) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static async getRerunRecords(skipApplicationId?: string): Promise<RerunRecord[]> {
    return new Promise((resolve, reject) => {
      let sql = 'SELECT * FROM rerun_records';
      let params: any[] = [];
      
      if (skipApplicationId) {
        sql += ' WHERE skip_application_id = ?';
        params.push(skipApplicationId);
      }
      
      sql += ' ORDER BY created_at DESC';
      
      db.all(sql, params, (err, rows: any[]) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}