import detailRepository from '../repositories/DetailRepository.js';
import batchRepository from '../repositories/BatchRepository.js';
import fingerprintService from './FingerprintService.js';
import type { SettlementDetail, SettlementBatch, ConsistencyCheckResult } from '../../shared/types.js';

export class SingleSourceService {
  async getDetailsForDisplay(batchId: string): Promise<SettlementDetail[]> {
    return detailRepository.findByBatchId(batchId);
  }

  async getDetailsForApi(batchId: string): Promise<SettlementDetail[]> {
    return detailRepository.findByBatchId(batchId);
  }

  async getDetailsForExport(batchId: string): Promise<SettlementDetail[]> {
    return detailRepository.findByBatchId(batchId);
  }

  async getBatchWithDetails(batchId: string): Promise<(SettlementBatch & { details: SettlementDetail[] }) | null> {
    const batch = batchRepository.findById(batchId);
    if (!batch) return null;
    const details = await this.getDetailsForDisplay(batchId);
    return { ...batch, details };
  }

  async checkConsistency(batchId: string): Promise<ConsistencyCheckResult> {
    const displayDetails = await this.getDetailsForDisplay(batchId);
    const apiDetails = await this.getDetailsForApi(batchId);
    const exportDetails = await this.getDetailsForExport(batchId);

    const pageFingerprint = fingerprintService.generateDetailsFingerprint(displayDetails);
    const apiFingerprint = fingerprintService.generateDetailsFingerprint(apiDetails);
    const exportFingerprint = fingerprintService.generateDetailsFingerprint(exportDetails);

    const consistent = pageFingerprint === apiFingerprint && apiFingerprint === exportFingerprint;

    return {
      consistent,
      pageFingerprint,
      apiFingerprint,
      exportFingerprint
    };
  }

  async getDetailWithAudit(detailId: string): Promise<any> {
    const detail = detailRepository.findById(detailId);
    return detail;
  }
}

export default new SingleSourceService();
