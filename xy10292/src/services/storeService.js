const { FILES, readJsonFile, writeJsonFile, recordHistory } = require('../models/store');

function listStores() {
  return readJsonFile(FILES.stores, []);
}

function getStoreById(storeId) {
  const stores = listStores();
  return stores.find(s => s.id === storeId);
}

function importStores(newStores, operator = 'system') {
  const existing = listStores();
  const existingMap = new Map(existing.map(s => [s.id, s]));
  const result = { added: 0, updated: 0, deleted: 0 };
  const newStoreIds = new Set(newStores.map(s => s.id));

  for (const store of newStores) {
    if (!store.id || !store.name) {
      throw new Error(`门店记录缺少必填字段: id 或 name`);
    }
    
    const existingStore = existingMap.get(store.id);
    if (existingStore) {
      const hasChanges = JSON.stringify(existingStore) !== JSON.stringify(store);
      if (hasChanges) {
        recordHistory('UPDATE', 'STORE', store.id, existingStore, store, operator);
        result.updated++;
      }
    } else {
      recordHistory('CREATE', 'STORE', store.id, null, store, operator);
      result.added++;
    }
  }

  for (const store of existing) {
    if (!newStoreIds.has(store.id)) {
      recordHistory('DELETE', 'STORE', store.id, store, null, operator);
      result.deleted++;
    }
  }

  writeJsonFile(FILES.stores, newStores);
  return result;
}

function updateStore(storeId, updates, operator = 'system') {
  const stores = listStores();
  const index = stores.findIndex(s => s.id === storeId);
  if (index === -1) {
    throw new Error(`门店不存在: ${storeId}`);
  }

  const before = { ...stores[index] };
  const after = { ...stores[index], ...updates };
  
  recordHistory('UPDATE', 'STORE', storeId, before, after, operator);
  stores[index] = after;
  writeJsonFile(FILES.stores, stores);
  return after;
}

function deleteStore(storeId, operator = 'system') {
  const stores = listStores();
  const index = stores.findIndex(s => s.id === storeId);
  if (index === -1) {
    throw new Error(`门店不存在: ${storeId}`);
  }

  const before = stores[index];
  recordHistory('DELETE', 'STORE', storeId, before, null, operator);
  stores.splice(index, 1);
  writeJsonFile(FILES.stores, stores);
  return true;
}

module.exports = {
  listStores,
  getStoreById,
  importStores,
  updateStore,
  deleteStore
};