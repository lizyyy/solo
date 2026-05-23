import { BaseImporter } from './baseImporter';
import { DataSource, RecordStatus, FaultStatus, LedgerRecord, Role } from '../models/types';
import { generateId, generateFactKey } from '../utils/crypto';
import { store } from '../store/fileStore';

export class InspectionImporter extends BaseImporter {
  protected sourceType: DataSource = DataSource.INSPECTION_FORM;
  protected requiredFields: string[] = ['inspectionId', 'pileId', 'inspector', 'inspectionTime'];

  protected async parseRow(row: Record<string, any>, rowNum: number): Promise<Record<string, any>> {
    const inspectionTime = row.inspectionTime ? new Date(row.inspectionTime).toISOString() : new Date().toISOString();
    
    const inspectionItems = row.inspectionItems 
      ? String(row.inspectionItems).split(/[,，]/).map(s => s.trim()).filter(Boolean)
      : [];
    
    const foundIssues = row.foundIssues
      ? String(row.foundIssues).split(/[,，]/).map(s => s.trim()).filter(Boolean)
      : [];

    return {
      inspectionId: String(row.inspectionId),
      pileId: String(row.pileId),
      inspector: String(row.inspector),
      inspectionTime,
      inspectionItems,
      foundIssues,
      status: (row.status || 'normal') as 'normal' | 'needs_repair' | 'critical',
      area: row.area ? String(row.area) : undefined,
      remark: row.remark ? String(row.remark) : ''
    };
  }

  protected getFactKey(parsed: Record<string, any>): string {
    return generateFactKey(parsed.pileId, parsed.inspectionTime, 'inspection');
  }

  protected async createOrUpdateRecord(
    parsed: Record<string, any>, 
    evidenceId: string, 
    existingId?: string
  ): Promise<string> {
    const now = new Date().toISOString();
    const hasIssues = parsed.foundIssues && parsed.foundIssues.length > 0;

    if (existingId) {
      const existing = store.getRecord(existingId);
      if (existing) {
        if (!existing.evidences.includes(evidenceId)) {
          existing.evidences.push(evidenceId);
        }
        
        if (hasIssues && existing.faultStatus === FaultStatus.PENDING) {
          existing.faultDescription = existing.faultDescription 
            ? `${existing.faultDescription}; 巡检发现: ${parsed.foundIssues.join(', ')}`
            : `巡检发现: ${parsed.foundIssues.join(', ')}`;
        }
        
        existing.updatedAt = now;
        existing.version += 1;
        
        store.saveRecord(existing);
        return existingId;
      }
    }

    if (!hasIssues) {
      const record: LedgerRecord = {
        id: generateId(),
        factKey: this.getFactKey(parsed),
        pileId: parsed.pileId,
        status: RecordStatus.DRAFT,
        faultStatus: FaultStatus.FALSE_ALARM,
        faultStartTime: parsed.inspectionTime,
        faultDuration: 0,
        faultType: 'inspection_normal',
        faultDescription: `巡检正常, 检查项目: ${parsed.inspectionItems.join(', ') || '无'}`,
        handler: parsed.inspector,
        handlerRole: Role.OPERATOR,
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

    const record: LedgerRecord = {
      id: generateId(),
      factKey: this.getFactKey(parsed),
      pileId: parsed.pileId,
      status: RecordStatus.DRAFT,
      faultStatus: FaultStatus.PENDING,
      faultStartTime: parsed.inspectionTime,
      faultDuration: 0,
      faultType: 'inspection_found',
      faultDescription: `巡检发现问题: ${parsed.foundIssues.join(', ')}`,
      handler: parsed.inspector,
      handlerRole: Role.OPERATOR,
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
