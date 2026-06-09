import type { SelfCheckResult } from '../../shared/types';
import { importRepository } from '../repositories/ImportRepository';
import { routeRepository } from '../repositories/RouteRepository';
import { routeService } from './RouteService';
import { gapRecordRepository } from '../repositories/GapRecordRepository';

export class SelfCheckService {
  runSelfCheck(): SelfCheckResult {
    return {
      duplicateImport: this.checkDuplicateImport(),
      numberGap: this.checkNumberGap(),
      supplementRecalc: this.checkSupplementRecalc(),
      exportConsistency: this.checkExportConsistency(),
    };
  }

  private checkDuplicateImport(): SelfCheckResult['duplicateImport'] {
    const batches = importRepository.findAll();
    const duplicates: { batchId: string; time: string; operator: string; fileName: string }[] = [];

    const hashMap = new Map<string, typeof batches[0][]>();
    for (const batch of batches) {
      const key = batch.fileHash + '|' + batch.contentFingerprint;
      if (!hashMap.has(key)) {
        hashMap.set(key, []);
      }
      hashMap.get(key)!.push(batch);
    }

    for (const [, batchGroup] of hashMap) {
      if (batchGroup.length > 1) {
        for (const batch of batchGroup) {
          duplicates.push({
            batchId: batch.id,
            time: batch.createdAt,
            operator: batch.operator,
            fileName: batch.fileName,
          });
        }
      }
    }

    return {
      passed: duplicates.length === 0 || duplicates.every(d => {
        const batch = batches.find(b => b.id === d.batchId);
        return batch?.isForceReimport;
      }),
      details: {
        totalBatches: batches.length,
        duplicateCount: duplicates.length,
        duplicates,
      },
    };
  }

  private checkNumberGap(): SelfCheckResult['numberGap'] {
    const allGaps = gapRecordRepository.findAll('all');
    const openGaps = allGaps.filter(g => g.status === 'open');
    const reviewedGaps = allGaps.filter(g => g.status === 'reviewed');

    const gapsDetail = allGaps.map(g => ({
      gapId: g.id,
      beforeLineNo: g.beforeLineNo,
      afterLineNo: g.afterLineNo,
      missingCount: g.missingCount,
      status: g.status === 'open' ? '待教研组复核' : '已复核',
    }));

    return {
      passed: openGaps.length === 0,
      details: {
        gapCount: allGaps.length,
        openGapCount: openGaps.length,
        reviewedGapCount: reviewedGaps.length,
        gaps: gapsDetail,
      } as any,
    };
  }

  private checkSupplementRecalc(): SelfCheckResult['supplementRecalc'] {
    const routes = routeRepository.findAll(false);
    const supplementItems = routes.filter(r => r.originalLineNo === -1);
    const pendingItems = supplementItems.filter(r => r.status === 'supplement_pending_recalc');

    return {
      passed: pendingItems.length === 0,
      details: {
        supplementCount: supplementItems.length,
        pendingRecalcCount: pendingItems.length,
        items: pendingItems.map(r => ({
          id: r.id,
          originalLineNo: r.originalLineNo,
          status: r.statusLabel,
          orderNo: r.routeData.orderNo,
          sku: r.routeData.sku,
        })),
      },
    };
  }

  private checkExportConsistency(): SelfCheckResult['exportConsistency'] {
    const apiResult = routeService.getAllRoutes();
    const apiCount = apiResult.length;
    const exportResult = routeService.exportRoutes();
    const pageCount = routeService.getCount();

    const routes = routeRepository.findAll();
    const dbCount = routes.length;

    const isConsistent = pageCount === exportResult.count
      && exportResult.count === apiCount
      && apiCount === dbCount;

    return {
      passed: isConsistent,
      details: {
        pageCount,
        exportCount: exportResult.count,
        apiCount,
        dbCount,
        isConsistent,
      },
    };
  }
}

export const selfCheckService = new SelfCheckService();
