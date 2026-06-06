import {
  Remittance,
  RemittanceDiff,
  VersionCompareResult,
  FieldDiff,
  RemittanceStatus
} from '../types';

const compareFields = (oldObj: Record<string, unknown>, newObj: Record<string, unknown>, excludeFields: string[] = []): FieldDiff[] => {
  const diffs: FieldDiff[] = [];
  const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);

  for (const key of allKeys) {
    if (excludeFields.includes(key)) continue;

    const oldVal = oldObj[key];
    const newVal = newObj[key];

    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      diffs.push({
        field: key,
        oldValue: oldVal,
        newValue: newVal
      });
    }
  }

  return diffs;
};

export const compareVersions = (
  versionA: { id: string; remittances: Remittance[] },
  versionB: { id: string; remittances: Remittance[] }
): VersionCompareResult => {
  const diffs: RemittanceDiff[] = [];

  const mapA = new Map(versionA.remittances.map(r => [r.transactionId, r]));
  const mapB = new Map(versionB.remittances.map(r => [r.transactionId, r]));

  const allTransactionIds = new Set([...mapA.keys(), ...mapB.keys()]);

  for (const txnId of allTransactionIds) {
    const oldR = mapA.get(txnId);
    const newR = mapB.get(txnId);

    if (!oldR && newR) {
      diffs.push({
        transactionId: txnId,
        diffType: 'added',
        newRemittance: newR
      });
    } else if (oldR && !newR) {
      diffs.push({
        transactionId: txnId,
        diffType: 'removed',
        oldRemittance: oldR
      });
    } else if (oldR && newR) {
      if (oldR.status !== newR.status) {
        diffs.push({
          transactionId: txnId,
          diffType: 'status_changed',
          oldStatus: oldR.status as RemittanceStatus,
          newStatus: newR.status as RemittanceStatus,
          oldRemittance: oldR,
          newRemittance: newR
        });
      } else {
        const fieldDiffs = compareFields(
          oldR as unknown as Record<string, unknown>,
          newR as unknown as Record<string, unknown>,
          ['id', 'status', 'createdAt', 'updatedAt']
        );
        if (fieldDiffs.length > 0) {
          diffs.push({
            transactionId: txnId,
            diffType: 'modified',
            fieldDiffs,
            oldRemittance: oldR,
            newRemittance: newR
          });
        }
      }
    }
  }

  return {
    versionA: versionA.id,
    versionB: versionB.id,
    totalDiffs: diffs.length,
    addedCount: diffs.filter(d => d.diffType === 'added').length,
    removedCount: diffs.filter(d => d.diffType === 'removed').length,
    modifiedCount: diffs.filter(d => d.diffType === 'modified').length,
    statusChangedCount: diffs.filter(d => d.diffType === 'status_changed').length,
    diffs
  };
};
