function detectCrossSetItems(records) {
  const itemMap = new Map();

  records.forEach(record => {
    const key = record['装备编号'];
    if (!itemMap.has(key)) {
      itemMap.set(key, []);
    }
    itemMap.get(key).push(record);
  });

  const crossSetItems = [];
  itemMap.forEach((items, equipmentId) => {
    const sets = new Set(items.map(i => i['所属套装']).filter(s => s));
    if (sets.size > 1) {
      crossSetItems.push({
        equipmentId,
        equipmentName: items[0]['装备名称'],
        sets: Array.from(sets),
        records: items
      });
    }
  });

  return crossSetItems;
}

function detectHandwrittenNotes(records) {
  const HANDWRITTEN_KEYWORDS = ['手写', '手工', '笔写', '标注', '补', '加', '改'];
  
  return records.filter(record => {
    const note = record['备注'] || '';
    return HANDWRITTEN_KEYWORDS.some(keyword => note.includes(keyword));
  });
}

function detectDuplicateRecords(records) {
  const seen = new Map();
  const duplicates = [];

  records.forEach(record => {
    const key = `${record['装备编号']}-${record['所属套装']}-${record['数量']}`;
    if (seen.has(key)) {
      duplicates.push({
        record,
        original: seen.get(key)
      });
    } else {
      seen.set(key, record);
    }
  });

  return duplicates;
}

function detectInvalidStatus(records) {
  const VALID_STATUSES = ['在库', '借出', '维修', '报废', '盘点中'];
  
  return records.filter(record => {
    const status = record['状态'] || '';
    return !VALID_STATUSES.includes(status);
  });
}

function detectInvalidQuantity(records) {
  return records.filter(record => {
    const qty = parseInt(record['数量']);
    return isNaN(qty) || qty < 0;
  });
}

function validateInventory(records) {
  const crossSetItems = detectCrossSetItems(records);
  const handwrittenNotes = detectHandwrittenNotes(records);
  const duplicateRecords = detectDuplicateRecords(records);
  const invalidStatus = detectInvalidStatus(records);
  const invalidQuantity = detectInvalidQuantity(records);

  const normalRecords = records.filter(record => {
    const hasCrossSet = crossSetItems.some(c => 
      c.records.some(r => r.lineNumber === record.lineNumber)
    );
    const hasHandwritten = handwrittenNotes.some(r => r.lineNumber === record.lineNumber);
    const hasDuplicate = duplicateRecords.some(d => d.record.lineNumber === record.lineNumber);
    const hasInvalidStatus = invalidStatus.some(r => r.lineNumber === record.lineNumber);
    const hasInvalidQty = invalidQuantity.some(r => r.lineNumber === record.lineNumber);

    return !hasCrossSet && !hasHandwritten && !hasDuplicate && !hasInvalidStatus && !hasInvalidQty;
  });

  return {
    normal: normalRecords,
    issues: {
      crossSetItems,
      handwrittenNotes,
      duplicateRecords,
      invalidStatus,
      invalidQuantity
    },
    stats: {
      total: records.length,
      normal: normalRecords.length,
      issuesCount: {
        crossSetItems: crossSetItems.length,
        handwrittenNotes: handwrittenNotes.length,
        duplicateRecords: duplicateRecords.length,
        invalidStatus: invalidStatus.length,
        invalidQuantity: invalidQuantity.length
      }
    }
  };
}

module.exports = {
  detectCrossSetItems,
  detectHandwrittenNotes,
  detectDuplicateRecords,
  detectInvalidStatus,
  detectInvalidQuantity,
  validateInventory
};
