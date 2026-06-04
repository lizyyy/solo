import { db, saveDb } from '../data/db.js';
import type { ChangeRecord } from '../../shared/types.js';
import crypto from 'crypto';

export async function recordChange(
  entityType: ChangeRecord['entityType'],
  entityId: string,
  fieldName: string,
  oldValue: any,
  newValue: any,
  changeReason: string,
  changedBy: string,
  affectedResults: string[] = []
): Promise<ChangeRecord> {
  if (JSON.stringify(oldValue) === JSON.stringify(newValue)) {
    return {} as ChangeRecord;
  }

  const record: ChangeRecord = {
    id: `change-${crypto.randomUUID().slice(0, 8)}`,
    entityType,
    entityId,
    fieldName,
    oldValue,
    newValue,
    changeReason,
    changedBy,
    changedAt: new Date().toISOString(),
    affectedResults,
  };

  db.data.changeRecords.unshift(record);
  await saveDb();

  return record;
}

export async function getChangeHistory(entityType?: ChangeRecord['entityType'], entityId?: string) {
  await db.read();
  let records = [...db.data.changeRecords];

  if (entityType) {
    records = records.filter((r) => r.entityType === entityType);
  }
  if (entityId) {
    records = records.filter((r) => r.entityId === entityId);
  }

  return records.sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime());
}

export async function getChangeImpact(changeId: string) {
  await db.read();
  const change = db.data.changeRecords.find((r) => r.id === changeId);
  if (!change) return null;

  const affectedCalcs = db.data.calculations.filter((c) =>
    change.affectedResults.includes(c.id)
  );

  return {
    change,
    affectedCalculations: affectedCalcs.map((c) => ({
      id: c.id,
      name: c.name,
      oldRiskScore: c.riskScore,
      newRiskScore: c.riskScore,
    })),
  };
}

export async function compareVersions(entityType: ChangeRecord['entityType'], entityId: string) {
  await db.read();
  const records = db.data.changeRecords
    .filter((r) => r.entityType === entityType && r.entityId === entityId)
    .sort((a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime());

  if (records.length === 0) return null;

  const changes = records.map((r) => ({
    field: r.fieldName,
    oldValue: r.oldValue,
    newValue: r.newValue,
    reason: r.changeReason,
    changedBy: r.changedBy,
    changedAt: r.changedAt,
  }));

  return changes;
}
