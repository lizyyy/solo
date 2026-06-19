import type { PickingRoute, RouteOptimizationResult, GapReviewRequest, GapReviewResponse, GapReviewInfo, GapRecord, GapBasicInfo } from '../../shared/types';
import { routeRepository } from '../repositories/RouteRepository';
import { gapRecordRepository } from '../repositories/GapRecordRepository';

export class RouteService {
  getAllRoutes(excludeDeleted: boolean = true): PickingRoute[] {
    return routeRepository.findAll(excludeDeleted);
  }

  getRouteById(id: string): PickingRoute | null {
    return routeRepository.findById(id);
  }

  getRoutesByBatch(batchId: string): PickingRoute[] {
    return routeRepository.findByBatch(batchId);
  }

  deleteRoute(id: string, operator: string): PickingRoute | null {
    const result = routeRepository.logicalDelete(id, operator);
    if (result) {
      this.detectAndCreateGapRecords(operator);
    }
    return result;
  }

  supplementRoute(routeData: Partial<RouteOptimizationResult>, operator: string): PickingRoute {
    const maxLineNo = routeRepository.findMaxCurrentLineNo();
    const fullRouteData: RouteOptimizationResult = {
      orderNo: routeData.orderNo || `ORD-${String(maxLineNo + 1).padStart(4, '0')}`,
      sku: routeData.sku || `SKU-${String(maxLineNo + 1).padStart(6, '0')}`,
      quantity: routeData.quantity || 1,
      warehouseZone: routeData.warehouseZone || 'A区',
      pickingSequence: maxLineNo + 1,
      distance: routeData.distance || 100,
      estimatedTime: routeData.estimatedTime || 10,
    };
    return routeRepository.supplement(fullRouteData, operator);
  }

  recalculateRoutes(operator: string): { updated: number; message: string } {
    const routes = routeRepository.findAll();
    const weights = this.getWeights();

    let updatedCount = 0;
    for (const route of routes) {
      if (route.status === 'supplement_pending_recalc') {
        const newDistance = Math.max(50, route.routeData.distance + Math.floor(Math.random() * 50 - 25));
        const newTime = Math.max(5, route.routeData.estimatedTime + Math.floor(Math.random() * 10 - 5));
        const newPickingSequence = this.calculatePickingSequence(route.routeData, weights);

        const newRouteData: RouteOptimizationResult = {
          ...route.routeData,
          distance: newDistance,
          estimatedTime: newTime,
          pickingSequence: newPickingSequence,
        };

        routeRepository.recalculate(route.id, newRouteData, operator);
        updatedCount++;
      }
    }

    this.detectAndCreateGapRecords(operator);

    return {
      updated: updatedCount,
      message: updatedCount > 0
        ? `已重算${updatedCount}条补录记录。${this.countOpenGaps() > 0 ? `当前仍有${this.countOpenGaps()}处编号断档待教研组复核。` : ''}`
        : '没有需要重算的补录记录。',
    };
  }

  detectAndCreateGapRecords(operator: string): {
    gapCount: number;
    openGapCount: number;
    gaps: GapBasicInfo[];
  } {
    const result = routeRepository.detectAndCreateGapRecords(operator);
    const openGapCount = gapRecordRepository.countOpenGaps();
    return {
      gapCount: result.gapCount,
      openGapCount,
      gaps: result.gaps,
    };
  }

  countOpenGaps(): number {
    return gapRecordRepository.countOpenGaps();
  }

  getOpenGaps(): GapRecord[] {
    return gapRecordRepository.findOpenGaps();
  }

  getAllGaps(status?: 'open' | 'reviewed' | 'all'): GapRecord[] {
    return gapRecordRepository.findAll(status);
  }

  reviewGap(request: GapReviewRequest): GapReviewResponse {
    const { gapId, reviewedBy, resolutionType, resolutionRemark, nextHandler } = request;

    const gapRecord = gapRecordRepository.findById(gapId);
    if (!gapRecord) {
      return { success: false, message: '断档记录不存在' };
    }
    if (gapRecord.status === 'reviewed') {
      return { success: false, message: '该断档已完成复核，无需重复操作' };
    }

    const routes = routeRepository.findAll(false);
    const beforeRoute = gapRecord.beforeRouteId ? routes.find(r => r.id === gapRecord.beforeRouteId) : null;
    const afterRoute = gapRecord.afterRouteId ? routes.find(r => r.id === gapRecord.afterRouteId) : null;

    const reviewInfo: GapReviewInfo = {
      reviewedBy,
      reviewedAt: new Date().toISOString(),
      originalGap: {
        beforeLineNo: gapRecord.beforeLineNo,
        afterLineNo: gapRecord.afterLineNo,
        missingCount: gapRecord.missingCount,
      },
      resolutionType,
      resolutionRemark,
      nextHandler: nextHandler || null,
      beforeFixValues: beforeRoute ? {
        id: beforeRoute.id,
        currentLineNo: beforeRoute.currentLineNo,
        orderNo: beforeRoute.routeData.orderNo,
        status: beforeRoute.status,
      } : null,
      afterFixValues: afterRoute ? {
        id: afterRoute.id,
        currentLineNo: afterRoute.currentLineNo,
        orderNo: afterRoute.routeData.orderNo,
        status: afterRoute.status,
      } : null,
    };

    gapRecordRepository.reviewGap(gapId, reviewInfo);

    const affectedRoutes: PickingRoute[] = [];
    if (beforeRoute) {
      const updated = routeRepository.updateGapReviewInfo(beforeRoute.id, reviewInfo, reviewedBy);
      if (updated) affectedRoutes.push(updated);
    }
    if (afterRoute && afterRoute.id !== beforeRoute?.id) {
      const updated = routeRepository.updateGapReviewInfo(afterRoute.id, reviewInfo, reviewedBy);
      if (updated) affectedRoutes.push(updated);
    }

    const reviewedGap = gapRecordRepository.findById(gapId);

    return {
      success: true,
      gapRecord: reviewedGap || undefined,
      affectedRoutes,
      message: `断档复核完成。处理方式：${resolutionRemark}。下一步责任人：${nextHandler || '无'}`,
    };
  }

  getRouteChanges(routeId: string) {
    const route = routeRepository.findById(routeId);
    if (!route) return [];
    return route.changeLog;
  }

  exportRoutes(): { data: PickingRoute[]; count: number; openGapCount: number; openGaps: GapRecord[] } {
    const data = routeRepository.findAll();
    const openGaps = this.getOpenGaps();
    return {
      data,
      count: data.length,
      openGapCount: openGaps.length,
      openGaps,
    };
  }

  getCount(): number {
    return routeRepository.count();
  }

  getSupplementPendingRecalcCount(): number {
    return routeRepository.countSupplementPendingRecalc();
  }

  private calculatePickingSequence(routeData: RouteOptimizationResult, weights: any[]): number {
    let score = 0;
    for (const w of weights) {
      switch (w.dimension) {
        case '拣货距离':
          score += (1000 - routeData.distance) * (w.weight / 100);
          break;
        case '拣货时间':
          score += (60 - routeData.estimatedTime) * (w.weight / 100);
          break;
        case '货区集中度':
          score += routeData.warehouseZone === 'A区' ? 50 * (w.weight / 100) : 0;
          break;
      }
    }
    return Math.floor(score);
  }

  private getWeights() {
    return [
      { dimension: '拣货距离', weight: 40 },
      { dimension: '拣货时间', weight: 30 },
      { dimension: '订单优先级', weight: 20 },
      { dimension: '货区集中度', weight: 10 },
    ];
  }
}

export const routeService = new RouteService();
