import type { Evidence, EvidenceType, DataRecord } from '../types';

export const sortEvidenceByTime = (evidence: Evidence[]): Evidence[] => {
  return [...evidence].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
};

export const groupEvidenceByType = (evidence: Evidence[]): Record<EvidenceType, Evidence[]> => {
  const groups: Record<EvidenceType, Evidence[]> = {
    note: [],
    confirmation: [],
    model: [],
  };
  
  evidence.forEach(e => {
    groups[e.type].push(e);
  });
  
  return groups;
};

export const buildEvidenceChain = (record: DataRecord): Evidence[] => {
  const allEvidence: Evidence[] = [
    ...record.evidence,
  ];
  
  if (record.statusHistory.length > 0) {
    record.statusHistory.forEach(change => {
      allEvidence.push({
        id: `status-${change.id}`,
        type: 'confirmation',
        content: `状态从"${change.fromStatus}"变更为"${change.toStatus}"，原因：${change.reason}`,
        author: change.operator,
        timestamp: change.timestamp,
      });
    });
  }
  
  return sortEvidenceByTime(allEvidence);
};

export const formatEvidenceForDisplay = (evidence: Evidence): {
  icon: string;
  typeLabel: string;
  timestampLabel: string;
} => {
  const typeIcons: Record<EvidenceType, string> = {
    note: 'user',
    confirmation: 'check-circle',
    model: 'cpu',
  };
  
  const typeLabels: Record<EvidenceType, string> = {
    note: '队员笔记',
    confirmation: '人工确认',
    model: '模型说明',
  };
  
  const date = new Date(evidence.timestamp);
  const timestampLabel = date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  
  return {
    icon: typeIcons[evidence.type],
    typeLabel: typeLabels[evidence.type],
    timestampLabel,
  };
};

export const generateEvidenceId = (): string => {
  return `ev-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};
