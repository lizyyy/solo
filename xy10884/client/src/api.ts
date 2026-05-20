import { RenewalBatch, Device, DeviceGroupInfo } from './types';

const API_BASE = '/api';

export const api = {
  async getBatches(): Promise<RenewalBatch[]> {
    const res = await fetch(`${API_BASE}/batches`);
    return res.json();
  },

  async getBatch(id: string): Promise<RenewalBatch> {
    const res = await fetch(`${API_BASE}/batches/${id}`);
    return res.json();
  },

  async createBatch(data: { name: string; createdBy: string; deviceGroups: string[]; expiryThresholdDays: number }): Promise<RenewalBatch> {
    const res = await fetch(`${API_BASE}/batches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async simulateIssueCallback(batchId: string, deviceId: string, success: boolean): Promise<any> {
    const res = await fetch(`${API_BASE}/batches/${batchId}/issue-callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId,
        success,
        certSn: success ? `NEW-CERT-${Date.now()}` : undefined,
        receipt: success ? `CA-RECEIPT-${Date.now()}` : undefined,
        error: success ? undefined : '模拟签发失败'
      })
    });
    return res.json();
  },

  async simulateRevokeCallback(batchId: string, deviceId: string, success: boolean): Promise<any> {
    const res = await fetch(`${API_BASE}/batches/${batchId}/revoke-callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId,
        success,
        receipt: success ? `CA-REVOKE-${Date.now()}` : undefined,
        error: success ? undefined : '模拟吊销失败'
      })
    });
    return res.json();
  },

  async compensate(batchId: string, deviceIds: string[], operator: string): Promise<any> {
    const res = await fetch(`${API_BASE}/batches/${batchId}/compensate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceIds, operator })
    });
    return res.json();
  },

  async getReport(batchId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/batches/${batchId}/report`);
    return res.json();
  },

  async getDevices(): Promise<Device[]> {
    const res = await fetch(`${API_BASE}/devices`);
    return res.json();
  },

  async getDeviceGroups(): Promise<DeviceGroupInfo[]> {
    const res = await fetch(`${API_BASE}/device-groups`);
    return res.json();
  }
};