const express = require('express');
const router = express.Router();
const store = require('../store/dataStore');

router.get('/identities', (req, res) => {
  try {
    const identities = store.getExternalIdentities();
    const csvContent = generateIdentitiesCSV(identities);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=identities.csv');
    res.send(csvContent);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/merges', (req, res) => {
  try {
    const transactions = store.getMergeTransactions();
    const csvContent = generateMergesCSV(transactions);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=merges.csv');
    res.send(csvContent);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/impact/:transactionId', (req, res) => {
  try {
    const transaction = store.getMergeTransactionById(req.params.transactionId);
    if (!transaction) {
      return res.status(404).json({ success: false, error: '合并事务不存在' });
    }
    const impacts = store.getImpactScopes({ transactionId: req.params.transactionId });
    const identities = store.getExternalIdentities().filter(i => 
      transaction.identityIds && transaction.identityIds.includes(i.id)
    );
    const csvContent = generateImpactCSV(transaction, identities, impacts);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=impact_${req.params.transactionId}.csv`);
    res.send(csvContent);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/full', (req, res) => {
  try {
    const data = store.exportAllData();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=full_export.json');
    res.send(JSON.stringify(data, null, 2));
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

function generateIdentitiesCSV(identities) {
  const headers = ['ID', '外部ID', '来源', '姓名', '邮箱', '电话', '主客户ID', '创建时间'];
  const rows = identities.map(i => [
    i.id,
    i.externalId,
    i.source,
    i.name || '',
    i.email || '',
    i.phone || '',
    i.masterCustomerId || '',
    i.createdAt
  ]);
  return [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
}

function generateMergesCSV(transactions) {
  const headers = ['事务ID', '状态', '原因', '操作人', '创建时间', '完成时间'];
  const rows = transactions.map(t => [
    t.id,
    t.status,
    t.reason || '',
    t.operator || '',
    t.createdAt,
    t.completedAt || ''
  ]);
  return [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
}

function generateImpactCSV(transaction, identities, impacts) {
  const headers = ['事务ID', '身份ID', '外部ID', '来源', '姓名', '影响类型', '影响描述'];
  const rows = identities.map(i => {
    const impact = impacts.find(imp => imp.identityId === i.id);
    return [
      transaction.id,
      i.id,
      i.externalId,
      i.source,
      i.name || '',
      impact?.impactType || 'merged',
      impact?.description || '身份已合并到主客户'
    ];
  });
  return [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
}

module.exports = router;