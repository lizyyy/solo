import type { RoomAllocation, DataQualityIssue } from '@/types';

const EMPTY_CHECK_FIELDS = ['personName', 'roomType', 'checkInDate', 'checkOutDate'] as const;

const FIELD_LABELS: Record<string, string> = {
  personName: '入住人',
  roomType: '房型',
  checkInDate: '入住日期',
  checkOutDate: '退房日期',
  tourName: '巡演名称',
  hotelName: '酒店名称',
};

export const checkEmptyValues = (records: RoomAllocation[]): DataQualityIssue[] => {
  const issues: DataQualityIssue[] = [];
  
  records.forEach(record => {
    EMPTY_CHECK_FIELDS.forEach(field => {
      const value = record[field];
      if (!value || value.trim() === '') {
        issues.push({
          recordId: record.id,
          type: 'empty',
          field,
          message: `这条的【${FIELD_LABELS[field] || field}】还空着哦，要不要补一下？`,
          severity: 'warning',
        });
      }
    });
  });
  
  return issues;
};

export const generateRecordHash = (record: Partial<RoomAllocation>): string => {
  const key = `${record.tourName || ''}-${record.hotelName || ''}-${record.roomType || ''}-${record.personName || ''}-${record.checkInDate || ''}`;
  return key;
};

export const checkDuplicates = (records: RoomAllocation[]): DataQualityIssue[] => {
  const issues: DataQualityIssue[] = [];
  const hashMap = new Map<string, RoomAllocation[]>();
  
  records.forEach(record => {
    const hash = generateRecordHash(record);
    if (!hashMap.has(hash)) {
      hashMap.set(hash, []);
    }
    hashMap.get(hash)!.push(record);
  });
  
  hashMap.forEach((group, hash) => {
    if (group.length > 1) {
      group.forEach(record => {
        issues.push({
          recordId: record.id,
          type: 'duplicate',
          message: `发现${group.length}条一模一样的记录，是重复导入了吗？`,
          severity: 'error',
        });
      });
    }
  });
  
  return issues;
};

export const checkBoundaryRecords = (records: RoomAllocation[]): DataQualityIssue[] => {
  const issues: DataQualityIssue[] = [];
  
  const roomTypeCounts = new Map<string, number>();
  records.forEach(record => {
    const key = `${record.hotelName}-${record.roomType}`;
    roomTypeCounts.set(key, (roomTypeCounts.get(key) || 0) + 1);
  });
  
  const allDates = records
    .map(r => r.checkInDate)
    .filter(d => d)
    .sort();
  const firstDate = allDates[0];
  const lastDate = allDates[allDates.length - 1];
  
  records.forEach(record => {
    const key = `${record.hotelName}-${record.roomType}`;
    const count = roomTypeCounts.get(key) || 0;
    
    if (count === 1) {
      issues.push({
        recordId: record.id,
        type: 'boundary',
        message: `这条是${record.roomType}的最后一间房，分配前确认一下哦`,
        severity: 'info',
      });
    }
    
    if (record.personType === 'artist') {
      issues.push({
        recordId: record.id,
        type: 'boundary',
        message: `这是艺人的房间，需要特别确认`,
        severity: 'info',
      });
    }
    
    if (record.checkInDate === firstDate && firstDate) {
      issues.push({
        recordId: record.id,
        type: 'boundary',
        message: `这是巡演首日入住的记录，确认一下时间`,
        severity: 'info',
      });
    }
    
    if (record.checkInDate === lastDate && lastDate && firstDate !== lastDate) {
      issues.push({
        recordId: record.id,
        type: 'boundary',
        message: `这是巡演最后一站的入住记录，确认一下时间`,
        severity: 'info',
      });
    }
  });
  
  return issues;
};

export const checkAllDataQuality = (records: RoomAllocation[]): DataQualityIssue[] => {
  const emptyIssues = checkEmptyValues(records);
  const duplicateIssues = checkDuplicates(records);
  const boundaryIssues = checkBoundaryRecords(records);
  
  return [...emptyIssues, ...duplicateIssues, ...boundaryIssues];
};

export const getIssuesByRecordId = (
  issues: DataQualityIssue[],
  recordId: string
): DataQualityIssue[] => {
  return issues.filter(issue => issue.recordId === recordId);
};
