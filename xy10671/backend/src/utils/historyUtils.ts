import { ChangeHistory } from '../models';

export async function recordChangeHistory(
  projectId: string,
  entityType: string,
  entityId: string,
  fieldName: string,
  oldValue: any,
  newValue: any,
  changedBy: string
): Promise<void> {
  if (oldValue === newValue) return;
  
  await ChangeHistory.create({
    projectId,
    entityType,
    entityId,
    fieldName,
    oldValue: oldValue?.toString() || null,
    newValue: newValue?.toString() || null,
    changedBy
  });
}

export async function recordMultipleChanges(
  projectId: string,
  entityType: string,
  entityId: string,
  changes: Array<{ fieldName: string; oldValue: any; newValue: any }>,
  changedBy: string
): Promise<void> {
  const records = changes
    .filter(c => c.oldValue !== c.newValue)
    .map(c => ({
      projectId,
      entityType,
      entityId,
      fieldName: c.fieldName,
      oldValue: c.oldValue?.toString() || null,
      newValue: c.newValue?.toString() || null,
      changedBy
    }));
  
  if (records.length > 0) {
    await ChangeHistory.bulkCreate(records);
  }
}
