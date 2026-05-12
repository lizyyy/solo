const { getAllStores, saveStores, addLog, getStoreById } = require('../storage');
const { generateId, validateRequired } = require('../utils');

function importStores(stores, operator = 'system') {
  const results = { success: [], failed: [], skipped: [] };
  const existingStores = getAllStores();
  const existingIds = new Set(existingStores.map(s => s.id));
  const existingCodes = new Set(existingStores.map(s => s.code));
  
  for (const input of stores) {
    const missing = validateRequired(input, ['code', 'name']);
    if (missing.length > 0) {
      results.failed.push({
        input,
        reason: `缺少必填字段: ${missing.join(', ')}`
      });
      continue;
    }
    
    if (existingIds.has(input.id)) {
      results.skipped.push({
        input,
        reason: '门店ID已存在'
      });
      continue;
    }
    
    if (existingCodes.has(input.code)) {
      results.skipped.push({
        input,
        reason: '门店编码已存在'
      });
      continue;
    }
    
    const store = {
      id: input.id || generateId('store'),
      code: input.code,
      name: input.name,
      manager: input.manager || '',
      phone: input.phone || '',
      address: input.address || '',
      region: input.region || '',
      createdAt: new Date().toISOString()
    };
    
    existingStores.push(store);
    existingIds.add(store.id);
    existingCodes.add(store.code);
    
    addLog({
      action: 'IMPORT_STORE',
      operator,
      targetId: store.id,
      before: null,
      after: store,
      details: `导入门店: ${store.name} (${store.code})`
    });
    
    results.success.push(store);
  }
  
  saveStores(existingStores);
  return results;
}

function updateStore(storeId, updates, operator = 'system') {
  const stores = getAllStores();
  const index = stores.findIndex(s => s.id === storeId);
  
  if (index === -1) {
    return { success: false, reason: '门店不存在' };
  }
  
  const before = { ...stores[index] };
  const after = { ...stores[index], ...updates, updatedAt: new Date().toISOString() };
  
  stores[index] = after;
  saveStores(stores);
  
  addLog({
    action: 'UPDATE_STORE',
    operator,
    targetId: storeId,
    before,
    after,
    details: `更新门店信息: ${after.name}`
  });
  
  return { success: true, store: after };
}

module.exports = {
  importStores,
  updateStore,
  getAllStores,
  getStoreById
};
