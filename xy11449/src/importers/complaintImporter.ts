import { BaseImporter } from './baseImporter';
import { DataSource, RecordStatus, FaultStatus, LedgerRecord, Role } from '../models/types';
import { generateId, generateFactKey } from '../utils/crypto';
import { store } from '../store/fileStore';

export class ComplaintImporter extends BaseImporter {
  protected sourceType: DataSource = DataSource.CUSTOMER_COMPLAINT;
  protected requiredFields: string[] = ['complaintId', 'pileId', 'complaintType', 'complaintTime'];

  protected async parseRow(row: Record<string, any>, rowNum: number): Promise<Record<string, any>> {
    const complaintTime = row.complaintTime ? new Date(row.complaintTime).toISOString() : new Date().toISOString();

    return {
      complaintId: String(row.complaintId),
      pileId: String(row.pileId),
      customerId: String(row.customerId || ''),
      complaintType: String(row.complaintType),
      complaintTime,
      description: String(row.description || ''),
      handler: row.handler ? String(row.handler) : undefined,
      area: row.area ? String(row.area) : undefined
    };
  }

  protected getFactKey(parsed: Record<string, any>): string {
    return generateFactKey(parsed.pileId, parsed.complaintTime, parsed.complaintType);
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
        
        if (parsed.description && !existing.faultDescription.includes(parsed.description)) {
          existing.faultDescription = `${existing.faultDescription}; 客户投诉: ${parsed.description}`;
        }
        
        if (parsed.handler && !existing.handler) {
          existing.handler = parsed.handler;
          existing.handlerRole = Role.OPERATOR;
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
      faultStatus: FaultStatus.PENDING,
      faultStartTime: parsed.complaintTime,
      faultDuration: 0,
      faultType: `complaint_${parsed.complaintType}`,
      faultDescription: `客户投诉: ${parsed.description || parsed.complaintType}`,
      handler: parsed.handler,
      handlerRole: parsed.handler ? Role.OPERATOR : undefined,
      area: parsed.area,
      evidences: [evidenceId],
      changeLogs: [],
      createdAt: now,
      updatedAt: now,
      isManuallyModified: false,
      sensitiveFields: ['handler', 'processor'],
      version: 1
    };

    store.saveRecord(record);
    return record.id;
  }
}
