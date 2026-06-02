import crypto from 'crypto';
import type { SettlementDetail } from '../../shared/types.js';

export class FingerprintService {
  generateRowFingerprint(rowData: Record<string, any>): string {
    const sortedKeys = Object.keys(rowData).sort();
    const normalized = sortedKeys.map(key => `${key}:${JSON.stringify(rowData[key])}`).join('|');
    return crypto.createHash('sha256').update(normalized).digest('hex');
  }

  generateFileHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  generateDetailsFingerprint(details: SettlementDetail[]): string {
    const mapped = details.map(d => ({
      id: d.id, policyNo: d.policyNo, commissionAmount: d.commissionAmount,
      currency: d.currency, netAmount: d.netAmount, status: d.status
    }));
    mapped.sort((a, b) => a.id.localeCompare(b.id));
    const serialized = JSON.stringify(mapped);
    return crypto.createHash('sha256').update(serialized).digest('hex');
  }

  compareFingerprints(fp1: string, fp2: string): boolean {
    return fp1 === fp2;
  }
}

export default new FingerprintService();
