const OUTPUT_COLUMNS = [
  '配方名称',
  '产品编码',
  '原料名称',
  '原料编码',
  '基准用量',
  '基准单位',
  '换算比例',
  '换算后用量',
  '换算后单位',
  '订单份数',
  '备注'
];

function normalizeUnit(quantity, unit) {
  const q = parseFloat(quantity);
  const u = unit.trim().toLowerCase();
  
  if (u === 'kg' || u === '公斤' || u === '千克') {
    return { quantity: q * 1000, unit: '克' };
  }
  if (u === 'g' || u === '克') {
    return { quantity: q, unit: '克' };
  }
  return { quantity: q, unit };
}

function convertToReadableUnit(grams) {
  if (grams >= 1000) {
    return { quantity: (grams / 1000).toFixed(3), unit: '公斤' };
  }
  return { quantity: grams.toFixed(1), unit: '克' };
}

function convertRecipe(row, scaleFactor, orderPortions) {
  const normalized = normalizeUnit(row['基准用量'], row['基准单位'] || '克');
  const scaledGrams = normalized.quantity * scaleFactor * orderPortions;
  const readable = convertToReadableUnit(scaledGrams);
  
  return {
    '配方名称': row['配方名称'] || '',
    '产品编码': row['产品编码'] || '',
    '原料名称': row['原料名称'] || '',
    '原料编码': row['原料编码'] || '',
    '基准用量': parseFloat(row['基准用量']) || 0,
    '基准单位': row['基准单位'] || '克',
    '换算比例': scaleFactor,
    '换算后用量': parseFloat(readable.quantity),
    '换算后单位': readable.unit,
    '订单份数': orderPortions,
    '备注': row['备注'] || ''
  };
}

function isHalfOrder(portions) {
  const p = parseFloat(portions);
  return p === 0.5 || (p % 1 !== 0 && p < 1);
}

function separateResults(rows, scaleFactor, orderPortions) {
  const normal = [];
  const halfOrder = [];
  const mixedUnit = [];
  
  rows.forEach(row => {
    const converted = convertRecipe(row, scaleFactor, orderPortions);
    
    const originalUnit = (row['基准单位'] || '克').trim().toLowerCase();
    const hasMixedUnit = ['kg', '公斤', '千克'].includes(originalUnit);
    
    if (hasMixedUnit) {
      mixedUnit.push(converted);
    }
    
    if (isHalfOrder(orderPortions)) {
      halfOrder.push(converted);
    } else {
      normal.push(converted);
    }
  });
  
  return { normal, halfOrder, mixedUnit };
}

function formatForMachine(rows) {
  return rows.map(row => {
    const obj = {};
    OUTPUT_COLUMNS.forEach(col => {
      obj[col] = row[col];
    });
    return obj;
  });
}

function formatSummary(rows, scaleFactor, orderPortions) {
  const totalRows = rows.length;
  const uniqueRecipes = new Set(rows.map(r => r['配方名称'])).size;
  const totalWeight = rows.reduce((sum, r) => {
    const normalized = normalizeUnit(r['换算后用量'], r['换算后单位']);
    return sum + normalized.quantity;
  }, 0);
  
  return {
    '配方总数': uniqueRecipes,
    '原料行数': totalRows,
    '换算比例': scaleFactor,
    '订单份数': orderPortions,
    '总重量(克)': totalWeight.toFixed(1),
    '总重量(公斤)': (totalWeight / 1000).toFixed(3)
  };
}

module.exports = {
  OUTPUT_COLUMNS,
  convertRecipe,
  separateResults,
  formatForMachine,
  formatSummary,
  normalizeUnit,
  convertToReadableUnit,
  isHalfOrder
};
