import crypto from 'crypto';
import { startOfDay, endOfDay, addDays, differenceInMinutes, format } from 'date-fns';

class LogProcessor {
  constructor(config) {
    this.config = config;
    this.processedHashes = new Set();
  }

  process(records) {
    let processedRecords = [...records];

    const crossDayRecords = this.detectCrossDayRecords(processedRecords);
    const retransmittedRecords = this.detectRetransmission(processedRecords);
    const deduplicatedRecords = this.deduplicate(processedRecords);

    processedRecords = deduplicatedRecords.records;

    this.addAuditInfo(processedRecords);

    return {
      records: processedRecords,
      crossDayRecords: crossDayRecords,
      retransmittedRecords: retransmittedRecords,
      deduplicatedRecords: deduplicatedRecords.removed,
      stats: {
        total: records.length,
        afterDeduplication: processedRecords.length,
        crossDayCount: crossDayRecords.length,
        retransmittedCount: retransmittedRecords.length,
        deduplicatedCount: deduplicatedRecords.removed.length
      }
    };
  }

  detectCrossDayRecords(records) {
    if (!this.config.rules.crossDay.enabled) {
      return [];
    }

    const crossDayRecords = [];
    const maxDuration = this.config.rules.crossDay.maxDurationHours * 60;

    const grouped = this.groupByEmployeeAndRoom(records);

    for (const key in grouped) {
      const groupRecords = grouped[key].sort((a, b) => a.accessTime - b.accessTime);
      
      for (let i = 0; i < groupRecords.length - 1; i++) {
        const current = groupRecords[i];
        const next = groupRecords[i + 1];

        const duration = differenceInMinutes(next.accessTime, current.accessTime);

        if (duration > 0 && duration <= maxDuration) {
          const currentDay = startOfDay(current.accessTime);
          const nextDay = startOfDay(next.accessTime);
          
          if (nextDay > currentDay) {
            crossDayRecords.push({
              ...current,
              crossDayInfo: {
                pairedRecord: this.generateRecordHash(next),
                durationMinutes: duration,
                crossDays: Math.floor(duration / 1440) + 1
              }
            });
          }
        }
      }
    }

    return crossDayRecords;
  }

  detectRetransmission(records) {
    if (!this.config.rules.retransmission.enabled) {
      return [];
    }

    const retransmittedRecords = [];
    const timeWindow = this.config.rules.retransmission.timeWindowMinutes;
    const threshold = this.config.rules.retransmission.similarityThreshold;

    const sortedRecords = [...records].sort((a, b) => a.accessTime - b.accessTime);

    for (let i = 0; i < sortedRecords.length; i++) {
      const current = sortedRecords[i];
      
      for (let j = i + 1; j < sortedRecords.length; j++) {
        const next = sortedRecords[j];
        const diffMinutes = differenceInMinutes(next.accessTime, current.accessTime);

        if (diffMinutes > timeWindow) {
          break;
        }

        const similarity = this.calculateSimilarity(current, next);

        if (similarity >= threshold) {
          retransmittedRecords.push({
            ...next,
            retransmissionInfo: {
              originalRecord: this.generateRecordHash(current),
              originalTime: format(current.accessTime, 'yyyy-MM-dd HH:mm:ss'),
              timeDiffMinutes: diffMinutes,
              similarity: similarity.toFixed(2)
            }
          });
        }
      }
    }

    return retransmittedRecords;
  }

  deduplicate(records) {
    if (!this.config.rules.deduplication.enabled) {
      return { records, removed: [] };
    }

    const keyFields = this.config.rules.deduplication.keyFields;
    const seen = new Set();
    const uniqueRecords = [];
    const removedRecords = [];

    for (const record of records) {
      const hash = this.generateDeduplicationHash(record, keyFields);

      if (seen.has(hash) || this.processedHashes.has(hash)) {
        removedRecords.push({
          ...record,
          duplicateInfo: {
            hash: hash,
            duplicateFields: keyFields.join(', ')
          }
        });
      } else {
        seen.add(hash);
        this.processedHashes.add(hash);
        uniqueRecords.push(record);
      }
    }

    return { records: uniqueRecords, removed: removedRecords };
  }

  groupByEmployeeAndRoom(records) {
    const groups = {};

    for (const record of records) {
      const key = `${record.employeeId}_${record.roomId}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(record);
    }

    return groups;
  }

  calculateSimilarity(record1, record2) {
    let sameFields = 0;
    let totalFields = 0;

    const compareFields = ['employeeId', 'roomId', 'accessType', 'deviceId'];

    for (const field of compareFields) {
      if (record1[field] || record2[field]) {
        totalFields++;
        if (record1[field] === record2[field]) {
          sameFields++;
        }
      }
    }

    return totalFields > 0 ? sameFields / totalFields : 0;
  }

  generateRecordHash(record) {
    const keyFields = this.config.rules.deduplication.keyFields;
    return this.generateDeduplicationHash(record, keyFields);
  }

  generateDeduplicationHash(record, keyFields) {
    const data = keyFields.map(field => {
      if (field === 'accessTime' && record.accessTime instanceof Date) {
        return format(record.accessTime, 'yyyy-MM-dd HH:mm:ss');
      }
      return String(record[field] || '');
    }).join('|');

    return crypto.createHash(this.config.rules.deduplication.hashAlgorithm).update(data).digest('hex');
  }

  addAuditInfo(records) {
    for (const record of records) {
      record.auditTime = new Date();
      record.recordHash = this.generateRecordHash(record);
      record.accessDate = format(record.accessTime, 'yyyy-MM-dd');
      record.accessTimeStr = format(record.accessTime, 'yyyy-MM-dd HH:mm:ss');
    }
  }

  loadProcessedHashes(hashes) {
    this.processedHashes = new Set(hashes);
  }

  getProcessedHashes() {
    return Array.from(this.processedHashes);
  }
}

export default LogProcessor;
