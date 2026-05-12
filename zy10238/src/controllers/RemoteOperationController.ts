import { Request, Response } from 'express';
import { remoteOperationService } from '../services';
import { OperationStatus } from '../models';

class RemoteOperationController {
  async createOperation(req: Request, res: Response) {
    try {
      const operation = await remoteOperationService.createOperation(req.body);
      res.status(201).json({
        success: true,
        data: { operation },
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : '创建远程操作失败',
      });
    }
  }

  async updateOperation(req: Request, res: Response) {
    try {
      const operation = await remoteOperationService.updateOperation({
        operationId: req.params.id,
        ...req.body,
      });
      res.json({
        success: true,
        data: { operation },
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : '更新远程操作失败',
      });
    }
  }

  async getOperationsByTicket(req: Request, res: Response) {
    try {
      const operations = await remoteOperationService.getOperationsByTicket(req.params.ticketId);
      res.json({
        success: true,
        data: { operations },
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : '查询远程操作失败',
      });
    }
  }
}

export default new RemoteOperationController();
