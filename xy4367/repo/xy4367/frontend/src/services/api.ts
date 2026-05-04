import {
  ObservingSite,
  Device,
  ObservingTarget,
  TargetWindow,
  Risk,
  ObservationActivity,
  RiskSummary,
  ImportResult,
} from '../types';

const API_BASE = '/api';

export const api = {
  async getHealth(): Promise<{ status: string; timestamp: string }> {
    const response = await fetch(`${API_BASE}/health`);
    return response.json();
  },

  async getSites(): Promise<ObservingSite[]> {
    const response = await fetch(`${API_BASE}/import/sites`);
    return response.json();
  },

  async getTargets(): Promise<ObservingTarget[]> {
    const response = await fetch(`${API_BASE}/import/targets`);
    return response.json();
  },

  async getWindows(): Promise<TargetWindow[]> {
    const response = await fetch(`${API_BASE}/import/windows`);
    return response.json();
  },

  async getDevices(): Promise<Device[]> {
    const response = await fetch(`${API_BASE}/devices`);
    return response.json();
  },

  async getDevice(id: string): Promise<Device> {
    const response = await fetch(`${API_BASE}/devices/${id}`);
    return response.json();
  },

  async createDevice(device: Omit<Device, 'id'>): Promise<Device> {
    const response = await fetch(`${API_BASE}/devices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(device),
    });
    return response.json();
  },

  async updateDevice(id: string, device: Partial<Device>): Promise<Device> {
    const response = await fetch(`${API_BASE}/devices/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(device),
    });
    return response.json();
  },

  async deleteDevice(id: string): Promise<void> {
    await fetch(`${API_BASE}/devices/${id}`, { method: 'DELETE' });
  },

  async getRisks(): Promise<Risk[]> {
    const response = await fetch(`${API_BASE}/risks`);
    return response.json();
  },

  async getRisksByWindow(windowId: string): Promise<Risk[]> {
    const response = await fetch(`${API_BASE}/risks/window/${windowId}`);
    return response.json();
  },

  async detectRisks(data: {
    windows: TargetWindow[];
    targets: ObservingTarget[];
    devices: Device[];
    site: ObservingSite;
    lightPollution?: any;
    activityDate?: string;
  }): Promise<Risk[]> {
    const response = await fetch(`${API_BASE}/risks/detect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return response.json();
  },

  async overrideRisk(
    riskId: string,
    data: { isOverridden: boolean; overrideReason?: string; overrideBy?: string }
  ): Promise<Risk> {
    const response = await fetch(`${API_BASE}/risks/${riskId}/override`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return response.json();
  },

  async getRiskSummary(): Promise<RiskSummary> {
    const response = await fetch(`${API_BASE}/risks/summary`);
    return response.json();
  },

  async getActivities(): Promise<ObservationActivity[]> {
    const response = await fetch(`${API_BASE}/activities`);
    return response.json();
  },

  async getActivity(id: string): Promise<ObservationActivity> {
    const response = await fetch(`${API_BASE}/activities/${id}`);
    return response.json();
  },

  async createActivity(
    activity: Omit<ObservationActivity, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ObservationActivity> {
    const response = await fetch(`${API_BASE}/activities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(activity),
    });
    return response.json();
  },

  async updateActivity(
    id: string,
    activity: Partial<ObservationActivity>
  ): Promise<ObservationActivity> {
    const response = await fetch(`${API_BASE}/activities/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(activity),
    });
    return response.json();
  },

  async deleteActivity(id: string): Promise<void> {
    await fetch(`${API_BASE}/activities/${id}`, { method: 'DELETE' });
  },

  async importSitesCSV(file: File): Promise<ImportResult> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${API_BASE}/import/sites/csv`, {
      method: 'POST',
      body: formData,
    });
    return response.json();
  },

  async importDevicesCSV(file: File): Promise<ImportResult> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${API_BASE}/import/devices/csv`, {
      method: 'POST',
      body: formData,
    });
    return response.json();
  },

  async importTargetsJSON(file: File): Promise<ImportResult> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${API_BASE}/import/targets/json`, {
      method: 'POST',
      body: formData,
    });
    return response.json();
  },

  async importWindowsJSON(file: File): Promise<ImportResult> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${API_BASE}/import/windows/json`, {
      method: 'POST',
      body: formData,
    });
    return response.json();
  },

  async importLightPollutionJSON(file: File): Promise<ImportResult> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${API_BASE}/import/light-pollution/json`, {
      method: 'POST',
      body: formData,
    });
    return response.json();
  },

  async exportObservingListMarkdown(activityId?: string): Promise<string> {
    const url = activityId
      ? `${API_BASE}/export/markdown/observing-list?activityId=${encodeURIComponent(activityId)}`
      : `${API_BASE}/export/markdown/observing-list`;
    const response = await fetch(url);
    return response.text();
  },

  async exportAuditPackage(activityId?: string): Promise<Blob> {
    const url = activityId
      ? `${API_BASE}/export/json/audit-package?activityId=${encodeURIComponent(activityId)}`
      : `${API_BASE}/export/json/audit-package`;
    const response = await fetch(url);
    return response.blob();
  },

  async previewObservingList(activityId?: string): Promise<{ markdown: string }> {
    const url = activityId
      ? `${API_BASE}/export/preview/observing-list?activityId=${encodeURIComponent(activityId)}`
      : `${API_BASE}/export/preview/observing-list`;
    const response = await fetch(url);
    return response.json();
  },

  async previewAuditPackage(activityId?: string): Promise<any> {
    const url = activityId
      ? `${API_BASE}/export/preview/audit-package?activityId=${encodeURIComponent(activityId)}`
      : `${API_BASE}/export/preview/audit-package`;
    const response = await fetch(url);
    return response.json();
  },
};
