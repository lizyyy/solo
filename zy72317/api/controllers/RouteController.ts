import { Request, Response } from 'express';
import type { SupplementRouteRequest, RecalculateRequest, GapReviewRequest } from '../../shared/types';
import { GAP_RESOLUTION_LABELS } from '../../shared/types';
import { routeService } from '../services/RouteService';

function csvEscape(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

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
      const allGaps = routeService.getAllGaps();

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
        '当前处理状态',
        '问题来源/原始问题',
        '补录后处理判断',
        '处理方式',
        '处理原因/复核说明',
        '复核人',
        '责任人(下一步找谁)',
        '变更前值',
        '变更后值',
        '复核时间',
        '导入批次',
        '操作人',
        '创建时间',
        '更新时间',
      ].map(csvEscape).join(',');

      const csvRows = result.data.map(route => {
        const isSupplement = route.originalLineNo === -1;
        const g = route.gapReviewInfo;

        const issueSource = g
          ? `编号断档：${g.originalGap.beforeLineNo} → ${g.originalGap.afterLineNo}（缺失${g.originalGap.missingCount}条，检测时间：${g.reviewedAt.split('T')[0]}）`
          : isSupplement
            ? '人工补录（补录时 originalLineNo 固定为 -1，当前编号为插入时最大+1）'
            : route.status === 'deleted'
              ? `人工逻辑删除（删除前编号${(route.changeLog.find(c => c.action === 'delete')?.beforeValue as any)?.currentLineNo ?? 'N/A'}）`
              : '无';

        const supplementJudgement = isSupplement
          ? route.status === 'supplement_pending_recalc'
            ? '已补录，等待参数版本发布前执行「补录后重算」重新赋值距离/时间'
            : '已重算，距离和时间已依据最新权重重新计算；若后续涉及断档请单独处理编号'
          : '';

        const handling = g ? GAP_RESOLUTION_LABELS[g.resolutionType] ?? '' : '';
        const reason = g ? g.resolutionRemark : (isSupplement ? '人工删除后补录缺失订单行' : '');
        const reviewer = g ? g.reviewedBy : '';
        const nextHandler = g ? (g.nextHandler ?? '') : '';
        const beforeFix = g && g.beforeFixValues ? JSON.stringify(g.beforeFixValues) : '';
        const afterFix = g && g.afterFixValues ? JSON.stringify(g.afterFixValues) : '';
        const reviewAt = g ? g.reviewedAt : '';

        return [
          route.currentLineNo,
          isSupplement ? '补录' : route.originalLineNo,
          route.routeData.orderNo,
          route.routeData.sku,
          route.routeData.quantity,
          route.routeData.warehouseZone,
          route.routeData.pickingSequence,
          route.routeData.distance,
          route.routeData.estimatedTime,
          route.statusLabel,
          issueSource,
          supplementJudgement,
          handling,
          reason,
          reviewer,
          nextHandler,
          beforeFix,
          afterFix,
          reviewAt,
          route.sourceBatch,
          route.operator,
          route.createdAt,
          route.updatedAt,
        ].map(csvEscape).join(',');
      });

      const reviewGaps = allGaps.filter(x => x.status === 'reviewed');
      const openGaps = result.openGaps;

      const gapSummaryRows: string[] = [];
      if (openGaps.length > 0 || reviewGaps.length > 0) {
        gapSummaryRows.push('');
        gapSummaryRows.push('--- 编号断档处理汇总（教研组交接用）---');
        gapSummaryRows.push([
          '断档ID',
          '前编号',
          '后编号',
          '缺失条数',
          '状态',
          '检测时间',
          '处理方式',
          '复核说明',
          '复核人',
          '复核时间',
          '责任人(下一步找谁)',
          '变更前值',
          '变更后值',
        ].map(csvEscape).join(','));
        for (const g of [...openGaps, ...reviewGaps]) {
          const r = g.reviewInfo;
          gapSummaryRows.push([
            g.id,
            g.beforeLineNo,
            g.afterLineNo,
            g.missingCount,
            g.status === 'open' ? '待教研组复核' : '已复核',
            g.detectedAt,
            r ? (GAP_RESOLUTION_LABELS[r.resolutionType] ?? '') : '',
            r ? r.resolutionRemark : '',
            r ? r.reviewedBy : '',
            r ? r.reviewedAt : '',
            r ? (r.nextHandler ?? '') : '',
            r && r.beforeFixValues ? JSON.stringify(r.beforeFixValues) : '',
            r && r.afterFixValues ? JSON.stringify(r.afterFixValues) : '',
          ].map(csvEscape).join(','));
        }
      }

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
