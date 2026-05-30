import { DataVersion, SwingSession, ChangeType, SupplementRecord } from '@/types';

const generateId = (): string => 
  Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

export const createVersion = (
  session: SwingSession,
  changeType: ChangeType,
  changedBy: string,
  remark: string,
  diffData: Record<string, any>
): DataVersion => {
  const nextVersionNumber = session.versions.length > 0 
    ? Math.max(...session.versions.map(v => v.versionNumber)) + 1 
    : 1;

  return {
    versionId: generateId(),
    versionNumber: nextVersionNumber,
    changeType,
    changedBy,
    createdAt: new Date(),
    diffData,
    remark,
  };
};

export const addVersionToSession = (
  session: SwingSession,
  version: DataVersion
): SwingSession => {
  return {
    ...session,
    versions: [...session.versions, version],
  };
};

export const computeDiff = (
  oldData: Record<string, any>,
  newData: Record<string, any>
): Record<string, any> => {
  const diff: Record<string, any> = {};
  
  const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
  
  for (const key of allKeys) {
    const oldValue = oldData[key];
    const newValue = newData[key];
    
    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      diff[key] = {
        old: oldValue,
        new: newValue,
      };
    }
  }
  
  return diff;
};

export const getVersionByNumber = (
  session: SwingSession,
  versionNumber: number
): DataVersion | undefined => {
  return session.versions.find(v => v.versionNumber === versionNumber);
};

export const getVersionsByChangeType = (
  session: SwingSession,
  changeType: ChangeType
): DataVersion[] => {
  return session.versions.filter(v => v.changeType === changeType);
};

export const getLatestVersion = (session: SwingSession): DataVersion | undefined => {
  if (session.versions.length === 0) return undefined;
  return session.versions[session.versions.length - 1];
};

export const formatVersionLabel = (version: DataVersion): string => {
  const typeLabels: Record<ChangeType, string> = {
    create: '创建',
    update: '更新',
    supplement: '补录',
    import: '导入',
  };
  return `v${version.versionNumber} - ${typeLabels[version.changeType]} (${version.changedBy})`;
};

export const createSupplementRecord = (
  supplement: Omit<SupplementRecord, 'supplementId' | 'supplementedAt'>
): SupplementRecord => {
  return {
    ...supplement,
    supplementId: generateId(),
    supplementedAt: new Date(),
  };
};

export const markFramesAsSupplemented = (
  session: SwingSession,
  supplement: SupplementRecord
): SwingSession => {
  const updatedFrames = session.frames.map(frame => {
    if (supplement.affectedFrames.includes(frame.frameId)) {
      return {
        ...frame,
        isSupplemented: true,
        supplementId: supplement.supplementId,
      };
    }
    return frame;
  });

  return {
    ...session,
    frames: updatedFrames,
    supplements: [...session.supplements, supplement],
  };
};

export const getSupplementsByType = (
  session: SwingSession,
  fieldType: string
): SupplementRecord[] => {
  return session.supplements.filter(s => s.fieldType === fieldType);
};

export const isFrameSupplemented = (
  session: SwingSession,
  frameId: string
): boolean => {
  return session.frames.some(f => f.frameId === frameId && f.isSupplemented);
};

export const getSupplementForFrame = (
  session: SwingSession,
  frameId: string
): SupplementRecord | undefined => {
  const frame = session.frames.find(f => f.frameId === frameId);
  if (!frame?.supplementId) return undefined;
  return session.supplements.find(s => s.supplementId === frame.supplementId);
};

export const getChangeTypeLabel = (changeType: ChangeType): string => {
  const labels: Record<ChangeType, string> = {
    create: '创建',
    update: '更新',
    supplement: '补录',
    import: '导入',
  };
  return labels[changeType];
};

export const getChangeTypeColor = (changeType: ChangeType): string => {
  const colors: Record<ChangeType, string> = {
    create: 'golf-blue',
    update: 'golf-green',
    supplement: 'golf-orange',
    import: 'golf-text-muted',
  };
  return colors[changeType];
};
