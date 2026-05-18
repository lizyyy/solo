import { Request, Response } from 'express';
import { createObjectCsvStringifier } from 'csv-writer';
import { compensationService, BusinessError } from '../services/compensationService';
import { CompensationStatus, QueryParams } from '../types';

class CompensationController {
  async create(req: Request, res: Response): Promise<void> {
    try {
      const result = compensationService.create(req.body);
      res.status(201).json({
        success: true,
        data: result
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { operatorId, operatorName, ...updateData } = req.body;
      const result = compensationService.update(id, updateData, operatorId, operatorName);
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async approve(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const result = compensationService.approve(id, req.body);
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async withdraw(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { operatorId, operatorName, reason } = req.body;
      const result = compensationService.withdraw(id, operatorId, operatorName, reason);
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async get(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const result = compensationService.get(id);
      if (!result) {
        res.status(404).json({
          success: false,
          error: 'NOT_FOUND',
          message: '补偿记录不存在'
        });
        return;
      }
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async list(req: Request, res: Response): Promise<void> {
    try {
      const params: QueryParams = {
        memberId: req.query.memberId as string,
        memberName: req.query.memberName as string,
        memberPhone: req.query.memberPhone as string,
        status: req.query.status as CompensationStatus,
        expiryBatchId: req.query.expiryBatchId as string,
        page: req.query.page ? parseInt(req.query.page as string) : undefined,
        pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : undefined
      };
      const result = compensationService.list(params);
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async getHistory(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const result = compensationService.getHistory(id);
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async export(req: Request, res: Response): Promise<void> {
    try {
      const params: QueryParams = {
        memberId: req.query.memberId as string,
        memberName: req.query.memberName as string,
        memberPhone: req.query.memberPhone as string,
        status: req.query.status as CompensationStatus,
        expiryBatchId: req.query.expiryBatchId as string
      };
      const data = compensationService.export(params);

      if (req.query.format === 'csv') {
        const csvStringifier = createObjectCsvStringifier({
          header: [
            { id: 'id', title: '记录ID' },
            { id: 'memberId', title: '会员ID' },
            { id: 'memberName', title: '会员姓名' },
            { id: 'memberPhone', title: '会员手机号' },
            { id: 'expiryBatchNo', title: '过期批次' },
            { id: 'expiryPoints', title: '过期积分' },
            { id: 'compensationPoints', title: '补偿积分' },
            { id: 'reason', title: '补偿理由' },
            { id: 'applicantName', title: '申请人' },
            { id: 'approverName', title: '审批人' },
            { id: 'status', title: '状态' },
            { id: 'isConsumed', title: '是否消费' },
            { id: 'appliedAt', title: '申请时间' },
            { id: 'approvedAt', title: '审批时间' }
          ]
        });

        const csv = csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(data);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="compensation_records.csv"');
        res.send('\uFEFF' + csv);
      } else {
        res.json({
          success: true,
          data
        });
      }
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async markConsumed(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { operatorId, operatorName } = req.body;
      const result = compensationService.markConsumed(id, operatorId, operatorName);
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  private handleError(error: unknown, res: Response): void {
    if (error instanceof BusinessError) {
      res.status(400).json({
        success: false,
        error: error.code,
        message: error.message
      });
    } else {
      console.error('Server error:', error);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: '服务器内部错误'
      });
    }
  }
}

export const compensationController = new CompensationController();
