import { BaseImporter } from './baseImporter';
import { DataSource, RecordStatus, FaultStatus, LedgerRecord, Role } from '../models/types';
import { generateId, generateFactKey } from '../utils/crypto';
import { store } from '../store/fileStore';

export class PileAlarmImporter extends BaseImporter {
  protected sourceType: DataSource = DataSource.PILE_ALARM;
  protected requiredFields: string[] = ['pileId', 'alarmCode', 'alarmTime', 'alarmDescription'];

  protected async parseRow(row: Record<string, any>, rowNum: number): Promise<Record<string, any>> {
    const alarmTime = row.alarmTime ? new Date(row.alarmTime).toISOString() : new Date().toISOString();
    const recoverTime = row.recoverTime ? new Date(row.recoverTime).toISOString() : undefined;
    
    let faultDuration = 0;
    if (recoverTime) {
      faultDuration = Math.ceil((new Date(recoverTime).getTime() - new Date(alarmTime).getTime()) / 60000);
    }

    return {
      pileId: String(row.pileId),
      alarmCode: String(row.alarmCode),
      alarmLevel: (row.alarmLevel || 'warning') as 'info' | 'warning' | 'error' | 'critical',
      alarmTime,
      recoverTime,
      alarmDescription: String(row.alarmDescription || ''),
      faultDuration,
      area: row.area ? String(row.area) : undefined,
      handler: row.handler ? String(row.handler) : undefined
    };
  }

  protected getFactKey(parsed: Record<string, any>): string {
    return generateFactKey(parsed.pileId, parsed.alarmTime, parsed.alarmCode);
  }

  protected async createOrUpdateRecord(
    parsed: Record<string, any>, 
    evidenceId: string, 
    existingId?: string
  ): Promise<string> {
    const now = new Date().toISOString();

    if (existingId) {
      const existing = store.getRecord(existingId);
      if (existing) {
        if (!existing.evidences.includes(evidenceId)) {
          existing.evidences.push(evidenceId);
        }
        
        if (parsed.recoverTime && !existing.faultEndTime) {
          existing.faultEndTime = parsed.recoverTime;
          existing.faultDuration = Math.ceil(
            (new Date(parsed.recoverTime).getTime() - new Date(existing.faultStartTime).getTime()) / 60000
          );
          existing.faultStatus = FaultStatus.RESOLVED;
        }
        
        existing.updatedAt = now;
        existing.version += 1;
        
        store.saveRecord(existing);
        return existingId;
      }
    }

    const record: LedgerRecord = {
      id: generateId(),
      factKey: this.getFactKey(parsed),
      pileId: parsed.pileId,
      status: RecordStatus.DRAFT,
      faultStatus: parsed.recoverTime ? FaultStatus.RESOLVED : FaultStatus.PENDING,
      faultStartTime: parsed.alarmTime,
      faultEndTime: parsed.recoverTime,
      faultDuration: parsed.faultDuration || 0,
      faultType: parsed.alarmCode,
      faultDescription: parsed.alarmDescription,
      handler: parsed.handler,
      handlerRole: parsed.handler ? Role.OPERATOR : undefined,
      area: parsed.area,
      evidences: [evidenceId],
      changeLogs: [],
      createdAt: now,
      updatedAt: now,
      isManuallyModified: false,
      sensitiveFields: ['handler'],
      version: 1
    };

    store.saveRecord(record);
    return record.id;
  }
}
