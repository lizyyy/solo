const { formatDate, logInfo, logWarn, logSuccess } = require('../utils');
const store = require('../store');
const validator = require('../validator');

function runCheck(options = {}) {
  const anomalies = validator.detectAnomalies('pending');

  if (anomalies.length === 0) {
    store.saveAnomalies('pending', []);
    logSuccess('未检测到异常');
    return [];
  }

  store.saveAnomalies('pending', anomalies);

  logInfo(`检测到 ${anomalies.length} 个异常:`);
  anomalies.forEach((a, idx) => {
    const severityColor = a.severity === 'high' ? '🔴' : a.severity === 'medium' ? '🟡' : '🟢';
    console.log(`  ${idx + 1}. ${severityColor} [${a.id}] ${a.description}`);
  });

  return anomalies;
}

function listAnomalies(options = {}) {
  const anomalies = store.getAnomalies('pending');

  if (anomalies.length === 0) {
    logInfo('暂无异常记录');
    return [];
  }

  let filtered = anomalies;
  if (options.status) {
    filtered = anomalies.filter(a => a.status === options.status);
  }
  if (options.severity) {
    filtered = filtered.filter(a => a.severity === options.severity);
  }

  if (filtered.length === 0) {
    logInfo('没有符合条件的异常记录');
    return [];
  }

  console.log('\n异常列表:');
  console.log('='.repeat(80));

  filtered.forEach((a, idx) => {
    const severityColor = a.severity === 'high' ? '🔴' : a.severity === 'medium' ? '🟡' : '🟢';
    const statusColor = a.status === 'open' ? '🔓' : a.status === 'resolved' ? '✅' : '❌';

    console.log(`\n${idx + 1}. ${severityColor} 严重程度: ${a.severity} | ${statusColor} 状态: ${a.status}`);
    console.log(`   ID: ${a.id}`);
    console.log(`   类型: ${a.type}`);
    console.log(`   描述: ${a.description}`);
    console.log(`   创建时间: ${formatDate(a.createdAt)}`);
    if (a.resolvedAt) {
      console.log(`   解决时间: ${formatDate(a.resolvedAt)}`);
    }
  });

  console.log(`\n共 ${filtered.length} 条异常记录`);
  return filtered;
}

function resolveAnomaly(anomalyId, resolvedBy) {
  const anomalies = store.getAnomalies('pending');
  const idx = anomalies.findIndex(a => a.id === anomalyId);

  if (idx === -1) {
    logWarn(`未找到异常记录: ${anomalyId}`);
    return false;
  }

  anomalies[idx].status = 'resolved';
  anomalies[idx].resolvedAt = Date.now();
  anomalies[idx].resolvedBy = resolvedBy || 'operator';

  store.saveAnomalies('pending', anomalies);
  logSuccess(`已解决异常: ${anomalyId}`);
  return true;
}

function fixSpecMismatch(anomalyId, correctSpecId) {
  const anomalies = store.getAnomalies('pending');
  const anomaly = anomalies.find(a => a.id === anomalyId);

  if (!anomaly || anomaly.type !== 'spec_mismatch') {
    logWarn('该异常类型不能用此方法修复');
    return false;
  }

  const transactions = store.getTransactions('pending');
  const idx = transactions.findIndex(t => t.id === anomaly.transactionId);

  if (idx === -1) {
    logWarn(`未找到交易记录: ${anomaly.transactionId}`);
    return false;
  }

  const spec = store.getSpecById('pending', correctSpecId);
  if (!spec) {
    logWarn(`目标规格不存在: ${correctSpecId}`);
    return false;
  }

  transactions[idx].specId = correctSpecId;
  store.saveTransactions('pending', transactions);
  logSuccess(`已将交易 ${anomaly.transactionId} 的规格修正为: ${correctSpecId}`);

  resolveAnomaly(anomalyId, 'auto_fix');
  return true;
}

function removeDuplicate(anomalyId) {
  const anomalies = store.getAnomalies('pending');
  const anomaly = anomalies.find(a => a.id === anomalyId);

  if (!anomaly || anomaly.type !== 'duplicate_transaction') {
    logWarn('该异常类型不能用此方法修复');
    return false;
  }

  const transactions = store.getTransactions('pending');
  const filtered = transactions.filter(t => t.id !== anomaly.transactionId);

  store.saveTransactions('pending', filtered);
  logSuccess(`已删除重复交易: ${anomaly.transactionId}`);

  resolveAnomaly(anomalyId, 'auto_fix');
  return true;
}

module.exports = {
  runCheck,
  listAnomalies,
  resolveAnomaly,
  fixSpecMismatch,
  removeDuplicate
};
