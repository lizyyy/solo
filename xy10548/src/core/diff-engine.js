function makeKey(item) {
  return `${item.sku}||${item.location}`;
}

function groupByKey(items) {
  const map = {};
  for (const item of items) {
    const key = makeKey(item);
    if (!map[key]) {
      map[key] = [];
    }
    map[key].push(item);
  }
  return map;
}

function sumQuantity(items) {
  return items.reduce((sum, item) => sum + (item.quantity || 0), 0);
}

function detectDuplicateScans(scans) {
  const byKey = groupByKey(scans);
  const duplicates = [];
  
  for (const [key, items] of Object.entries(byKey)) {
    if (items.length > 1) {
      duplicates.push({
        key,
        sku: items[0].sku,
        location: items[0].location,
        count: items.length,
        totalQuantity: sumQuantity(items),
        items: items.map(item => ({
          scanTime: item.scanTime,
          quantity: item.quantity,
          operator: item.operator
        }))
      });
    }
  }
  
  return duplicates;
}

function isLocationFrozen(location, freezes, checkTime) {
  const freeze = freezes.find(f => f.location === location);
  if (!freeze) return false;
  
  const freezeTime = new Date(freeze.freezeTime).getTime();
  const checkT = checkTime ? new Date(checkTime).getTime() : Date.now();
  
  if (freeze.unfreezeTime) {
    const unfreezeTime = new Date(freeze.unfreezeTime).getTime();
    return checkT >= freezeTime && checkT < unfreezeTime;
  }
  
  return checkT >= freezeTime;
}

function detectUnfrozenLocationChanges(scans, freezes, bookItems) {
  const issues = [];
  
  for (const scan of scans) {
    const frozen = isLocationFrozen(scan.location, freezes, scan.scanTime);
    
    if (!frozen) {
      const bookInLocation = bookItems.filter(b => b.location === scan.location);
      if (bookInLocation.length > 0) {
        issues.push({
          location: scan.location,
          sku: scan.sku,
          scanQuantity: scan.quantity,
          scanTime: scan.scanTime,
          issue: '库位未冻结',
          detail: '该库位在扫码时未被冻结，可能存在出入库操作导致数据不准确'
        });
      }
    }
  }
  
  return issues;
}

function detectManualWithoutReason(manuals) {
  return manuals.filter(m => !m.reason || m.reason.trim() === '').map(m => ({
    sku: m.sku,
    location: m.location,
    quantity: m.quantity,
    operator: m.operator,
    issue: '补录无原因',
    detail: '手工补录必须填写原因'
  }));
}

function detectBatchMixing(scans) {
  const byLocation = {};
  
  for (const scan of scans) {
    if (!byLocation[scan.location]) {
      byLocation[scan.location] = {};
    }
    if (!byLocation[scan.location][scan.sku]) {
      byLocation[scan.location][scan.sku] = [];
    }
    byLocation[scan.location][scan.sku].push(scan);
  }
  
  const issues = [];
  
  for (const [location, skuMap] of Object.entries(byLocation)) {
    for (const [sku, items] of Object.entries(skuMap)) {
      const batches = new Set(items.map(i => i.batchNo).filter(Boolean));
      if (batches.size > 1) {
        issues.push({
          location,
          sku,
          batches: Array.from(batches),
          issue: '批次混放',
          detail: `同一库位同一商品存在多个批次: ${Array.from(batches).join(', ')}`
        });
      }
    }
  }
  
  return issues;
}

function calculateDiff(book, scans, manuals, rechecks) {
  const byKey = {
    book: {},
    scan: {},
    manual: {},
    recheck: {}
  };
  
  for (const item of book) {
    const key = makeKey(item);
    if (!byKey.book[key]) {
      byKey.book[key] = { ...item, quantity: 0 };
    }
    byKey.book[key].quantity += item.quantity;
  }
  
  for (const item of scans) {
    const key = makeKey(item);
    if (!byKey.scan[key]) {
      byKey.scan[key] = { sku: item.sku, location: item.location, quantity: 0 };
    }
    byKey.scan[key].quantity += item.quantity;
  }
  
  for (const item of manuals) {
    const key = makeKey(item);
    if (!byKey.manual[key]) {
      byKey.manual[key] = { sku: item.sku, location: item.location, quantity: 0 };
    }
    byKey.manual[key].quantity += item.quantity;
  }
  
  for (const item of rechecks) {
    const key = makeKey(item);
    if (!byKey.recheck[key]) {
      byKey.recheck[key] = { sku: item.sku, location: item.location, quantity: 0 };
    }
    byKey.recheck[key].quantity += item.quantity;
  }
  
  const allKeys = new Set([
    ...Object.keys(byKey.book),
    ...Object.keys(byKey.scan),
    ...Object.keys(byKey.manual),
    ...Object.keys(byKey.recheck)
  ]);
  
  const diffs = [];
  
  for (const key of allKeys) {
    const bookItem = byKey.book[key];
    const scanItem = byKey.scan[key];
    const manualItem = byKey.manual[key];
    const recheckItem = byKey.recheck[key];
    
    const bookQty = bookItem ? bookItem.quantity : 0;
    const scanQty = scanItem ? scanItem.quantity : 0;
    const manualQty = manualItem ? manualItem.quantity : 0;
    const recheckQty = recheckItem ? recheckItem.quantity : null;
    
    const actualQty = scanQty + manualQty;
    const initialDiff = actualQty - bookQty;
    
    let recheckDiff = null;
    let diffExpanded = false;
    
    if (recheckQty !== null) {
      recheckDiff = recheckQty - bookQty;
      if (Math.abs(recheckDiff) > Math.abs(initialDiff)) {
        diffExpanded = true;
      }
    }
    
    const [sku, location] = key.split('||');
    
    const diff = {
      key,
      sku,
      location,
      bookQuantity: bookQty,
      scanQuantity: scanQty,
      manualQuantity: manualQty,
      actualQuantity: actualQty,
      recheckQuantity: recheckQty,
      initialDiff,
      recheckDiff,
      recheckDiffExpanded: diffExpanded,
      status: initialDiff === 0 ? '一致' : (initialDiff > 0 ? '多货' : '少货'),
      finalStatus: recheckQty !== null 
        ? (recheckQty === bookQty ? '一致' : (recheckQty > bookQty ? '多货' : '少货'))
        : null,
      source: analyzeDiffSource(bookQty, scanQty, manualQty, recheckQty)
    };
    
    diffs.push(diff);
  }
  
  return diffs;
}

function analyzeDiffSource(bookQty, scanQty, manualQty, recheckQty) {
  const sources = [];
  const actualQty = scanQty + manualQty;
  const diff = actualQty - bookQty;
  
  if (diff === 0) {
    sources.push({
      type: '一致',
      detail: '账面库存与实际库存一致',
      confidence: 100
    });
    return sources;
  }
  
  if (scanQty === 0 && bookQty > 0) {
    sources.push({
      type: '扫码遗漏',
      detail: '账面有库存但扫码数量为0，可能存在扫码遗漏或商品已出库未入账',
      confidence: 80
    });
  }
  
  if (scanQty > bookQty && manualQty === 0) {
    sources.push({
      type: '账面错误',
      detail: '扫码数量大于账面，可能存在入库未入账或账面多扣',
      confidence: 70
    });
  }
  
  if (scanQty < bookQty) {
    sources.push({
      type: '出入库差异',
      detail: '扫码数量小于账面，可能存在出库未扫码或商品丢失',
      confidence: 75
    });
  }
  
  if (manualQty !== 0) {
    sources.push({
      type: '手工调整',
      detail: `存在手工补录数量: ${manualQty > 0 ? '+' : ''}${manualQty}，需要关注补录原因`,
      confidence: 90
    });
  }
  
  if (recheckQty !== null && recheckQty !== actualQty) {
    const recheckChange = recheckQty - actualQty;
    sources.push({
      type: '复盘调整',
      detail: `复盘后数量${recheckChange > 0 ? '增加' : '减少'}了 ${Math.abs(recheckChange)}`,
      confidence: 95
    });
  }
  
  return sources.sort((a, b) => b.confidence - a.confidence);
}

function runAllChecks(book, scans, freezes, manuals, rechecks) {
  const issues = [];
  
  const duplicateScans = detectDuplicateScans(scans);
  for (const dup of duplicateScans) {
    issues.push({
      category: '重复扫码',
      severity: 'warning',
      ...dup
    });
  }
  
  const unfrozenChanges = detectUnfrozenLocationChanges(scans, freezes, book);
  for (const issue of unfrozenChanges) {
    issues.push({
      category: '未冻结库位',
      severity: 'error',
      ...issue
    });
  }
  
  const manualWithoutReason = detectManualWithoutReason(manuals);
  for (const issue of manualWithoutReason) {
    issues.push({
      category: '补录无原因',
      severity: 'error',
      ...issue
    });
  }
  
  const batchMixing = detectBatchMixing(scans);
  for (const issue of batchMixing) {
    issues.push({
      category: '批次混放',
      severity: 'warning',
      ...issue
    });
  }
  
  const diffs = calculateDiff(book, scans, manuals, rechecks);
  
  for (const diff of diffs) {
    if (diff.recheckDiffExpanded) {
      issues.push({
        category: '复盘差异扩大',
        severity: 'warning',
        sku: diff.sku,
        location: diff.location,
        initialDiff: diff.initialDiff,
        recheckDiff: diff.recheckDiff,
        detail: `复盘后差异从 ${diff.initialDiff} 扩大到 ${diff.recheckDiff}`
      });
    }
  }
  
  return {
    issues,
    diffs,
    summary: {
      totalItems: diffs.length,
      consistent: diffs.filter(d => d.status === '一致').length,
      overstock: diffs.filter(d => d.status === '多货').length,
      understock: diffs.filter(d => d.status === '少货').length,
      issuesByCategory: groupIssuesByCategory(issues)
    }
  };
}

function groupIssuesByCategory(issues) {
  const grouped = {};
  for (const issue of issues) {
    if (!grouped[issue.category]) {
      grouped[issue.category] = [];
    }
    grouped[issue.category].push(issue);
  }
  return grouped;
}

module.exports = {
  makeKey,
  groupByKey,
  detectDuplicateScans,
  isLocationFrozen,
  detectUnfrozenLocationChanges,
  detectManualWithoutReason,
  detectBatchMixing,
  calculateDiff,
  analyzeDiffSource,
  runAllChecks
};
