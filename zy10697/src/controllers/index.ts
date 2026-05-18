import { Request, Response } from 'express';
import { SkipApplicationService } from '../services/skipApplication.service';
import { WorkflowService } from '../services/workflow.service';
import { ExportService } from '../services/export.service';
import {
  CreateSkipApplicationRequest,
  ApproveSkipRequest,
  ExecuteTaskRequest,
  ReportDownstreamExceptionRequest
} from '../models/types';

export class SkipApplicationController {
  static async create(req: Request, res: Response) {
    try {
      const request: CreateSkipApplicationRequest = req.body;
      const requiredFields = ['workflow_id', 'task_id', 'task_name', 'skip_reason', 'impact_scope', 'rerun_plan', 'applicant'];
      const missingFields = requiredFields.filter(f => !(f in request));
      
      if (missingFields.length > 0) {
        return res.status(400).json({
          success: false,
          error: `缺少必填字段: ${missingFields.join(', ')}`
        });
      }

      const result = await SkipApplicationService.create(request);
      res.status(201).json({
        success: true,
        data: {
          message: '跳过申请创建成功',
          application: result,
          next_step: '请等待审批'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  }

  static async approve(req: Request, res: Response) {
    try {
      const request: ApproveSkipRequest = req.body;
      const requiredFields = ['skip_application_id', 'approver', 'approval_result'];
      const missingFields = requiredFields.filter(f => !(f in request));
      
      if (missingFields.length > 0) {
        return res.status(400).json({
          success: false,
          error: `缺少必填字段: ${missingFields.join(', ')}`
        });
      }

      const application = await SkipApplicationService.getById(request.skip_application_id);
      if (!application) {
        return res.status(404).json({
          success: false,
          error: '跳过申请不存在'
        });
      }

      if (application.status !== 'pending') {
        return res.status(400).json({
          success: false,
          error: '该申请已处理，无法重复审批'
        });
      }

      await SkipApplicationService.approve(request);
      
      res.json({
        success: true,
        data: {
          message: request.approval_result === 'approved' ? '审批通过' : '审批拒绝',
          next_step: request.approval_result === 'approved' 
            ? '任务将被标记为跳过，请关注下游任务数据完整性并安排补跑'
            : '申请已拒绝'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  }

  static async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const application = await SkipApplicationService.getById(id);
      
      if (!application) {
        return res.status(404).json({
          success: false,
          error: '跳过申请不存在'
        });
      }

      res.json({
        success: true,
        data: application
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  }

  static async getAll(req: Request, res: Response) {
    try {
      const applications = await SkipApplicationService.getAll();
      res.json({
        success: true,
        data: applications
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  }
}

export class WorkflowController {
  static async executeTask(req: Request, res: Response) {
    try {
      const request: ExecuteTaskRequest = req.body;
      const skipApplicationId = req.query.skip_application_id as string;
      
      const requiredFields = ['workflow_id', 'task_id', 'task_name', 'downstream_tasks'];
      const missingFields = requiredFields.filter(f => !(f in request));
      
      if (missingFields.length > 0) {
        return res.status(400).json({
          success: false,
          error: `缺少必填字段: ${missingFields.join(', ')}`
        });
      }

      const result = await WorkflowService.executeTask(request, skipApplicationId);
      
      const isComplete = result.data_completeness === 'complete';
      res.json({
        success: true,
        data: {
          message: isComplete ? '任务执行完成' : '任务已跳过，下游数据可能不完整',
          workflow_record: result,
          data_completeness: result.data_completeness,
          warning: !isComplete ? '警告：数据不完整，下游任务可能异常，请及时补跑' : null
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  }

  static async reportDownstreamException(req: Request, res: Response) {
    try {
      const request: ReportDownstreamExceptionRequest = req.body;
      const requiredFields = ['workflow_record_id', 'skip_application_id'];
      const missingFields = requiredFields.filter(f => !(f in request));
      
      if (missingFields.length > 0) {
        return res.status(400).json({
          success: false,
          error: `缺少必填字段: ${missingFields.join(', ')}`
        });
      }

      await WorkflowService.reportDownstreamException(request);
      
      res.json({
        success: true,
        data: {
          message: '下游异常已上报，状态已更新为下游异常',
          next_step: '请立即安排补跑，补跑完成前服务无法正常关闭'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  }

  static async createRerun(req: Request, res: Response) {
    try {
      const { skip_application_id, task_id, task_name } = req.body;
      
      if (!skip_application_id || !task_id || !task_name) {
        return res.status(400).json({
          success: false,
          error: '缺少必填字段: skip_application_id, task_id, task_name'
        });
      }

      const result = await WorkflowService.createRerunRecord(skip_application_id, task_id, task_name);
      
      res.json({
        success: true,
        data: {
          message: '补跑记录已创建',
          rerun_record: result
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  }

  static async startRerun(req: Request, res: Response) {
    try {
      const { rerun_id } = req.params;
      await WorkflowService.startRerun(rerun_id);
      
      res.json({
        success: true,
        data: {
          message: '补跑已开始'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  }

  static async completeRerun(req: Request, res: Response) {
    try {
      const { rerun_id } = req.params;
      const { success } = req.body;
      
      await WorkflowService.completeRerun(rerun_id, success !== false);
      
      res.json({
        success: true,
        data: {
          message: success === false ? '补跑失败' : '补跑完成，跳过流程已闭环',
          next_step: success === false ? '请重新发起补跑' : null
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  }

  static async checkCanClose(req: Request, res: Response) {
    try {
      const { workflow_id } = req.params;
      const result = await WorkflowService.canCloseService(workflow_id);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  }

  static async getWorkflowRecords(req: Request, res: Response) {
    try {
      const { workflow_id } = req.query;
      const records = await WorkflowService.getWorkflowRecords(workflow_id as string);
      
      res.json({
        success: true,
        data: records
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  }

  static async getRerunRecords(req: Request, res: Response) {
    try {
      const { skip_application_id } = req.query;
      const records = await WorkflowService.getRerunRecords(skip_application_id as string);
      
      res.json({
        success: true,
        data: records
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  }
}

export class ExportController {
  static async exportSkipRecords(req: Request, res: Response) {
    try {
      const outputPath = await ExportService.exportSkipRecords();
      
      res.json({
        success: true,
        data: {
          message: '导出成功',
          file_path: outputPath
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  }
}