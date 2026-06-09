import { Request, Response } from 'express';
import type { SupplementRouteRequest, RecalculateRequest, GapReviewRequest } from '../../shared/types';
import { routeService } from '../services/RouteService';

export class RouteController {
  async getRoutes(req: Request, res: Response) {
    try {
      const includeDeleted = req.query.includeDeleted === 'true';
      const routes = routeService.getAllRoutes(!includeDeleted);
      const openGaps = routeService.getOpenGaps();
      return res.json({
        routes,
        openGaps,
        openGapCount: openGaps.length,
      });
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
      return res.json({
        route: result,
        openGaps: routeService.getOpenGaps(),
        openGapCount: routeService.countOpenGaps(),
      });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  async supplementRoute(req: Request, res: Response) {
    try {
      const { routeData, operator } = req.body as SupplementRouteRequest;
      const result = routeService.supplementRoute(routeData, operator || '吴老师');
      return res.json({
        route: result,
        openGaps: routeService.getOpenGaps(),
        openGapCount: routeService.countOpenGaps(),
      });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  async recalculate(req: Request, res: Response) {
    try {
      const { operator } = req.body as RecalculateRequest;
      const result = routeService.recalculateRoutes(operator || '吴老师');
      return res.json({
        ...result,
        routes: routeService.getAllRoutes(),
        openGaps: routeService.getOpenGaps(),
        openGapCount: routeService.countOpenGaps(),
      });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  async detectGaps(req: Request, res: Response) {
    try {
      const operator = (req.body as any)?.operator || '吴老师';
      const result = routeService.detectAndCreateGapRecords(operator);
      return res.json(result);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  async getOpenGaps(req: Request, res: Response) {
    try {
      const gaps = routeService.getOpenGaps();
      return res.json({
        gaps,
        count: gaps.length,
      });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  async getAllGaps(req: Request, res: Response) {
    try {
      const status = (req.query.status as 'open' | 'reviewed' | 'all') || 'all';
      const gaps = routeService.getAllGaps(status);
      return res.json({
        gaps,
        count: gaps.length,
      });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  async reviewGap(req: Request, res: Response) {
    try {
      const body = req.body as GapReviewRequest;
      if (!body.gapId || !body.reviewedBy || !body.resolutionType || !body.resolutionRemark) {
        return res.status(400).json({
          success: false,
          message: '缺少必要参数：gapId、reviewedBy、resolutionType、resolutionRemark',
        });
      }
      const result = routeService.reviewGap(body);
      if (!result.success) {
        return res.status(400).json(result);
      }
      return res.json({
        ...result,
        openGaps: routeService.getOpenGaps(),
        openGapCount: routeService.countOpenGaps(),
      });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message, message: e.message });
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
        '断档复核说明',
      ].join(',');

      const csvRows = result.data.map(route => {
        const gapInfo = route.gapReviewInfo
          ? `断档(${route.gapReviewInfo.originalGap.beforeLineNo}→${route.gapReviewInfo.originalGap.afterLineNo},缺${route.gapReviewInfo.originalGap.missingCount})-${route.gapReviewInfo.resolutionRemark}-复核人:${route.gapReviewInfo.reviewedBy}`
          : '';
        return [
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
          gapInfo,
        ].join(',');
      });

      const gapSummaryRows = result.openGaps.length > 0 ? [
        '',
        '--- 编号断档待复核汇总（未完成复核，影响版本发布）---',
        `断档ID,前编号,后编号,缺失条数,检测时间`,
        ...result.openGaps.map(g => `${g.id},${g.beforeLineNo},${g.afterLineNo},${g.missingCount},${g.detectedAt}`),
      ] : [];

      const csvContent = [csvHeader, ...csvRows, ...gapSummaryRows].join('\n');

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="picking-routes-${Date.now()}.csv"`);
      res.setHeader('X-Export-Count', String(result.count));
      res.setHeader('X-Export-Open-Gap-Count', String(result.openGapCount));
      return res.send('\uFEFF' + csvContent);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }
}

export const routeController = new RouteController();
