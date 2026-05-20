import { v4 as uuidv4 } from 'uuid';
import { RenewalBatch, Device, CreateBatchRequest, CompensationAttempt, RenewalRecord, RenewalStatus } from './types';
import { mockBatches } from './data/batches';
import { mockDevices } from './data/devices';

class DataStore {
  private batches: RenewalBatch[] = [...mockBatches];
  private devices: Device[] = [...mockDevices];

  getAllBatches(): RenewalBatch[] {
    return this.batches;
  }

  getBatchById(id: string): RenewalBatch | undefined {
    return this.batches.find(b => b.id === id);
  }

  getAllDevices(): Device[] {
    return this.devices;
  }

  getDevicesByGroups(groups: string[], expiryThresholdDays: number): Device[] {
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() + expiryThresholdDays);
    
    return this.devices.filter(d => {
      const inGroup = groups.length === 0 || groups.includes(d.group);
      const expiringSoon = new Date(d.currentCertExpiry) <= thresholdDate;
      return inGroup && expiringSoon;
    });
  }

  createBatch(request: CreateBatchRequest): RenewalBatch {
    const existingBatch = this.batches.find(b => 
      b.name === request.name && 
      JSON.stringify(b.deviceGroups.sort()) === JSON.stringify(request.deviceGroups.sort()) &&
      b.expiryThresholdDays === request.expiryThresholdDays
    );
    
    if (existingBatch) {
      return existingBatch;
    }

    const targetDevices = this.getDevicesByGroups(request.deviceGroups, request.expiryThresholdDays);
    
    const records: RenewalRecord[] = targetDevices.map(d => ({
      deviceId: d.id,
      status: 'pending' as RenewalStatus,
      oldCertSn: `OLD-CERT-${d.id.toUpperCase()}`
    }));

    const newBatch: RenewalBatch = {
      id: `batch-${uuidv4().slice(0, 8)}`,
      name: request.name,
      createdAt: new Date().toISOString(),
      createdBy: request.createdBy,
      status: 'created',
      deviceGroups: request.deviceGroups,
      expiryThresholdDays: request.expiryThresholdDays,
      totalDevices: targetDevices.length,
      records,
      compensationAttempts: []
    };

    this.batches.push(newBatch);
    return newBatch;
  }

  updateIssueResult(batchId: string, deviceId: string, success: boolean, certSn?: string, receipt?: string, error?: string): RenewalBatch | null {
    const batch = this.getBatchById(batchId);
    if (!batch) return null;

    const record = batch.records.find(r => r.deviceId === deviceId);
    if (!record) return null;

    if (success) {
      record.status = 'success';
      record.newCertSn = certSn;
      record.issuedAt = new Date().toISOString();
      record.issueReceipt = receipt;
      record.status = 'revoking';
    } else {
      record.status = 'failed';
      record.issueError = error;
    }

    this.updateBatchStatus(batch);
    return batch;
  }

  updateRevokeResult(batchId: string, deviceId: string, success: boolean, receipt?: string, error?: string): RenewalBatch | null {
    const batch = this.getBatchById(batchId);
    if (!batch) return null;

    const record = batch.records.find(r => r.deviceId === deviceId);
    if (!record) return null;

    if (success) {
      record.status = 'success';
      record.revokedAt = new Date().toISOString();
      record.revokeReceipt = receipt;
    } else {
      record.status = 'revoke_failed';
      record.revokeError = error;
    }

    this.updateBatchStatus(batch);
    return batch;
  }

  addCompensationAttempt(batchId: string, deviceIds: string[], operator: string): CompensationAttempt[] {
    const batch = this.getBatchById(batchId);
    if (!batch) return [];

    const attempts: CompensationAttempt[] = deviceIds.map(deviceId => {
      const attempt: CompensationAttempt = {
        id: `comp-${uuidv4().slice(0, 8)}`,
        deviceId,
        operator,
        attemptedAt: new Date().toISOString(),
        status: Math.random() > 0.5 ? 'success' : 'failed',
        errorMessage: Math.random() > 0.5 ? '设备连接超时' : undefined
      };

      const record = batch.records.find(r => r.deviceId === deviceId);
      if (record) {
        record.status = attempt.status === 'success' ? 'compensated' : 'compensating';
      }

      return attempt;
    });

    batch.compensationAttempts.push(...attempts);
    this.updateBatchStatus(batch);
    return attempts;
  }

  generateReport(batchId: string): any {
    const batch = this.getBatchById(batchId);
    if (!batch) return null;

    const stats = {
      total: batch.records.length,
      success: batch.records.filter(r => r.status === 'success' || r.status === 'compensated').length,
      failed: batch.records.filter(r => r.status === 'failed').length,
      pending: batch.records.filter(r => r.status === 'pending').length,
      compensating: batch.records.filter(r => r.status === 'compensating').length,
      revokeFailed: batch.records.filter(r => r.status === 'revoke_failed').length,
    };

    const offlineDevices = batch.records
      .filter(r => r.status === 'compensating')
      .map(r => ({
        ...r,
        device: this.devices.find(d => d.id === r.deviceId)
      }));

    const recentCompensations = batch.compensationAttempts
      .sort((a, b) => new Date(b.attemptedAt).getTime() - new Date(a.attemptedAt).getTime())
      .slice(0, 20);

    return {
      batchId: batch.id,
      batchName: batch.name,
      generatedAt: new Date().toISOString(),
      stats,
      offlineDevices,
      recentCompensations,
      allRecords: batch.records
    };
  }

  private updateBatchStatus(batch: RenewalBatch): void {
    const hasPending = batch.records.some(r => r.status === 'pending' || r.status === 'revoking' || r.status === 'compensating');
    const hasFailed = batch.records.some(r => r.status === 'failed' || r.status === 'revoke_failed');
    
    if (!hasPending && !hasFailed) {
      batch.status = 'completed';
    } else if (!hasPending && hasFailed) {
      batch.status = 'partial';
    } else {
      batch.status = 'processing';
    }
  }
}

export const store = new DataStore();