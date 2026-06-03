import { Request, Response } from 'express';
import RecordService from '../services/RecordService';
import ReconciliationService from '../services/ReconciliationService';
import { ReconciliationNoteUpdate, ReviewCreate } from '../models';

class RecordController {
  async getAllRecords(req: Request, res: Response) {
    try {
      const { fundCode, onlyModifications } = req.query;
      
      let records;
      if (onlyModifications === 'true') {
        records = RecordService.getRecordsWithManualModifications();
      } else if (fundCode) {
        records = RecordService.getRecordsByFundCode(fundCode as string);
      } else {
        records = RecordService.getAllRecords();
      }
      
      res.json({
        success: true,
        data: records
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : '获取记录失败'
      });
    }
  }

  async getRecordById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const record = RecordService.getRecordById(id);
      
      if (!record) {
        return res.status(404).json({
          success: false,
          message: '记录不存在'
        });
      }
      
      res.json({
        success: true,
        data: record
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : '获取记录详情失败'
      });
    }
  }

  async importRecords(req: Request, res: Response) {
    try {
      const { records, operator } = req.body;
      
      if (!records || !Array.isArray(records)) {
        return res.status(400).json({
          success: false,
          message: '请提供有效的记录数据'
        });
      }

      const result = RecordService.importRecords(records, operator || '支付平台阿南');
      
      res.json({
        success: true,
        data: result,
        message: `成功导入${result.imported}条记录，其中${result.hasManualModifications}条包含人工修改`
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : '导入记录失败'
      });
    }
  }

  async updateReconciliationNote(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const note = req.body as ReconciliationNoteUpdate;
      
      if (!note.whyKept || !note.nextAction) {
        return res.status(400).json({
          success: false,
          message: '请提供完整的对账说明'
        });
      }

      ReconciliationService.updateReconciliationNote(id, note);
      const updatedRecord = RecordService.getRecordById(id);
      
      res.json({
        success: true,
        data: updatedRecord,
        message: '对账说明已更新'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : '更新对账说明失败'
      });
    }
  }

  async markAsManualModification(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { actualArrivalDate, modifiedBy, modificationReason } = req.body;
      
      if (!actualArrivalDate || !modifiedBy || !modificationReason) {
        return res.status(400).json({
          success: false,
          message: '请提供完整的修改信息'
        });
      }

      const record = RecordService.markAsManualModification(
        id,
        actualArrivalDate,
        modifiedBy,
        modificationReason
      );
      
      res.json({
        success: true,
        data: record,
        message: '已标记为T+1→T+2人工修改，状态已更新为待基金经理复核'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : '标记修改失败'
      });
    }
  }

  async reviewRecord(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { reviewer, status, comment } = req.body;
      
      if (!reviewer || !status) {
        return res.status(400).json({
          success: false,
          message: '请提供复核人及复核状态'
        });
      }

      const reviewData: ReviewCreate = {
        recordId: id,
        reviewer,
        status,
        comment
      };

      const result = RecordService.reviewRecord(reviewData);
      
      res.json({
        success: true,
        data: result,
        message: `记录已${status === 'approved' ? '通过' : '驳回'}`
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : '复核失败'
      });
    }
  }

  async rerunReconciliation(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { operator } = req.body;
      
      const record = RecordService.rerunReconciliation(id, operator || '系统');
      
      res.json({
        success: true,
        data: record,
        message: '对账逻辑已重跑，对账说明已更新'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : '重跑对账失败'
      });
    }
  }

  async getReviewHistory(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const history = RecordService.getReviewHistory(id);
      
      res.json({
        success: true,
        data: history
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : '获取复核历史失败'
      });
    }
  }
}

export default new RecordController();
