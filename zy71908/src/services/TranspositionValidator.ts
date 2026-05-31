import type { ArchiveRecord, SourceType, TranspositionValidationResult } from '../types';
import { KEY_NAMES, SOURCE_LABELS } from '../types';

export class TranspositionValidator {
  static validate(record: ArchiveRecord): TranspositionValidationResult {
    const { transposition, sources } = record;
    
    if (!transposition) {
      return {
        isSynced: false,
        mismatchedSources: sources.map(s => s.sourceType),
        expectedKey: -1,
        actualValues: {},
        humanMessage: '该记录还没有转调信息，请补充节拍器记录、选曲表或曲谱PDF中的任意一项',
      };
    }

    const actualValues: Partial<Record<SourceType, number>> = {};
    const presentSources: SourceType[] = [];
    const missingSources: SourceType[] = [];

    const allSourceTypes: SourceType[] = ['metronome', 'song_list', 'sheet_music'];
    const sourceTypeToKeyField: Record<SourceType, keyof typeof transposition> = {
      metronome: 'metronomeKey',
      song_list: 'songListKey',
      sheet_music: 'sheetMusicKey',
    };
    
    for (const sourceType of allSourceTypes) {
      const keyField = sourceTypeToKeyField[sourceType];
      const key = transposition[keyField] as number | undefined;
      if (key !== undefined && sources.some(s => s.sourceType === sourceType)) {
        actualValues[sourceType] = key;
        presentSources.push(sourceType);
      } else if (sources.some(s => s.sourceType === sourceType)) {
        missingSources.push(sourceType);
      }
    }

    if (presentSources.length === 0) {
      return {
        isSynced: false,
        mismatchedSources: allSourceTypes,
        expectedKey: -1,
        actualValues: {},
        humanMessage: '三个数据源都没有转调信息，请至少补充一个来源的转调数据',
      };
    }

    const values = Object.values(actualValues) as number[];
    const uniqueValues = [...new Set(values)];
    
    if (uniqueValues.length === 1 && missingSources.length === 0) {
      return {
        isSynced: true,
        mismatchedSources: [],
        expectedKey: uniqueValues[0],
        actualValues,
        humanMessage: `转调已同步，当前为${this.getHumanReadableKey(uniqueValues[0])}调`,
      };
    }

    const expectedKey = this.determineExpectedKey(actualValues, sources);
    const mismatchedSources: SourceType[] = [];

    for (const [sourceType, key] of Object.entries(actualValues)) {
      if (key !== expectedKey) {
        mismatchedSources.push(sourceType as SourceType);
      }
    }

    mismatchedSources.push(...missingSources);

    const humanMessage = this.buildHumanMessage(actualValues, missingSources, expectedKey, mismatchedSources);

    return {
      isSynced: false,
      mismatchedSources,
      expectedKey,
      actualValues,
      humanMessage,
    };
  }

  private static determineExpectedKey(
    actualValues: Partial<Record<SourceType, number>>,
    sources: ArchiveRecord['sources']
  ): number {
    const nonBackfilled = sources.filter(s => !s.isBackfilled);
    for (const s of nonBackfilled) {
      const key = actualValues[s.sourceType];
      if (key !== undefined) return key;
    }
    
    const values = Object.values(actualValues) as number[];
    const counts = new Map<number, number>();
    for (const v of values) {
      counts.set(v, (counts.get(v) || 0) + 1);
    }
    let maxCount = 0;
    let expectedKey = values[0];
    for (const [k, c] of counts) {
      if (c > maxCount) {
        maxCount = c;
        expectedKey = k;
      }
    }
    return expectedKey;
  }

  private static buildHumanMessage(
    actualValues: Partial<Record<SourceType, number>>,
    missingSources: SourceType[],
    expectedKey: number,
    mismatchedSources: SourceType[]
  ): string {
    const parts: string[] = [];
    
    for (const [sourceType, key] of Object.entries(actualValues)) {
      const label = SOURCE_LABELS[sourceType as SourceType];
      const keyName = this.getHumanReadableKey(key);
      const match = key === expectedKey ? '✓' : '✗';
      parts.push(`${match} ${label}：${keyName}调`);
    }

    for (const sourceType of missingSources) {
      const label = SOURCE_LABELS[sourceType];
      parts.push(`? ${label}：缺少数据`);
    }

    if (mismatchedSources.length > 0) {
      const mismatchLabels = mismatchedSources.map(s => SOURCE_LABELS[s]).join('、');
      parts.push(`\n问题：${mismatchLabels} 与其他来源不一致或缺失`);
      parts.push(`建议：请确认正确的转调应为 ${this.getHumanReadableKey(expectedKey)} 调，然后更新不一致的来源`);
    }

    return parts.join('\n');
  }

  static getHumanReadableKey(key: number): string {
    if (key < 0 || key >= KEY_NAMES.length) {
      return `未知(${key})`;
    }
    return KEY_NAMES[key];
  }

  static parseKeyName(keyName: string): number {
    const index = KEY_NAMES.indexOf(keyName.toUpperCase());
    return index >= 0 ? index : -1;
  }
}
