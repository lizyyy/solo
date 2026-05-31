import {
  CuratorNote,
  LightingRecord,
  Artwork,
  VersionDifference,
  ChangeLog,
  Anomaly,
  User,
  ChangeType,
} from '@/types';

export function compareNotes(
  oldNote: CuratorNote,
  newNote: CuratorNote
): VersionDifference[] {
  const diffs: VersionDifference[] = [];

  if (oldNote.content !== newNote.content) {
    diffs.push({
      field: 'content',
      oldValue: oldNote.content,
      newValue: newNote.content,
      changeType: 'note',
      requiresAttention: !newNote.isSupplement,
    });
  }

  return diffs;
}

export function compareLightingRecords(
  oldRecord: LightingRecord,
  newRecord: LightingRecord
): VersionDifference[] {
  const diffs: VersionDifference[] = [];
  const criticalFields = ['luxLevel', 'colorTemperature', 'angle'] as const;

  for (const field of criticalFields) {
    if (oldRecord[field] !== newRecord[field]) {
      diffs.push({
        field,
        oldValue: String(oldRecord[field]),
        newValue: String(newRecord[field]),
        changeType: 'lighting',
        requiresAttention: newRecord.isOverridden,
      });
    }
  }

  if (oldRecord.notes !== newRecord.notes) {
    diffs.push({
      field: 'notes',
      oldValue: oldRecord.notes,
      newValue: newRecord.notes,
      changeType: 'lighting',
      requiresAttention: false,
    });
  }

  return diffs;
}

export function compareArtworks(
  oldArtwork: Artwork,
  newArtwork: Artwork
): VersionDifference[] {
  const diffs: VersionDifference[] = [];
  const fieldsToCompare: Array<keyof Artwork> = [
    'title',
    'artist',
    'year',
    'width',
    'height',
    'depth',
    'unit',
    'location',
    'status',
  ];

  for (const field of fieldsToCompare) {
    const oldVal = String(oldArtwork[field] ?? '');
    const newVal = String(newArtwork[field] ?? '');
    
    if (oldVal !== newVal) {
      const isCritical = ['width', 'height', 'unit', 'location', 'status'].includes(field);
      diffs.push({
        field,
        oldValue: oldVal,
        newValue: newVal,
        changeType: 'artwork',
        requiresAttention: isCritical && newArtwork.manualChange,
      });
    }
  }

  return diffs;
}

export function checkForSilentOverwrite(
  currentVersion: { updatedAt: string; author: string },
  previousVersion: { updatedAt: string; author: string }
): boolean {
  const timeDiff = Math.abs(
    new Date(currentVersion.updatedAt).getTime() - new Date(previousVersion.updatedAt).getTime()
  );
  const fiveMinutes = 5 * 60 * 1000;
  
  return currentVersion.author !== previousVersion.author && timeDiff < fiveMinutes;
}

export function createNoteVersion(
  exhibitionId: string,
  content: string,
  author: User,
  previousNote?: CuratorNote,
  isSupplement: boolean = false,
  supplementReason?: string
): { note: CuratorNote; diffs: VersionDifference[]; changeLog: ChangeLog; anomaly?: Anomaly } {
  const newNote: CuratorNote = {
    id: `n-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    exhibitionId,
    content,
    author: author.id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: previousNote ? previousNote.version + 1 : 1,
    isSupplement,
    supplementReason,
    previousVersionId: previousNote?.id,
  };

  let diffs: VersionDifference[] = [];
  let changeType: ChangeType = 'note_added';
  
  if (previousNote) {
    diffs = compareNotes(previousNote, newNote);
    changeType = 'note_updated';
  }

  const changeLog: ChangeLog = {
    id: `cl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    exhibitionId,
    changeType,
    entityId: newNote.id,
    entityType: 'note',
    oldValue: previousNote?.content,
    newValue: newNote.content,
    reason: isSupplement 
      ? `策展人补充备注：${supplementReason || '补充说明'}`
      : `策展人${author.name}更新备注`,
    operator: author.id,
    timestamp: new Date().toISOString(),
    requiresConfirmation: !isSupplement,
    confirmed: isSupplement,
    confirmedBy: isSupplement ? author.id : undefined,
    confirmedAt: isSupplement ? new Date().toISOString() : undefined,
  };

  let anomaly: Anomaly | undefined;
  
  if (previousNote && checkForSilentOverwrite(newNote, previousNote)) {
    anomaly = {
      id: `an-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      exhibitionId,
      type: 'note_silently_overwritten',
      description: `备注 v${previousNote.version} 被 ${author.name} 在5分钟内覆盖，内容变化：${diffs.length}处`,
      entityId: newNote.id,
      entityType: 'note',
      severity: 'warning',
      confirmed: false,
      createdAt: new Date().toISOString(),
    };
  }

  return { note: newNote, diffs, changeLog, anomaly };
}

export function createLightingRecordVersion(
  exhibitionId: string,
  artworkId: string,
  lightingData: Partial<LightingRecord>,
  operator: User,
  isOverride: boolean = false,
  overrideReason?: string,
  previousRecord?: LightingRecord
): { record: LightingRecord; diffs: VersionDifference[]; changeLog: ChangeLog; anomaly?: Anomaly } {
  const newRecord: LightingRecord = {
    id: `l-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    exhibitionId,
    artworkId,
    luxLevel: lightingData.luxLevel || 200,
    colorTemperature: lightingData.colorTemperature || 3000,
    angle: lightingData.angle || 45,
    notes: lightingData.notes || '',
    recordedBy: operator.id,
    recordedAt: new Date().toISOString(),
    version: previousRecord ? previousRecord.version + 1 : 1,
    isOverridden: isOverride,
    overrideReason,
  };

  let diffs: VersionDifference[] = [];
  let changeType: ChangeType = 'lighting_recorded';

  if (previousRecord) {
    diffs = compareLightingRecords(previousRecord, newRecord);
    changeType = isOverride ? 'lighting_overridden' : 'lighting_recorded';
  }

  const changeLog: ChangeLog = {
    id: `cl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    exhibitionId,
    changeType,
    entityId: newRecord.id,
    entityType: 'lighting',
    oldValue: previousRecord ? `lux:${previousRecord.luxLevel}, temp:${previousRecord.colorTemperature}K` : undefined,
    newValue: `lux:${newRecord.luxLevel}, temp:${newRecord.colorTemperature}K`,
    reason: isOverride
      ? `灯光方案已覆盖：${overrideReason || '策展人要求调整'}`
      : `灯光记录由${operator.name}录入`,
    operator: operator.id,
    timestamp: new Date().toISOString(),
    requiresConfirmation: isOverride,
    confirmed: false,
  };

  let anomaly: Anomaly | undefined;

  if (isOverride) {
    anomaly = {
      id: `an-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      exhibitionId,
      type: 'lighting_overridden',
      description: `作品灯光方案已被覆盖，原因：${overrideReason || '未说明'}`,
      entityId: artworkId,
      entityType: 'lighting',
      severity: 'warning',
      confirmed: false,
      createdAt: new Date().toISOString(),
    };
  }

  return { record: newRecord, diffs, changeLog, anomaly };
}

export function formatDiffsForDisplay(diffs: VersionDifference[]): Array<{
  field: string;
  oldValue: string;
  newValue: string;
  changeType: string;
  requiresAttention: boolean;
  fieldLabel: string;
}> {
  const fieldLabels: Record<string, string> = {
    content: '备注内容',
    luxLevel: '光照强度(lux)',
    colorTemperature: '色温(K)',
    angle: '照射角度(°)',
    notes: '说明',
    title: '作品名称',
    artist: '艺术家',
    year: '创作年份',
    width: '宽度',
    height: '高度',
    depth: '深度',
    unit: '单位',
    location: '展示位置',
    status: '状态',
  };

  return diffs.map(diff => ({
    ...diff,
    fieldLabel: fieldLabels[diff.field] || diff.field,
  }));
}
