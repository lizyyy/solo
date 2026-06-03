import type { SelfCheckResult } from '../../shared/types';
import { importRepository } from '../repositories/ImportRepository';
import { routeRepository } from '../repositories/RouteRepository';
import { routeService } from './RouteService';

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
    const routes = routeRepository.findAll();
    routes.sort((a, b) => a.currentLineNo - b.currentLineNo);

    const gaps: { beforeLineNo: number; afterLineNo: number; missingCount: number }[] = [];

    for (let i = 0; i < routes.length - 1; i++) {
      const current = routes[i];
      const next = routes[i + 1];
      const expectedNext = current.currentLineNo + 1;

      if (next.currentLineNo > expectedNext) {
        gaps.push({
          beforeLineNo: current.currentLineNo,
          afterLineNo: next.currentLineNo,
          missingCount: next.currentLineNo - expectedNext,
        });
      }
    }

    const hasPendingGap = routes.some(r => r.status === 'gap_pending_review');

    return {
      passed: gaps.length === 0 && !hasPendingGap,
      details: {
        gapCount: gaps.length,
        gaps,
      },
    };
  }

  private checkSupplementRecalc(): SelfCheckResult['supplementRecalc'] {
    const routes = routeRepository.findAll(false);
    const supplementItems = routes.filter(r =>
      r.status === 'supplement_pending_recalc' || r.sourceBatch === 'supplement'
    );
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
        })),
      },
    };
  }

  private checkExportConsistency(): SelfCheckResult['exportConsistency'] {
    const pageCount = routeService.getCount();
    const exportResult = routeService.exportRoutes();
    const apiCount = routeRepository.findAll().length;

    const isConsistent = pageCount === exportResult.count && exportResult.count === apiCount;

    return {
      passed: isConsistent,
      details: {
        pageCount,
        exportCount: exportResult.count,
        apiCount,
        isConsistent,
      },
    };
  }
}

export const selfCheckService = new SelfCheckService();
