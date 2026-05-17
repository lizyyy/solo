import { Request, Response } from 'express';
import sqlite3 from 'sqlite3';
import { ShiftSwapService } from '../services/ShiftSwapService';
import { AppError, ValidationError, NotFoundError } from '../errors/AppError';
import { ShiftSwapStatus, SwapReason, ApiResponse } from '../types';

export class ShiftSwapController {
  private service: ShiftSwapService;

  constructor(db: sqlite3.Database) {
    this.service = new ShiftSwapService(db);
  }

  createSwap = async (req: Request, res: Response) => {
    try {
      const { originalShiftId, originalDriverId, newDriverId, swapReason, reasonDetail } = req.body;
      const requestedBy = req.headers['x-user-id'] as string || 'anonymous';

      if (!Object.values(SwapReason).includes(swapReason)) {
        throw new ValidationError(
          '无效的换班原因',
          { invalidReason: swapReason },
          `请使用以下原因之一: ${Object.values(SwapReason).join(', ')}`
        );
      }

      const { swap, validation } = await this.service.createSwap({
        originalShiftId,
        originalDriverId,
        newDriverId,
        swapReason,
        reasonDetail,
        requestedBy
      });

      if (!validation.isValid) {
        throw new ValidationError(
          '换班申请验证失败',
          { errors: validation.errors, warnings: validation.warnings },
          '请检查提交的数据并重试'
        );
      }

      const response: ApiResponse<typeof swap> = {
        success: true,
        data: swap
      };

      res.status(201).json(response);
    } catch (error) {
      this.handleError(error, res);
    }
  };

  confirmSwap = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { changeReason } = req.body;
      const confirmedBy = req.headers['x-user-id'] as string || 'anonymous';

      const { swap, validation } = await this.service.confirmSwap(id, confirmedBy, changeReason);

      if (!validation.isValid) {
        throw new ValidationError(
          '换班确认失败',
          { errors: validation.errors },
          validation.errors[0]?.includes('冲突') 
            ? '请先解决时间冲突后再确认' 
            : '请检查换班状态并重试'
        );
      }

      const response: ApiResponse<typeof swap> = {
        success: true,
        data: swap
      };

      res.json(response);
    } catch (error) {
      this.handleError(error, res);
    }
  };

  completeSwap = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const completedBy = req.headers['x-user-id'] as string || 'anonymous';

      const { swap, validation } = await this.service.completeSwap(id, completedBy);

      if (!validation.isValid) {
        throw new ValidationError(
          '标记完成失败',
          { errors: validation.errors },
          '只有已换班状态的记录才能标记为完成'
        );
      }

      const response: ApiResponse<typeof swap> = {
        success: true,
        data: swap
      };

      res.json(response);
    } catch (error) {
      this.handleError(error, res);
    }
  };

  getSwapById = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const details = await this.service.getSwapWithDetails(id);

      if (!details.swap) {
        throw new NotFoundError(
          '换班记录不存在',
          { swapId: id },
          '请检查换班ID是否正确'
        );
      }

      const response: ApiResponse<typeof details> = {
        success: true,
        data: details
      };

      res.json(response);
    } catch (error) {
      this.handleError(error, res);
    }
  };

  getSwapList = async (req: Request, res: Response) => {
    try {
      const { status, originalDriverId, newDriverId, startDate, endDate } = req.query;

      const filters = {
        status: status as ShiftSwapStatus,
        originalDriverId: originalDriverId as string,
        newDriverId: newDriverId as string,
        startDate: startDate as string,
        endDate: endDate as string
      };

      const swaps = await this.service.getSwapList(filters);

      const response: ApiResponse<typeof swaps> = {
        success: true,
        data: swaps
      };

      res.json(response);
    } catch (error) {
      this.handleError(error, res);
    }
  };

  getSwapHistory = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const history = await this.service.getSwapHistory(id);

      const response: ApiResponse<typeof history> = {
        success: true,
        data: history
      };

      res.json(response);
    } catch (error) {
      this.handleError(error, res);
    }
  };

  validateImport = async (req: Request, res: Response) => {
    try {
      const { rows } = req.body;

      if (!Array.isArray(rows)) {
        throw new ValidationError(
          '数据格式错误',
          { received: typeof rows },
          '请传入数组格式的行数据'
        );
      }

      const validationResults = await Promise.all(
        rows.map((row, index) => this.service.validateRowData(row, index + 1))
      );

      const validCount = validationResults.filter(r => r.isValid).length;
      const invalidCount = validationResults.filter(r => !r.isValid).length;

      const response: ApiResponse<{ results: typeof validationResults; summary: { valid: number; invalid: number } }> = {
        success: true,
        data: {
          results: validationResults,
          summary: { valid: validCount, invalid: invalidCount }
        }
      };

      res.json(response);
    } catch (error) {
      this.handleError(error, res);
    }
  };

  exportSwaps = async (req: Request, res: Response) => {
    try {
      const { status, startDate, endDate, format = 'json' } = req.query;

      const data = await this.service.exportSwaps({
        status: status as ShiftSwapStatus,
        startDate: startDate as string,
        endDate: endDate as string
      });

      if (format === 'csv') {
        const headers = Object.keys(data[0] || {}).join(',');
        const rows = data.map(row => Object.values(row).map(v => `"${v}"`).join(','));
        const csv = [headers, ...rows].join('\n');
        
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="shift_swaps.csv"');
        res.send(csv);
      } else {
        const response: ApiResponse<typeof data> = {
          success: true,
          data: data
        };
        res.json(response);
      }
    } catch (error) {
      this.handleError(error, res);
    }
  };

  private handleError(error: unknown, res: Response) {
    if (error instanceof AppError) {
      const response: ApiResponse<never> = {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
          nextAction: error.nextAction
        }
      };
      res.status(error.statusCode).json(response);
    } else {
      const response: ApiResponse<never> = {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '服务器内部错误',
          nextAction: '请稍后重试或联系技术支持'
        }
      };
      res.status(500).json(response);
    }
  }
}
