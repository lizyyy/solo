import { Request, Response } from 'express';
import { SubmissionService } from '../services/SubmissionService';
import { SubmissionDAO } from '../models/SubmissionDAO';
import { BatchActionType } from '../models/types';

export class SubmissionController {
  static createSubmission(req: Request, res: Response) {
    try {
      const { batchId, studentId, studentName, courseCode, courseName, content, attachments } = req.body;
      const createdBy = req.headers['x-user'] as string || 'system';

      const submission = SubmissionService.createSubmission({
        batchId, studentId, studentName, courseCode, courseName, content, attachments
      }, createdBy);

      res.status(201).json({ success: true, data: submission });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static getSubmission(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { withHistory } = req.query;

      if (withHistory === 'true') {
        const result = SubmissionService.getSubmissionWithHistory(id);
        if (!result.submission) {
          return res.status(404).json({ success: false, error: '提交不存在' });
        }
        return res.json({ success: true, data: result.submission, history: result.history });
      }

      const submission = SubmissionDAO.getById(id);
      if (!submission) {
        return res.status(404).json({ success: false, error: '提交不存在' });
      }

      res.json({ success: true, data: submission });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static getSubmissions(req: Request, res: Response) {
    try {
      const { batchId, status } = req.query;
      
      let submissions;
      if (batchId) {
        submissions = SubmissionDAO.getByBatchId(batchId as string);
      } else if (status) {
        submissions = SubmissionDAO.getByStatus(status as any);
      } else {
        submissions = SubmissionDAO.getAll();
      }

      res.json({ success: true, data: submissions });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async processSubmission(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const processedBy = req.headers['x-user'] as string || 'system';

      const submission = await SubmissionService.processSubmission(id, processedBy);

      res.json({ success: true, data: submission });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static previewBatchAction(req: Request, res: Response) {
    try {
      const { batchId, actionType } = req.params;

      const preview = SubmissionService.previewBatchAction(
        batchId,
        actionType as BatchActionType
      );

      res.json({ success: true, data: preview });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async processBatch(req: Request, res: Response) {
    try {
      const { batchId } = req.params;
      const processedBy = req.headers['x-user'] as string || 'system';

      const count = await SubmissionService.processBatch(batchId, processedBy);
      const stats = SubmissionService.getBatchStats(batchId);

      res.json({ success: true, data: { processedCount: count, stats } });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static updateSubmissionField(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { fieldName, oldValue, newValue, changeReason, sourceSystem } = req.body;
      const changedBy = req.headers['x-user'] as string || 'system';

      const submission = SubmissionService.updateSubmissionField(
        id, fieldName, oldValue, newValue, changeReason, sourceSystem, changedBy
      );

      if (!submission) {
        return res.status(404).json({ success: false, error: '提交不存在' });
      }

      res.json({ success: true, data: submission });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static getBatchStats(req: Request, res: Response) {
    try {
      const { batchId } = req.params;
      const stats = SubmissionService.getBatchStats(batchId);
      res.json({ success: true, data: stats });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static getAllBatches(req: Request, res: Response) {
    try {
      const batches = SubmissionService.getAllBatches();
      res.json({ success: true, data: batches });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }
}
