import { Request, Response } from 'express';
import type { SupplementRouteRequest, RecalculateRequest } from '../../shared/types';
import { routeService } from '../services/RouteService';

export class RouteController {
  async getRoutes(req: Request, res: Response) {
    try {
      const includeDeleted = req.query.includeDeleted === 'true';
      const routes = routeService.getAllRoutes(!includeDeleted);
      return res.json(routes);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  async getRouteById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const route = routeService.getRouteById(id);
      if (!route) {
        return res.status(404).json({ error: '记录不存在' });
      }
      return res.json(route);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  async deleteRoute(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { operator } = req.body as { operator?: string };
      const result = routeService.deleteRoute(id, operator || '吴老师');
      if (!result) {
        return res.status(404).json({ error: '记录不存在' });
      }
      return res.json(result);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  async supplementRoute(req: Request, res: Response) {
    try {
      const { routeData, operator } = req.body as SupplementRouteRequest;
      const result = routeService.supplementRoute(routeData, operator || '吴老师');
      return res.json(result);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  async recalculate(req: Request, res: Response) {
    try {
      const { operator } = req.body as RecalculateRequest;
      const result = routeService.recalculateRoutes(operator || '吴老师');
      return res.json(result);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  async detectGaps(req: Request, res: Response) {
    try {
      const operator = (req.body as any)?.operator || '吴老师';
      const result = routeService.detectAndMarkGaps(operator);
      return res.json(result);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  async getRouteChanges(req: Request, res: Response) {
    try {
      const { routeId } = req.params;
      const changes = routeService.getRouteChanges(routeId);
      return res.json(changes);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  async exportRoutes(req: Request, res: Response) {
    try {
      const result = routeService.exportRoutes();

      const csvHeader = [
        '当前编号',
        '原始行号',
        '订单号',
        'SKU',
        '数量',
        '货区',
        '拣货顺序',
        '距离(米)',
        '预计时间(分钟)',
        '状态',
        '导入批次',
        '操作人',
        '创建时间',
        '更新时间',
      ].join(',');

      const csvRows = result.data.map(route => [
        route.currentLineNo,
        route.originalLineNo === -1 ? '补录' : route.originalLineNo,
        route.routeData.orderNo,
        route.routeData.sku,
        route.routeData.quantity,
        route.routeData.warehouseZone,
        route.routeData.pickingSequence,
        route.routeData.distance,
        route.routeData.estimatedTime,
        route.statusLabel,
        route.sourceBatch,
        route.operator,
        route.createdAt,
        route.updatedAt,
      ].join(','));

      const csvContent = [csvHeader, ...csvRows].join('\n');

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="picking-routes-${Date.now()}.csv"`);
      res.setHeader('X-Export-Count', String(result.count));
      return res.send('\uFEFF' + csvContent);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }
}

export const routeController = new RouteController();
