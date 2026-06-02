import type { RoomAllocation, FilterState } from '@/types';
import { PERSON_TYPE_LABELS, STATUS_LABELS } from '@/types';

export const filterRecords = (
  records: RoomAllocation[],
  filters: Partial<FilterState>
): RoomAllocation[] => {
  return records.filter(record => {
    if (filters.tourName && record.tourName !== filters.tourName) return false;
    if (filters.hotelName && record.hotelName !== filters.hotelName) return false;
    if (filters.roomType && record.roomType !== filters.roomType) return false;
    if (filters.personType && record.personType !== filters.personType) return false;
    if (filters.status && record.status !== filters.status) return false;
    
    if (filters.searchText) {
      const searchLower = filters.searchText.toLowerCase();
      const searchFields = [
        record.tourName,
        record.hotelName,
        record.roomType,
        record.personName,
        record.remarks,
      ];
      if (!searchFields.some(f => f.toLowerCase().includes(searchLower))) {
        return false;
      }
    }
    
    return true;
  });
};

export const generateCSVContent = (records: RoomAllocation[]): string => {
  const headers = [
    '巡演名称',
    '酒店名称',
    '房型',
    '入住人',
    '人员类型',
    '入住日期',
    '退房日期',
    '备注',
    '来源',
    '状态',
    '人工标记',
  ];
  
  const rows = records.map(record => [
    record.tourName,
    record.hotelName,
    record.roomType,
    record.personName,
    PERSON_TYPE_LABELS[record.personType] || record.personType,
    record.checkInDate,
    record.checkOutDate,
    record.remarks,
    record.source,
    STATUS_LABELS[record.status] || record.status,
    record.manualTag || '',
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
  
  return [headers.join(','), ...rows].join('\n');
};

export const generateJSONContent = (records: RoomAllocation[]): string => {
  return JSON.stringify(records, null, 2);
};

const downloadFile = (content: string, filename: string, mimeType: string): void => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const generateFileName = (filters: Partial<FilterState>, format: string): string => {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const timeStr = now.toTimeString().slice(0, 5).replace(':', '');
  
  let filterPart = '';
  if (filters.personType) {
    filterPart += `_${PERSON_TYPE_LABELS[filters.personType as keyof typeof PERSON_TYPE_LABELS] || filters.personType}`;
  }
  if (filters.tourName) {
    filterPart += `_${filters.tourName}`;
  }
  if (filters.hotelName) {
    filterPart += `_${filters.hotelName}`;
  }
  
  return `巡演酒店房型分配_${dateStr}_${timeStr}${filterPart}.${format}`;
};

export const exportToCSV = (
  records: RoomAllocation[],
  filters: Partial<FilterState>
): void => {
  const filtered = filterRecords(records, filters);
  const content = generateCSVContent(filtered);
  const filename = generateFileName(filters, 'csv');
  downloadFile(content, filename, 'text/csv;charset=utf-8;');
};

export const exportToJSON = (
  records: RoomAllocation[],
  filters: Partial<FilterState>
): void => {
  const filtered = filterRecords(records, filters);
  const content = generateJSONContent(filtered);
  const filename = generateFileName(filters, 'json');
  downloadFile(content, filename, 'application/json');
};

export const getUniqueValues = (records: RoomAllocation[], field: keyof RoomAllocation): string[] => {
  const values = new Set<string>();
  records.forEach(record => {
    const value = record[field];
    if (value) values.add(String(value));
  });
  return Array.from(values).sort();
};
