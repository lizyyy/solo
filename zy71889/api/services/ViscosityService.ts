import { ViscosityEstimateRepository } from '../repositories/ViscosityEstimateRepository.js';
import { SensorLogRepository } from '../repositories/SensorLogRepository.js';
import { BatchRepository } from '../repositories/BatchRepository.js';
import { ViscosityAlgorithm } from './ViscosityAlgorithm.js';
import type { ViscosityEstimate } from '../../shared/types.js';

export class ViscosityService {
  private estimateRepo = new ViscosityEstimateRepository();
  private sensorLogRepo = new SensorLogRepository();
  private batchRepo = new BatchRepository();

  getEstimateHistory(batchId: string): ViscosityEstimate[] {
    return this.estimateRepo.findByBatchId(batchId);
  }

  runEstimate(batchId: string): ViscosityEstimate {
    const sensorLogs = this.sensorLogRepo.findByBatchId(batchId);
    const result = ViscosityAlgorithm.estimate(sensorLogs);

    const estimate = this.estimateRepo.create({
      batchId,
      timestamp: new Date().toISOString(),
      viscosity: result.viscosity,
      unit: 'mPa·s',
      judgment: result.judgment,
      judgmentReason: result.judgmentReason,
      judgmentSteps: result.judgmentSteps,
      nextSteps: result.nextSteps,
      rawCalculation: result.rawCalculation,
      algorithmVersion: ViscosityAlgorithm.getAlgorithmVersion(),
    });

    let newStatus: 'completed' | 'needs_review' = estimate.judgment === 'pass' ? 'completed' : 'needs_review';
    if (estimate.judgment === 'borderline') {
      newStatus = 'needs_review';
    }
    this.batchRepo.updateStatus(batchId, newStatus);

    return estimate;
  }

  getLatestEstimate(batchId: string): ViscosityEstimate | null {
    const history = this.getEstimateHistory(batchId);
    return history.length > 0 ? history[history.length - 1] : null;
  }
}
