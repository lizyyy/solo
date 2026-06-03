import type { PickingRoute, RouteOptimizationResult, RouteStatus } from '../../shared/types';
import { routeRepository } from '../repositories/RouteRepository';

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
      this.detectAndMarkGaps(operator);
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
      if (route.status === 'supplement_pending_recalc' || route.status === 'gap_pending_review') {
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

    return {
      updated: updatedCount,
      message: `已重算${updatedCount}条记录`,
    };
  }

  detectAndMarkGaps(operator: string): { gapCount: number; gaps: any[] } {
    const routes = routeRepository.findAll(false);
    const activeRoutes = routes.filter(r => r.status !== 'deleted');
    activeRoutes.sort((a, b) => a.currentLineNo - b.currentLineNo);

    const gaps: { beforeLineNo: number; afterLineNo: number; missingCount: number; affectedIds: string[] }[] = [];
    const affectedRouteIds: string[] = [];

    for (let i = 0; i < activeRoutes.length - 1; i++) {
      const current = activeRoutes[i];
      const next = activeRoutes[i + 1];
      const expectedNext = current.currentLineNo + 1;

      if (next.currentLineNo > expectedNext) {
        const missingCount = next.currentLineNo - expectedNext;
        gaps.push({
          beforeLineNo: current.currentLineNo,
          afterLineNo: next.currentLineNo,
          missingCount,
          affectedIds: [current.id, next.id],
        });
        if (!affectedRouteIds.includes(current.id)) affectedRouteIds.push(current.id);
        if (!affectedRouteIds.includes(next.id)) affectedRouteIds.push(next.id);
      }
    }

    const allRoutes = routeRepository.findAll(false);
    const previouslyGapped = allRoutes.filter(r => r.status === 'gap_pending_review');

    for (const route of previouslyGapped) {
      if (!affectedRouteIds.includes(route.id)) {
        routeRepository.updateStatus(route.id, 'normal', operator, '断档已解决，恢复正常状态');
      }
    }

    if (affectedRouteIds.length > 0) {
      routeRepository.updateStatusForMultiple(
        affectedRouteIds,
        'gap_pending_review',
        operator,
        `检测到编号断档，共${gaps.length}处，待教研组复核`
      );
    }

    return {
      gapCount: gaps.length,
      gaps,
    };
  }

  getRouteChanges(routeId: string) {
    const route = routeRepository.findById(routeId);
    if (!route) return [];
    return route.changeLog;
  }

  exportRoutes(): { data: PickingRoute[]; count: number } {
    const data = routeRepository.findAll();
    return { data, count: data.length };
  }

  getCount(): number {
    return routeRepository.count();
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
