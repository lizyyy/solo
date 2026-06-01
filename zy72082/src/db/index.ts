import Dexie, { type Table } from 'dexie'
import type {
  DataSource,
  UnifiedRecord,
  FieldMapping,
  UnitConversion,
  AllocationParams,
  AllocationResult,
  CalcStep,
  Conflict,
  ConflictResolution,
  AuditLogEntry,
} from '@/types'

class ColdChainDB extends Dexie {
  dataSources!: Table<DataSource>
  unifiedRecords!: Table<UnifiedRecord>
  fieldMappings!: Table<FieldMapping>
  unitConversions!: Table<UnitConversion>
  allocationParams!: Table<AllocationParams>
  allocationResults!: Table<AllocationResult>
  calcSteps!: Table<CalcStep>
  conflicts!: Table<Conflict>
  conflictResolutions!: Table<ConflictResolution>
  auditLog!: Table<AuditLogEntry>

  constructor() {
    super('ColdChainDB')
    this.version(1).stores({
      dataSources: '++id, type, importedAt',
      unifiedRecords: '++id, dataSourceId, standardFieldName, isAnomaly, routeId, warehouseId',
      fieldMappings: '++id, originalField, standardField',
      unitConversions: '++id, fromUnit, toUnit, version',
      allocationParams: '++id, versionLabel, createdAt',
      allocationResults: '++id, paramVersionId, calculatedAt, routeId',
      calcSteps: '++id, resultId, stepOrder',
      conflicts: '++id, conflictType, status',
      conflictResolutions: '++id, conflictId, resolvedAt',
      auditLog: '++id, category, timestamp',
    })
  }
}

export const db = new ColdChainDB()

export async function addAuditLog(
  category: AuditLogEntry['category'],
  action: string,
  detail: string,
  relatedId: string = ''
) {
  await db.auditLog.add({
    category,
    action,
    detail,
    relatedId,
    timestamp: new Date().toISOString(),
  })
}
