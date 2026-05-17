import { Request, Response } from 'express';
import { whitelistService, WhitelistValidationError } from '../services/whitelist.service';
import { WhitelistStatus, CreateWhitelistRequest } from '../models/whitelist.model';

export class WhitelistController {
  async create(req: Request, res: Response): Promise<void> {
    try {
      const request: CreateWhitelistRequest = {
        ...req.body,
        effectiveDate: new Date(req.body.effectiveDate),
        expiryDate: new Date(req.body.expiryDate)
      };
      const record = whitelistService.create(request);
      res.status(201).json({
        success: true,
        data: record,
        message: '创建成功'
      });
    } catch (error) {
      if (error instanceof WhitelistValidationError) {
        res.status(400).json({
          success: false,
          message: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          message: '服务器内部错误'
        });
      }
    }
  }

  async findAll(req: Request, res: Response): Promise<void> {
    try {
      const { tenantId, apiGroupId, status } = req.query;
      const filters = {
        tenantId: tenantId as string,
        apiGroupId: apiGroupId as string,
        status: status as WhitelistStatus
      };
      const records = whitelistService.findAll(filters);
      res.json({
        success: true,
        data: records,
        total: records.length
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '服务器内部错误'
      });
    }
  }

  async findById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const record = whitelistService.findById(id);
      if (!record) {
        res.status(404).json({
          success: false,
          message: '记录不存在'
        });
        return;
      }
      res.json({
        success: true,
        data: record
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '服务器内部错误'
      });
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { operator, ...updates } = req.body;
      if (updates.effectiveDate) {
        updates.effectiveDate = new Date(updates.effectiveDate);
      }
      if (updates.expiryDate) {
        updates.expiryDate = new Date(updates.expiryDate);
      }
      const record = whitelistService.update(id, updates, operator);
      res.json({
        success: true,
        data: record,
        message: '更新成功'
      });
    } catch (error) {
      if (error instanceof WhitelistValidationError) {
        res.status(400).json({
          success: false,
          message: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          message: '服务器内部错误'
        });
      }
    }
  }

  async approve(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const record = whitelistService.approve(id, req.body);
      res.json({
        success: true,
        data: record,
        message: '审批通过'
      });
    } catch (error) {
      if (error instanceof WhitelistValidationError) {
        res.status(400).json({
          success: false,
          message: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          message: '服务器内部错误'
        });
      }
    }
  }

  async reject(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { approver, remark } = req.body;
      const record = whitelistService.reject(id, approver, remark);
      res.json({
        success: true,
        data: record,
        message: '已拒绝'
      });
    } catch (error) {
      if (error instanceof WhitelistValidationError) {
        res.status(400).json({
          success: false,
          message: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          message: '服务器内部错误'
        });
      }
    }
  }

  async revoke(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { operator, remark } = req.body;
      const record = whitelistService.revoke(id, operator, remark);
      res.json({
        success: true,
        data: record,
        message: '已撤回'
      });
    } catch (error) {
      if (error instanceof WhitelistValidationError) {
        res.status(400).json({
          success: false,
          message: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          message: '服务器内部错误'
        });
      }
    }
  }

  async resubmit(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { operator } = req.body;
      const record = whitelistService.resubmit(id, operator);
      res.json({
        success: true,
        data: record,
        message: '重新提交成功'
      });
    } catch (error) {
      if (error instanceof WhitelistValidationError) {
        res.status(400).json({
          success: false,
          message: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          message: '服务器内部错误'
        });
      }
    }
  }

  async getHistories(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const histories = whitelistService.getHistories(id);
      res.json({
        success: true,
        data: histories
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '服务器内部错误'
      });
    }
  }

  async checkWhitelist(req: Request, res: Response): Promise<void> {
    try {
      const { tenantId, apiGroupId } = req.query;
      const result = whitelistService.checkWhitelist(
        tenantId as string,
        apiGroupId as string
      );
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '服务器内部错误'
      });
    }
  }

  async bulkImport(req: Request, res: Response): Promise<void> {
    try {
      const data = req.body.map((item: any) => ({
        ...item,
        effectiveDate: new Date(item.effectiveDate),
        expiryDate: new Date(item.expiryDate)
      }));
      const result = whitelistService.bulkImport(data);
      res.json({
        success: true,
        data: {
          success: result.success,
          failed: result.failed,
          successCount: result.success.length,
          failedCount: result.failed.length
        },
        message: `导入完成：成功${result.success.length}条，失败${result.failed.length}条`
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '服务器内部错误'
      });
    }
  }

  async export(req: Request, res: Response): Promise<void> {
    try {
      const records = whitelistService.export();
      res.json({
        success: true,
        data: records,
        total: records.length
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '服务器内部错误'
      });
    }
  }

  async refreshStatuses(req: Request, res: Response): Promise<void> {
    try {
      whitelistService.refreshStatuses();
      res.json({
        success: true,
        message: '状态刷新完成'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '服务器内部错误'
      });
    }
  }
}

export const whitelistController = new WhitelistController();
