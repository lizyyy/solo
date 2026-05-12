import { Request, Response } from 'express';
import { maintenanceService } from '../services';

class MaintenanceController {
  async createMaintenance(req: Request, res: Response) {
    try {
      const result = await maintenanceService.createMaintenance(req.body);
      res.status(201).json({
        success: true,
        data: {
          maintenance: result.maintenance,
          ticket: result.ticket,
        },
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : '创建维修记录失败',
      });
    }
  }

  async updateMaintenance(req: Request, res: Response) {
    try {
      const result = await maintenanceService.updateMaintenance({
        maintenanceId: req.params.id,
        ...req.body,
      });
      res.json({
        success: true,
        data: {
          maintenance: result.maintenance,
          ticket: result.ticket,
        },
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : '更新维修记录失败',
      });
    }
  }

  async getMaintenanceByTicket(req: Request, res: Response) {
    try {
      const maintenances = await maintenanceService.getMaintenanceByTicket(req.params.ticketId);
      res.json({
        success: true,
        data: { maintenances },
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : '查询维修记录失败',
      });
    }
  }
}

export default new MaintenanceController();
