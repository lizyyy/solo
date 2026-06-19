import type {
  TailAdjustment,
  CustodyConfirmation,
  ProcessNode,
  OverviewStats,
  ChartDataPoint,
  PieChartData,
  ImportResult,
  ReviewRequest,
  ExecutiveSummaryItem,
  CustodyCreateResult,
} from '@shared/types';
import {
  mockAdjustments,
  mockCustodyConfirmations,
  mockProcessNodes,
  mock3DChartData,
  mockPieChartData,
} from '@shared/mockData';
import { isZeroReversed, generateSummary } from '@shared/types';

const API_BASE = '/api';

async function delay<T>(data: T, ms = 300): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms));
}

export const api = {
  async getAdjustments(): Promise<TailAdjustment[]> {
    try {
      const res = await fetch(`${API_BASE}/adjustments`);
      if (res.ok) {
        const result = await res.json();
        return result.data || result;
      }
    } catch {
      console.log('使用mock数据: adjustments');
    }
    return delay(mockAdjustments);
  },

  async getAdjustmentById(id: string): Promise<TailAdjustment | undefined> {
    try {
      const res = await fetch(`${API_BASE}/adjustments/${id}`);
      if (res.ok) {
        const result = await res.json();
        return result.data || result;
      }
    } catch {
      console.log('使用mock数据: adjustment by id');
    }
    return delay(mockAdjustments.find((a) => a.id === id));
  },

  async getCustodyConfirmations(): Promise<CustodyConfirmation[]> {
    try {
      const res = await fetch(`${API_BASE}/custody`);
      if (res.ok) {
        const result = await res.json();
        return result.data || result;
      }
    } catch {
      console.log('使用mock数据: custody confirmations');
    }
    return delay(mockCustodyConfirmations);
  },

  async getCustodyById(id: string): Promise<CustodyConfirmation | undefined> {
    try {
      const res = await fetch(`${API_BASE}/custody/${id}`);
      if (res.ok) {
        const result = await res.json();
        return result.data || result;
      }
    } catch {
      console.log('使用mock数据: custody by id');
    }
    return delay(mockCustodyConfirmations.find((c) => c.id === id));
  },

  async getProcessNodes(adjustmentId?: string): Promise<ProcessNode[]> {
    try {
      const url = adjustmentId
        ? `${API_BASE}/overview/process-nodes?adjustmentId=${adjustmentId}`
        : `${API_BASE}/overview/process-nodes`;
      const res = await fetch(url);
      if (res.ok) {
        const result = await res.json();
        return result.data || result;
      }
    } catch {
      console.log('使用mock数据: process nodes');
    }
    let nodes = mockProcessNodes;
    if (adjustmentId) {
      nodes = nodes.filter((n) => n.adjustmentId === adjustmentId);
    }
    return delay(nodes);
  },

  async getOverviewStats(): Promise<OverviewStats> {
    try {
      const res = await fetch(`${API_BASE}/overview/stats`);
      if (res.ok) {
        const result = await res.json();
        return result.data || result;
      }
    } catch {
      console.log('使用mock数据: overview stats');
    }
    return delay({
      total: mockAdjustments.length,
      pendingCustody: mockAdjustments.filter((a) => a.status === 'pending_custody').length,
      pendingReview: mockAdjustments.filter((a) => a.status === 'pending_review').length,
      completed: mockAdjustments.filter((a) => a.status === 'reviewed_normal').length,
      flagged: mockAdjustments.filter((a) => isZeroReversed(a.amount, a.remark)).length,
    });
  },

  async get3DChartData(): Promise<ChartDataPoint[]> {
    try {
      const res = await fetch(`${API_BASE}/overview/charts/3d`);
      if (res.ok) {
        const result = await res.json();
        return result.data || result;
      }
    } catch {
      console.log('使用mock数据: 3d chart data');
    }
    return delay(mock3DChartData);
  },

  async getPieChartData(): Promise<PieChartData[]> {
    try {
      const res = await fetch(`${API_BASE}/overview/charts/pie`);
      if (res.ok) {
        const result = await res.json();
        return result.data || result;
      }
    } catch {
      console.log('使用mock数据: pie chart data');
    }
    return delay(mockPieChartData);
  },

  async getExecutiveSummary(): Promise<ExecutiveSummaryItem[]> {
    try {
      const res = await fetch(`${API_BASE}/summary`);
      if (res.ok) {
        const result = await res.json();
        return result.data || result;
      }
    } catch {
      console.log('使用mock数据: executive summary');
    }
    const summary = mockAdjustments
      .filter((a) => isZeroReversed(a.amount, a.remark))
      .map((adjustment) => {
        const custody = mockCustodyConfirmations.find((c) => c.adjustmentId === adjustment.id);
        const s = generateSummary(adjustment, custody);
        return {
          adjustmentId: adjustment.id,
          adjustmentNo: adjustment.adjustmentNo,
          tradeDate: adjustment.tradeDate,
          amount: adjustment.amount,
          remark: adjustment.remark,
          status: adjustment.status,
          ...s,
          updatedAt: custody?.updateTime || adjustment.importTime,
          custody,
        };
      });
    return delay(summary);
  },

  async importFile(file: File): Promise<ImportResult> {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API_BASE}/import`, {
        method: 'POST',
        body: formData,
      });
      if (res.ok) return res.json();
    } catch {
      console.log('使用mock数据: import file');
    }

    const text = await file.text();
    const lines = text.trim().split('\n').slice(1);
    const items: TailAdjustment[] = lines.map((line, index) => {
      const [tradeDate, adjustmentNo, amountStr, remark] = line.split(',');
      const amount = parseFloat(amountStr);
      const hasZero = isZeroReversed(amount, remark);
      return {
        id: `adj_import_${Date.now()}_${index}`,
        tradeDate: tradeDate.trim(),
        adjustmentNo: adjustmentNo.trim(),
        amount,
        remark: remark.trim(),
        hasZeroAmountButReversed: hasZero,
        status: hasZero ? 'pending_custody' : 'imported',
        importTime: new Date().toISOString().replace('T', ' ').slice(0, 19),
        importOperator: '小周',
      };
    });

    return delay({
      total: items.length,
      flagged: items.filter((i) => i.hasZeroAmountButReversed).length,
      items,
    });
  },

  async submitReview(adjustmentId: string, request: ReviewRequest): Promise<void> {
    try {
      const res = await fetch(`${API_BASE}/adjustments/${adjustmentId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
      if (res.ok) return;
    } catch {
      console.log('使用mock数据: submit review');
    }
    return delay(undefined);
  },

  async updateCustody(custody: CustodyConfirmation): Promise<CustodyConfirmation> {
    try {
      const res = await fetch(`${API_BASE}/custody/${custody.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(custody),
      });
      if (res.ok) {
        const result = await res.json();
        return result.data || result;
      }
    } catch {
      console.log('使用mock数据: update custody');
    }
    return delay({ ...custody, updateTime: new Date().toISOString().replace('T', ' ').slice(0, 19) });
  },

  async createCustody(custody: Omit<CustodyConfirmation, 'id' | 'createTime' | 'updateTime'> & { operator?: string }): Promise<CustodyCreateResult> {
    try {
      const res = await fetch(`${API_BASE}/custody`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(custody),
      });
      if (res.ok) {
        const result = await res.json();
        return result.data || result;
      }
    } catch {
      console.log('使用mock数据: create custody');
    }
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const newCustody: CustodyConfirmation = {
      ...custody,
      id: `cust_${Date.now()}`,
      createTime: now,
      updateTime: now,
    } as CustodyConfirmation;
    return delay({
      custody: newCustody,
      adjustment: mockAdjustments.find((a) => a.id === custody.adjustmentId)!,
      diffSnapshot: {
        adjustmentId: custody.adjustmentId,
        adjustmentNo: '',
        beforeStatus: 'pending_custody' as const,
        afterStatus: 'pending_review' as const,
        fields: [],
        snapshotTime: now,
        operator: custody.operator || '小周',
      },
    });
  },
};
