const { now, logSuccess, logWarn, logError, logInfo } = require('../utils');
const store = require('../store');
const validator = require('../validator');

function confirmAll(operator) {
  const newAnomalies = validator.detectAnomalies('pending');
  const existingAnomalies = store.getAnomalies('pending').filter(a => a.status === 'open');
  const allAnomalies = existingAnomalies.length > 0 ? existingAnomalies : newAnomalies;

  if (allAnomalies.length > 0) {
    logError(`存在 ${allAnomalies.length} 个未解决的异常，无法确认`);
    allAnomalies.forEach(a => logWarn(`  - ${a.description}`));
    return false;
  }

  const transactions = store.getTransactions('pending');
  const pending = transactions.filter(t => t.status === 'pending');

  if (pending.length === 0) {
    logInfo('没有待确认的交易');
    return true;
  }

  const specs = store.getSpecs('pending');
  const inventoryMap = {};
  specs.forEach(s => { inventoryMap[s.id] = 0; });
  transactions.forEach(t => {
    if (!inventoryMap[t.specId]) inventoryMap[t.specId] = 0;
    inventoryMap[t.specId] += t.quantity;
  });
  const negatives = specs.filter(s => (inventoryMap[s.id] || 0) < 0);

  if (negatives.length > 0) {
    logError('确认后库存将为负数，无法确认:');
    negatives.forEach(n => logWarn(`  - ${n.name}: ${inventoryMap[n.id]}${n.unit}`));
    return false;
  }

  const updatedTransactions = transactions.map(t => {
    if (t.status === 'pending') {
      return {
        ...t,
        status: 'confirmed',
        confirmedAt: now(),
        confirmedBy: operator || 'operator'
      };
    }
    return t;
  });

  store.saveTransactions('pending', updatedTransactions);

  const batches = store.getImportBatches('pending').map(b => ({
    ...b,
    status: 'confirmed',
    confirmedAt: now()
  }));
  store.saveImportBatches('pending', batches);
  store.saveAnomalies('pending', []);

  logSuccess(`已确认 ${pending.length} 条交易`);
  return true;
}

function confirmTransaction(transactionId, operator) {
  const transactions = store.getTransactions('pending');
  const idx = transactions.findIndex(t => t.id === transactionId);

  if (idx === -1) {
    logError(`交易不存在: ${transactionId}`);
    return false;
  }

  if (transactions[idx].status === 'confirmed') {
    logWarn(`交易已确认: ${transactionId}`);
    return true;
  }

  transactions[idx] = {
    ...transactions[idx],
    status: 'confirmed',
    confirmedAt: now(),
    confirmedBy: operator || 'operator'
  };

  store.saveTransactions('pending', transactions);
  logSuccess(`已确认交易: ${transactionId}`);
  return true;
}

function resetPending() {
  store.saveSpecs('pending', store.getSpecs('confirmed'));
  store.saveCourses('pending', store.getCourses('confirmed'));
  store.saveTransactions('pending', []);
  store.saveImportBatches('pending', []);
  store.saveAnomalies('pending', []);
  logSuccess('已重置待处理区，从已确认区恢复基础数据');
}

module.exports = {
  confirmAll,
  confirmTransaction,
  resetPending
};
