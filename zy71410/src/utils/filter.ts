import { FundUsageRecord, FilterOptions, Discrepancy } from '../types';

export const filterRecords = (
  records: FundUsageRecord[],
  filters: FilterOptions,
  discrepancies: Discrepancy[] = []
): FundUsageRecord[] => {
  return records.filter(record => {
    if (filters.bondCode && !record.bondCode.includes(filters.bondCode)) {
      return false;
    }

    if (filters.category && record.category !== filters.category) {
      return false;
    }

    if (filters.startDate && record.paymentDate) {
      if (new Date(record.paymentDate) < new Date(filters.startDate)) {
        return false;
      }
    }

    if (filters.endDate && record.paymentDate) {
      if (new Date(record.paymentDate) > new Date(filters.endDate)) {
        return false;
      }
    }

    if (filters.approvalStatus && record.approvalStatus !== filters.approvalStatus) {
      return false;
    }

    if (filters.hasDiscrepancies !== undefined) {
      const hasDiscrepancy = discrepancies.some(
        d => d.recordId === record.id && !d.resolved
      );
      if (filters.hasDiscrepancies && !hasDiscrepancy) {
        return false;
      }
      if (!filters.hasDiscrepancies && hasDiscrepancy) {
        return false;
      }
    }

    return true;
  });
};

export const sortRecords = (
  records: FundUsageRecord[],
  sortBy: keyof FundUsageRecord = 'paymentDate',
  ascending: boolean = false
): FundUsageRecord[] => {
  return [...records].sort((a, b) => {
    const aVal = a[sortBy];
    const bVal = b[sortBy];

    if (aVal === undefined && bVal === undefined) return 0;
    if (aVal === undefined) return 1;
    if (bVal === undefined) return -1;

    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return ascending ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }

    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return ascending ? aVal - bVal : bVal - aVal;
    }

    return 0;
  });
};

export const getUniqueBondCodes = (records: FundUsageRecord[]): string[] => {
  return [...new Set(records.map(r => r.bondCode))].filter(Boolean);
};

export const getRecordHistory = (
  recordId: string,
  history: { recordId: string; timestamp: string; action: string }[]
) => {
  return history
    .filter(h => h.recordId === recordId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
};

export const groupRecordsByCategory = (records: FundUsageRecord[]) => {
  const groups: Record<string, FundUsageRecord[]> = {};
  records.forEach(record => {
    if (!groups[record.category]) {
      groups[record.category] = [];
    }
    groups[record.category].push(record);
  });
  return groups;
};

export const groupRecordsByStatus = (records: FundUsageRecord[]) => {
  const groups: Record<string, FundUsageRecord[]> = {};
  records.forEach(record => {
    if (!groups[record.approvalStatus]) {
      groups[record.approvalStatus] = [];
    }
    groups[record.approvalStatus].push(record);
  });
  return groups;
};

export const searchRecords = (
  records: FundUsageRecord[],
  keyword: string
): FundUsageRecord[] => {
  if (!keyword.trim()) return records;
  const lowerKeyword = keyword.toLowerCase();
  return records.filter(record =>
    record.projectName.toLowerCase().includes(lowerKeyword) ||
    record.bondCode.toLowerCase().includes(lowerKeyword) ||
    record.category.toLowerCase().includes(lowerKeyword) ||
    record.explanation?.toLowerCase().includes(lowerKeyword)
  );
};
