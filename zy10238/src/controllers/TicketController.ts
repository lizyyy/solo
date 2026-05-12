import { Request, Response } from 'express';
import { ticketService } from '../services';
import { TicketStatus, FailureReason } from '../models';

class TicketController {
  async createTicket(req: Request, res: Response) {
    try {
      const result = await ticketService.createTicket(req.body);
      res.status(result.isDuplicate ? 200 : 201).json({
        success: true,
        data: {
          ticket: result.ticket,
          isDuplicate: result.isDuplicate,
          suggestion: result.suggestion,
          message: result.isDuplicate ? '该故障已存在工单，系统已合并处理' : '新建工单成功',
        },
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : '创建工单失败',
      });
    }
  }

  async getTicket(req: Request, res: Response) {
    try {
      const result = await ticketService.getTicketWithHistory(req.params.id);
      if (!result) {
        return res.status(404).json({
          success: false,
          error: '工单不存在',
        });
      }
      res.json({
        success: true,
        data: {
          ticket: result.ticket,
          histories: result.histories,
          suggestion: result.suggestion,
        },
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : '查询工单失败',
      });
    }
  }

  async getDecisionSuggestion(req: Request, res: Response) {
    try {
      const suggestion = await ticketService.getDecisionSuggestion(req.params.id);
      res.json({
        success: true,
        data: { suggestion },
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : '获取决策建议失败',
      });
    }
  }

  async updateStatus(req: Request, res: Response) {
    try {
      const ticket = await ticketService.updateStatus({
        ticketId: req.params.id,
        ...req.body,
      });
      res.json({
        success: true,
        data: { ticket },
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : '更新工单状态失败',
      });
    }
  }

  async closeTicket(req: Request, res: Response) {
    try {
      const ticket = await ticketService.updateStatus({
        ticketId: req.params.id,
        newStatus: TicketStatus.CLOSED,
        description: req.body.description || '工单已关闭',
        operatorId: req.body.operatorId,
        operatorName: req.body.operatorName,
      });
      res.json({
        success: true,
        data: { ticket },
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : '关闭工单失败',
      });
    }
  }

  async getTicketTimeline(req: Request, res: Response) {
    try {
      const { pileId, startTime, endTime } = req.query;
      const tickets = await ticketService.getTicketTimeline(
        pileId as string,
        new Date(startTime as string),
        new Date(endTime as string)
      );
      res.json({
        success: true,
        data: { tickets },
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : '查询时间线失败',
      });
    }
  }
}

export default new TicketController();
