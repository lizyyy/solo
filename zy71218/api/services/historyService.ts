import type { VersionHistory, PaginatedResponse } from '../../shared/types.js';

const mockChanges: VersionHistory[] = [
  {
    id: 'vh001',
    recordId: 'inv001',
    recordType: 'invoice',
    version: 2,
    beforeData: JSON.stringify({ status: 'pending', dueDate: '2024-02-10' }),
    afterData: JSON.stringify({ status: 'confirmed', dueDate: '2024-02-15' }),
    changedFields: JSON.stringify(['status', 'dueDate']),
    operatorId: 'u001',
    operatorName: '张明',
    changeReason: '买方确认付款日期延后',
    timestamp: '2024-02-15T10:30:00Z',
  },
  {
    id: 'vh002',
    recordId: 'conf001',
    recordType: 'confirmation',
    version: 2,
    beforeData: JSON.stringify({ isWithdrawn: false }),
    afterData: JSON.stringify({ isWithdrawn: true, withdrawReason: '交易取消' }),
    changedFields: JSON.stringify(['isWithdrawn', 'withdrawReason', 'withdrawDate']),
    operatorId: 'u001',
    operatorName: '张明',
    changeReason: '买方申请撤回确认',
    timestamp: '2024-02-18T14:20:00Z',
  },
  {
    id: 'vh003',
    recordId: 'c001',
    recordType: 'invoice',
    version: 3,
    beforeData: JSON.stringify({ currentStatus: 'confirmed', riskLevel: 'low' }),
    afterData: JSON.stringify({ currentStatus: 'overdue', riskLevel: 'high' }),
    changedFields: JSON.stringify(['currentStatus', 'riskLevel', 'overdueDays']),
    operatorId: 'u001',
    operatorName: '张明',
    changeReason: '系统自动检测到逾期',
    timestamp: '2024-02-20T08:00:00Z',
  },
];

export const historyService = {
  async getChanges(
    page: number = 1,
    pageSize: number = 10,
    filters?: any,
  ): Promise<PaginatedResponse<VersionHistory>> {
    let filtered = [...mockChanges];

    if (filters?.recordId) {
      filtered = filtered.filter((c) => c.recordId === filters.recordId);
    }

    if (filters?.recordType) {
      filtered = filtered.filter((c) => c.recordType === filters.recordType);
    }

    if (filters?.operatorId) {
      filtered = filtered.filter((c) => c.operatorId === filters.operatorId);
    }

    if (filters?.startDate) {
      filtered = filtered.filter((c) => c.timestamp >= filters.startDate);
    }

    if (filters?.endDate) {
      filtered = filtered.filter((c) => c.timestamp <= filters.endDate);
    }

    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const list = filtered.slice(start, start + pageSize);

    return { list, total, page, pageSize };
  },
};
