import { CableRecord, ImportConflict, DataSource } from '@/types';
import { isRecordFlipped } from './coordinateUtils';
import { findSourceById } from '@/data/mockSources';
import { findPersonById } from '@/data/mockPersons';

export function detectDuplicates(
  incoming: Partial<CableRecord>[],
  existing: CableRecord[],
  currentSource?: DataSource
): ImportConflict[] {
  const conflicts: ImportConflict[] = [];

  incoming.forEach((row, index) => {
    if (!row.cableNo || !row.cabinet || !row.startPoint || !row.endPoint) {
      conflicts.push({
        rowIndex: index,
        incomingData: row,
        conflictType: 'invalid_data',
        suggestedAction: 'skip',
        humanMessage: `第 ${index + 1} 行数据不完整`,
        nextStep: '请检查必填项是否填写完整',
      });
      return;
    }

    const exactMatch = existing.find(
      r =>
        r.cableNo === row.cableNo &&
        r.cabinet === row.cabinet &&
        r.startPoint.x === row.startPoint?.x &&
        r.startPoint.y === row.startPoint?.y &&
        r.endPoint.x === row.endPoint?.x &&
        r.endPoint.y === row.endPoint?.y
    );

    const sameCabinetMatch = existing.find(
      r => r.cableNo === row.cableNo && r.cabinet === row.cabinet
    );

    const flippedMatch = existing.find(
      r => r.cableNo === row.cableNo && isRecordFlipped(r, row as CableRecord)
    );

    if (exactMatch) {
      const sourceInfo = currentSource || findSourceById(exactMatch.sourceId);
      const contactPerson = findPersonById(exactMatch.ownerId);
      conflicts.push({
        rowIndex: index,
        incomingData: row,
        existingRecord: exactMatch,
        conflictType: 'duplicate',
        sourceInfo,
        suggestedAction: 'skip',
        humanMessage: `${row.cableNo} 在 ${row.cabinet} 机柜已存在完全相同的记录`,
        nextStep: `数据来自${sourceInfo ? sourceInfo.uploader : '未知用户'}，请确认是否重复导入`,
        contactPerson,
      });
    } else if (flippedMatch) {
      const sourceInfo = currentSource || findSourceById(flippedMatch.sourceId);
      const contactPerson = findPersonById(flippedMatch.ownerId);
      conflicts.push({
        rowIndex: index,
        incomingData: row,
        existingRecord: flippedMatch,
        conflictType: 'coordinate_flipped',
        sourceInfo,
        suggestedAction: 'keep',
        humanMessage: `${row.cableNo} 的坐标与现有记录符号相反，可能坐标轴被翻转`,
        nextStep: `建议联系 ${contactPerson?.name || '负责人'} 确认实际走向`,
        contactPerson,
      });
    } else if (sameCabinetMatch) {
      const sourceInfo = currentSource || findSourceById(sameCabinetMatch.sourceId);
      const contactPerson = findPersonById(sameCabinetMatch.ownerId);
      conflicts.push({
        rowIndex: index,
        incomingData: row,
        existingRecord: sameCabinetMatch,
        conflictType: 'duplicate',
        sourceInfo,
        suggestedAction: 'merge',
        humanMessage: `${row.cableNo} 在 ${row.cabinet} 机柜已有记录，但坐标不同`,
        nextStep: '可能是线缆走向有更新，请确认哪条是正确的',
        contactPerson,
      });
    }
  });

  return conflicts;
}

export function detectBatchConflicts(
  incoming: Partial<CableRecord>[],
  existing: CableRecord[]
): { hasDuplicates: boolean; hasFlipped: boolean; hasInvalid: boolean; conflicts: ImportConflict[] } {
  const conflicts = detectDuplicates(incoming, existing);
  return {
    conflicts,
    hasDuplicates: conflicts.some(c => c.conflictType === 'duplicate'),
    hasFlipped: conflicts.some(c => c.conflictType === 'coordinate_flipped'),
    hasInvalid: conflicts.some(c => c.conflictType === 'invalid_data'),
  };
}
