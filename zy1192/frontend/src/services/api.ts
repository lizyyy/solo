import {
  SimulationConfig,
  SimulationResult,
  Example,
} from '../types';

const API_BASE = '/api';

export const apiService = {
  async getHealth(): Promise<{ status: string; timestamp: string }> {
    const response = await fetch(`${API_BASE}/health`);
    if (!response.ok) {
      throw new Error('Health check failed');
    }
    return response.json();
  },

  async getExamples(): Promise<Example[]> {
    const response = await fetch(`${API_BASE}/examples`);
    if (!response.ok) {
      throw new Error('Failed to fetch examples');
    }
    const data = await response.json();
    return data.data;
  },

  async getExample(id: string): Promise<Example> {
    const response = await fetch(`${API_BASE}/examples/${id}`);
    if (!response.ok) {
      throw new Error(`Example with id ${id} not found`);
    }
    const data = await response.json();
    return data.data;
  },

  async runSimulation(config: SimulationConfig): Promise<SimulationResult> {
    const response = await fetch(`${API_BASE}/simulate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Simulation failed');
    }

    const data = await response.json();
    return data.data;
  },

  async runABADemo(mode: 'cas' | 'queue' | 'version-tagged'): Promise<SimulationResult> {
    const response = await fetch(`${API_BASE}/simulate/aba-demo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ mode }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'ABA demo failed');
    }

    const data = await response.json();
    return data.data;
  },

  async exportMarkdown(result: SimulationResult): Promise<Blob> {
    const response = await fetch(`${API_BASE}/export/markdown`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(result),
    });

    if (!response.ok) {
      throw new Error('Failed to export markdown');
    }

    return response.blob();
  },

  async exportJSON(result: SimulationResult): Promise<Blob> {
    const response = await fetch(`${API_BASE}/export/json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(result),
    });

    if (!response.ok) {
      throw new Error('Failed to export JSON');
    }

    return response.blob();
  },

  downloadBlob(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  },
};
