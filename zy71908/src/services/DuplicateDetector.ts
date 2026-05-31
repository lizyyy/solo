import type { ArchiveRecord, SourceType, DuplicateResult } from '../types';
import { SOURCE_LABELS } from '../types';
import { differenceInMinutes } from 'date-fns';

export class DuplicateDetector {
  static detect(records: ArchiveRecord[]): DuplicateResult[] {
    const results: DuplicateResult[] = [];
    const processedPairs = new Set<string>();

    for (let i = 0; i < records.length; i++) {
      for (let j = i + 1; j < records.length; j++) {
        const pairKey = [records[i].id, records[j].id].sort().join('|');
        if (processedPairs.has(pairKey)) continue;
        processedPairs.add(pairKey);

        const result = this.checkDuplicate(records[i], records[j]);
        if (result) {
          results.push(result);
        }
      }
    }

    return results;
  }

  private static checkDuplicate(r1: ArchiveRecord, r2: ArchiveRecord): DuplicateResult | null {
    const isSameStudent = r1.studentId === r2.studentId;
    const isSamePiece = r1.pieceName === r2.pieceName;

    if (!isSameStudent || !isSamePiece) return null;

    const r1Sources = r1.sources.map(s => s.sourceType);
    const r2Sources = r2.sources.map(s => s.sourceType);
    const overlappingSources = r1Sources.filter(s => r2Sources.includes(s));

    const conflictFields = this.findConflictFields(r1, r2);
    
    if (conflictFields.length === 0 && overlappingSources.length > 0) {
      return null;
    }

    const timeGapMinutes = Math.abs(differenceInMinutes(r1.createdAt, r2.createdAt));
    const suggestedHandler = this.getHandlerName(r1, r2);
    const suggestedAction = this.getSuggestedAction(r1, r2, conflictFields, overlappingSources);

    return {
      record1: r1,
      record2: r2,
      conflictFields,
      sourceComparison: {
        record1Sources: r1Sources,
        record2Sources: r2Sources,
        timeGapMinutes,
      },
      suggestedHandler,
      suggestedAction,
    };
  }

  private static findConflictFields(r1: ArchiveRecord, r2: ArchiveRecord): string[] {
    const conflicts: string[] = [];

    if (r1.transposition && r2.transposition) {
      const t1 = r1.transposition;
      const t2 = r2.transposition;
      
      if (t1.metronomeKey !== undefined && t2.metronomeKey !== undefined && 
          t1.metronomeKey !== t2.metronomeKey) {
        conflicts.push('transposition.metronomeKey');
      }
      if (t1.songListKey !== undefined && t2.songListKey !== undefined && 
          t1.songListKey !== t2.songListKey) {
        conflicts.push('transposition.songListKey');
      }
      if (t1.sheetMusicKey !== undefined && t2.sheetMusicKey !== undefined && 
          t1.sheetMusicKey !== t2.sheetMusicKey) {
        conflicts.push('transposition.sheetMusicKey');
      }
    }

    return conflicts;
  }

  static getSourceDescription(sourceType: SourceType): string {
    return SOURCE_LABELS[sourceType];
  }

  static getSourceDescriptions(types: SourceType[]): string {
    if (types.length === 0) return '无';
    return types.map(t => SOURCE_LABELS[t]).join('、');
  }

  static getHandlerName(r1: ArchiveRecord, r2: ArchiveRecord): string {
    const hasBackfilled1 = r1.sources.some(s => s.isBackfilled);
    const hasBackfilled2 = r2.sources.some(s => s.isBackfilled);

    if (hasBackfilled1 && !hasBackfilled2) {
      return r1.student.teacherInCharge;
    }
    if (hasBackfilled2 && !hasBackfilled1) {
      return r2.student.teacherInCharge;
    }

    const hasRevision1 = r1.changeType === 'revision';
    const hasRevision2 = r2.changeType === 'revision';
    if (hasRevision1 && !hasRevision2) {
      return r1.createdBy;
    }
    if (hasRevision2 && !hasRevision1) {
      return r2.createdBy;
    }

    return r1.student.teacherInCharge;
  }

  private static getSuggestedAction(
    r1: ArchiveRecord,
    r2: ArchiveRecord,
    conflictFields: string[],
    overlappingSources: SourceType[]
  ): string {
    const actions: string[] = [];
    
    const r1Sources = this.getSourceDescriptions(r1.sources.map(s => s.sourceType));
    const r2Sources = this.getSourceDescriptions(r2.sources.map(s => s.sourceType));
    
    actions.push(`记录1（${r1.createdBy}，${r1Sources}）与记录2（${r2.createdBy}，${r2Sources}）`);
    
    if (overlappingSources.length > 0) {
      actions.push(`都包含 ${this.getSourceDescriptions(overlappingSources)}，存在信息重叠`);
    }

    if (conflictFields.length > 0) {
      const fieldNames = conflictFields.map(f => this.translateFieldName(f)).join('、');
      actions.push(`在【${fieldNames}】上有冲突`);
    }

    const earlierRecord = r1.createdAt < r2.createdAt ? r1 : r2;
    const laterRecord = r1.createdAt < r2.createdAt ? r2 : r1;
    
    actions.push(`建议：联系${this.getHandlerName(r1, r2)}确认，以${laterRecord.createdBy}在${laterRecord.createdAt.toLocaleDateString()}的最新记录为准，`);
    const allSources = [...new Set([
      ...r1.sources.map(s => s.sourceType),
      ...r2.sources.map(s => s.sourceType),
    ])];
    actions.push(`合并两条记录的数据，保留${this.getSourceDescriptions(allSources)}的完整信息`);

    return actions.join('');
  }

  private static translateFieldName(field: string): string {
    const translations: Record<string, string> = {
      'transposition.metronomeKey': '节拍器转调',
      'transposition.songListKey': '选曲表转调',
      'transposition.sheetMusicKey': '曲谱PDF转调',
      'transposition': '转调',
    };
    return translations[field] || field;
  }

  static formatTimeGap(minutes: number): string {
    if (minutes < 60) {
      return `${minutes}分钟`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours < 24) {
      return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`;
    }
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    if (remainingHours === 0) {
      return `${days}天`;
    }
    return `${days}天${remainingHours}小时`;
  }
}
