import { BeatRecord, DataSource, FriendlyError, MismatchRecord, MismatchType, ValidationResult } from '../types';
import { generateFriendlyMessage, getFieldName, getHandlerSuggestion } from '../utils/friendlyMessages';
import { generateId } from '../utils/mockData';

export class ValidationService {
  validateRecord(record: Partial<BeatRecord>, allRecords: BeatRecord[]): ValidationResult {
    const errors: FriendlyError[] = [];
    const warnings: FriendlyError[] = [];

    if (!record.studentId) {
      errors.push(this.createError('FIELD_REQUIRED', { fieldName: getFieldName('studentId') }, 'studentId', 'error'));
    }

    if (!record.rehearsalDate) {
      errors.push(this.createError('FIELD_REQUIRED', { fieldName: getFieldName('rehearsalDate') }, 'rehearsalDate', 'error'));
    }

    if (record.measureStart === undefined || record.measureStart === null) {
      errors.push(this.createError('FIELD_REQUIRED', { fieldName: getFieldName('measureStart') }, 'measureStart', 'error'));
    } else if (record.measureStart <= 0) {
      errors.push(this.createError('INVALID_MEASURE', { measure: record.measureStart }, 'measureStart', 'error'));
    }

    if (record.measureEnd === undefined || record.measureEnd === null) {
      errors.push(this.createError('FIELD_REQUIRED', { fieldName: getFieldName('measureEnd') }, 'measureEnd', 'error'));
    } else if (record.measureEnd <= 0) {
      errors.push(this.createError('INVALID_MEASURE', { measure: record.measureEnd }, 'measureEnd', 'error'));
    }

    if (record.tempo === undefined || record.tempo === null) {
      errors.push(this.createError('FIELD_REQUIRED', { fieldName: getFieldName('tempo') }, 'tempo', 'error'));
    } else if (record.tempo < 40 || record.tempo > 200) {
      warnings.push(this.createError('INVALID_TEMPO', { tempo: record.tempo }, 'tempo', 'warning'));
    }

    if (!record.source) {
      errors.push(this.createError('FIELD_REQUIRED', { fieldName: getFieldName('source') }, 'source', 'error'));
    }

    if (record.measureStart !== undefined && record.measureEnd !== undefined) {
      if (record.measureStart > record.measureEnd) {
        errors.push(this.createError(
          'MEASURE_REVERSED',
          { start: record.measureStart, end: record.measureEnd },
          'measureStart',
          'error'
        ));
      }
    }

    const duplicates = this.detectDuplicates(record as BeatRecord, allRecords);
    warnings.push(...duplicates);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  detectDuplicates(newRecord: BeatRecord, allRecords: BeatRecord[]): FriendlyError[] {
    if (!newRecord.studentId || !newRecord.rehearsalDate) return [];

    return allRecords
      .filter((r) => r.id !== newRecord.id)
      .filter((r) => r.studentId === newRecord.studentId)
      .filter((r) => r.rehearsalDate === newRecord.rehearsalDate)
      .filter((r) => {
        const overlap =
          newRecord.measureStart <= r.measureEnd && newRecord.measureEnd >= r.measureStart;
        return overlap;
      })
      .map((r) => this.createError(
        'RECORD_DUPLICATE',
        { start: r.measureStart, end: r.measureEnd },
        undefined,
        'warning',
        r.id
      ));
  }

  detectMismatch(record: BeatRecord): MismatchRecord | null {
    if (record.measureStart > record.measureEnd) {
      return {
        id: generateId(),
        recordId: record.id,
        mismatchType: MismatchType.REVERSED,
        source: record.source,
        description: `小节号 ${record.measureStart}-${record.measureEnd} 写反了`,
        suggestedHandler: getHandlerSuggestion(MismatchType.REVERSED),
        status: 'pending',
        detectedAt: new Date().toISOString(),
      };
    }

    return null;
  }

  detectDiscontinuous(records: BeatRecord[], studentId: string, date: string): FriendlyError[] {
    const studentRecords = records
      .filter((r) => r.studentId === studentId && r.rehearsalDate === date)
      .sort((a, b) => a.measureStart - b.measureStart);

    const errors: FriendlyError[] = [];

    for (let i = 0; i < studentRecords.length - 1; i++) {
      const current = studentRecords[i];
      const next = studentRecords[i + 1];

      if (next.measureStart > current.measureEnd + 1) {
        const gap = next.measureStart - current.measureEnd - 1;
        errors.push(this.createError(
          'MEASURE_DISCONTINUOUS',
          {
            prevEnd: current.measureEnd,
            nextStart: next.measureStart,
            gap,
          },
          undefined,
          'warning',
          next.id
        ));
      }
    }

    return errors;
  }

  private createError(
    errorCode: string,
    context: Record<string, string | number>,
    field?: string,
    level: 'error' | 'warning' | 'info' = 'error',
    relatedRecordId?: string
  ): FriendlyError {
    const { message, suggestion } = generateFriendlyMessage(errorCode, context);
    return {
      id: `err-${generateId()}`,
      level,
      message,
      suggestion,
      field,
      relatedRecordId,
    };
  }

  autoCorrectMeasureReversed(record: BeatRecord): BeatRecord {
    if (record.measureStart > record.measureEnd) {
      return {
        ...record,
        measureStart: record.measureEnd,
        measureEnd: record.measureStart,
      };
    }
    return record;
  }

  getSourceLabel(source: DataSource): string {
    const labels: Record<DataSource, string> = {
      [DataSource.METRONOME]: '节拍器',
      [DataSource.MUSIC_SHEET]: '选曲表',
      [DataSource.MANUAL]: '手工录入',
    };
    return labels[source];
  }
}

export const validationService = new ValidationService();
