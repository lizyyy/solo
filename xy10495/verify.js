const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');
const http = require('http');

const path = require('path');
const DB_PATH = path.join(__dirname, 'test_prepaid.db');

const fs = require('fs');
if (fs.existsSync(DB_PATH)) {
  fs.unlinkSync(DB_PATH);
}

function today() {
  return new Date().toISOString().split('T')[0];
}

const db = new sqlite3.Database(DB_PATH);

function runAsync(sql, params) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function allAsync(sql, params) {
  params = params || [];
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function getAsync(sql, params) {
  params = params || [];
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function asyncWrap(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

async function initDB() {
  await runAsync(`CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  
  await runAsync(`CREATE TABLE IF NOT EXISTS stores (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  
  await runAsync(`CREATE TABLE IF NOT EXISTS cards (
    id TEXT PRIMARY KEY,
    card_type TEXT NOT NULL,
    balance REAL DEFAULT 0,
    status TEXT DEFAULT 'ACTIVE',
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  
  await runAsync(`CREATE TABLE IF NOT EXISTS card_rules (
    id TEXT PRIMARY KEY,
    card_id TEXT NOT NULL,
    rule_type TEXT NOT NULL,
    store_id TEXT,
    category_id TEXT,
    daily_limit REAL,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  
  await runAsync(`CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    card_id TEXT NOT NULL,
    tx_type TEXT NOT NULL,
    amount REAL NOT NULL,
    balance_after REAL NOT NULL,
    store_id TEXT,
    category_id TEXT,
    related_tx_id TEXT,
    reason TEXT,
    operator TEXT,
    status TEXT DEFAULT 'SUCCESS',
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  await Promise.all([
    runAsync('INSERT INTO categories (id, name) VALUES (?, ?)', ['cat_food', '餐饮']),
    runAsync('INSERT INTO categories (id, name) VALUES (?, ?)', ['cat_salon', '洗护']),
    runAsync('INSERT INTO categories (id, name) VALUES (?, ?)', ['cat_general', '通用'])
  ]);

  await Promise.all([
    runAsync('INSERT INTO stores (id, name, is_active) VALUES (?, ?, ?)', ['store_beijing', '北京门店', 1]),
    runAsync('INSERT INTO stores (id, name, is_active) VALUES (?, ?, ?)', ['store_shanghai', '上海门店', 1]),
    runAsync('INSERT INTO stores (id, name, is_active) VALUES (?, ?, ?)', ['store_disabled', '禁用门店', 0])
  ]);
}

const app = express();
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', date: today() });
});

app.post('/cards', asyncWrap(async (req, res) => {
  const { card_type, initial_amount = 0, operator = 'system' } = req.body;
  if (!card_type) return res.status(400).json({ success: false, error: 'card_type required' });

  const cardId = 'card_' + uuidv4();
  await runAsync(
    'INSERT INTO cards (id, card_type, balance, status) VALUES (?, ?, ?, ?)',
    [cardId, card_type, initial_amount, 'ACTIVE']
  );

  if (initial_amount > 0) {
    const txId = 'tx_' + uuidv4();
    await runAsync(
      'INSERT INTO transactions (id, card_id, tx_type, amount, balance_after, operator) VALUES (?, ?, ?, ?, ?, ?)',
      [txId, cardId, 'TOPUP', initial_amount, initial_amount, operator]
    );
  }

  const card = await getAsync('SELECT * FROM cards WHERE id = ?', [cardId]);
  res.json({ success: true, data: card });
}));

app.post('/cards/:cardId/recharge', asyncWrap(async (req, res) => {
  const { cardId } = req.params;
  const { amount, operator = 'system' } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ success: false, error: 'amount must be positive' });

  const card = await getAsync('SELECT * FROM cards WHERE id = ?', [cardId]);
  if (!card) return res.status(404).json({ success: false, error: 'card not found' });

  const newBalance = card.balance + amount;
  await runAsync('UPDATE cards SET balance = ? WHERE id = ?', [newBalance, cardId]);

  const txId = 'tx_' + uuidv4();
  await runAsync(
    'INSERT INTO transactions (id, card_id, tx_type, amount, balance_after, operator) VALUES (?, ?, ?, ?, ?, ?)',
    [txId, cardId, 'TOPUP', amount, newBalance, operator]
  );

  const updated = await getAsync('SELECT * FROM cards WHERE id = ?', [cardId]);
  res.json({ success: true, data: updated, tx_id: txId });
}));

app.post('/cards/:cardId/rules', asyncWrap(async (req, res) => {
  const { cardId } = req.params;
  const { store_id, category_id, daily_limit } = req.body;

  const card = await getAsync('SELECT * FROM cards WHERE id = ?', [cardId]);
  if (!card) return res.status(404).json({ success: false, error: 'card not found' });

  const ruleId = 'rule_' + uuidv4();
  let ruleType = 'general';
  if (store_id && category_id) ruleType = 'store_category';
  else if (store_id) ruleType = 'store';
  else if (category_id) ruleType = 'category';
  if (daily_limit) ruleType = 'daily_limit';

  await runAsync(
    'INSERT INTO card_rules (id, card_id, rule_type, store_id, category_id, daily_limit) VALUES (?, ?, ?, ?, ?, ?)',
    [ruleId, cardId, ruleType, store_id || null, category_id || null, daily_limit || null]
  );

  const rule = await getAsync('SELECT * FROM card_rules WHERE id = ?', [ruleId]);
  res.json({ success: true, data: rule });
}));

app.get('/cards/:cardId/rules', asyncWrap(async (req, res) => {
  const { cardId } = req.params;
  const rules = await allAsync(
    'SELECT cr.*, s.name as store_name, c.name as category_name ' +
    'FROM card_rules cr ' +
    'LEFT JOIN stores s ON cr.store_id = s.id ' +
    'LEFT JOIN categories c ON cr.category_id = c.id ' +
    'WHERE cr.card_id = ?',
    [cardId]
  );
  res.json({ success: true, data: rules });
}));

app.post('/consume', asyncWrap(async (req, res) => {
  const { card_id, amount, store_id, category_id, operator = 'front_desk' } = req.body;
  if (!card_id || !amount || !store_id) {
    return res.status(400).json({ success: false, error: 'card_id, amount, store_id are required' });
  }
  if (amount <= 0) return res.status(400).json({ success: false, error: 'amount must be positive' });

  const card = await getAsync('SELECT * FROM cards WHERE id = ?', [card_id]);
  if (!card) return res.status(404).json({ success: false, error: 'card not found' });

  if (card.status === 'FROZEN') {
    return res.status(403).json({ success: false, error: 'CARD_FROZEN: 卡片已冻结，禁止消费', code: 'CARD_FROZEN' });
  }
  if (card.status !== 'ACTIVE') {
    return res.status(403).json({ success: false, error: 'CARD_STATUS: 卡片状态异常 (' + card.status + ')', code: 'CARD_STATUS' });
  }

  if (card.balance < amount) {
    return res.status(403).json({ success: false, error: 'INSUFFICIENT_BALANCE: 余额不足', code: 'INSUFFICIENT_BALANCE', balance: card.balance });
  }

  const store = await getAsync('SELECT * FROM stores WHERE id = ?', [store_id]);
  if (!store || store.is_active !== 1) {
    return res.status(403).json({ success: false, error: 'STORE_UNAVAILABLE: 门店不可用', code: 'STORE_UNAVAILABLE' });
  }

  const rules = await allAsync('SELECT * FROM card_rules WHERE card_id = ?', [card_id]);

  const storeRules = rules.filter(function(r) { return r.rule_type === 'store' || r.rule_type === 'store_category'; });
  const storeCategoryRules = rules.filter(function(r) { return r.rule_type === 'store_category'; });
  const categoryRules = rules.filter(function(r) { return r.rule_type === 'category'; });
  const dailyRules = rules.filter(function(r) { return r.rule_type === 'daily_limit'; });

  const hasStoreLimit = storeRules.length > 0;
  const hasCategoryLimit = categoryRules.length > 0 || storeCategoryRules.length > 0;

  if (hasStoreLimit) {
    const allowedStores = new Set(storeRules.map(function(r) { return r.store_id; }));
    if (!allowedStores.has(store_id)) {
      return res.status(403).json({ success: false, error: 'STORE_NOT_ALLOWED: 该卡不能在此门店消费', code: 'STORE_NOT_ALLOWED' });
    }
  }

  if (category_id && hasCategoryLimit) {
    let allowed = false;
    const allowedCategories = new Set(categoryRules.map(function(r) { return r.category_id; }));
    const storeCats = storeCategoryRules.filter(function(r) { return r.store_id === store_id; }).map(function(r) { return r.category_id; });
    const storeCategorySet = new Set(storeCats);

    if (storeCategoryRules.length > 0) {
      if (storeCategorySet.has(category_id)) allowed = true;
    }
    if (!allowed && categoryRules.length > 0) {
      if (allowedCategories.has(category_id)) allowed = true;
    }

    if (!allowed) {
      return res.status(403).json({ success: false, error: 'CATEGORY_NOT_ALLOWED: 品类不匹配', code: 'CATEGORY_NOT_ALLOWED' });
    }
  }

  const todayDate = today();
  if (dailyRules.length > 0) {
    const dailyLimit = Math.min.apply(Math, dailyRules.map(function(r) { return r.daily_limit; }));

    const todayConsumed = await getAsync(
      'SELECT COALESCE(SUM(amount), 0) as total FROM transactions ' +
      'WHERE card_id = ? AND tx_type = ? AND DATE(created_at) = ? AND status = ?',
      [card_id, 'CONSUME', todayDate, 'SUCCESS']
    );

    const todayTotal = todayConsumed.total || 0;
    if (todayTotal + amount > dailyLimit) {
      return res.status(403).json({
        success: false,
        error: 'DAILY_LIMIT_EXCEEDED: 超出每日消费限额',
        code: 'DAILY_LIMIT_EXCEEDED',
        daily_limit: dailyLimit,
        today_consumed: todayTotal,
        remaining: dailyLimit - todayTotal
      });
    }
  }

  const newBalance = card.balance - amount;
  const txId = 'tx_' + uuidv4();

  await runAsync('UPDATE cards SET balance = ? WHERE id = ?', [newBalance, card_id]);
  await runAsync(
    'INSERT INTO transactions (id, card_id, tx_type, amount, balance_after, store_id, category_id, operator) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [txId, card_id, 'CONSUME', amount, newBalance, store_id, category_id || null, operator]
  );

  const tx = await getAsync('SELECT * FROM transactions WHERE id = ?', [txId]);
  res.json({ success: true, data: tx });
}));

app.post('/refund', asyncWrap(async (req, res) => {
  const { tx_id, operator = 'front_desk', reason = '' } = req.body;
  if (!tx_id) return res.status(400).json({ success: false, error: 'tx_id is required' });

  const originalTx = await getAsync('SELECT * FROM transactions WHERE id = ?', [tx_id]);
  if (!originalTx) return res.status(404).json({ success: false, error: 'transaction not found' });

  if (originalTx.tx_type !== 'CONSUME') {
    return res.status(400).json({ success: false, error: 'only CONSUME transactions can be refunded' });
  }

  const existingRefund = await getAsync(
    'SELECT * FROM transactions WHERE related_tx_id = ? AND tx_type = ? AND status = ?',
    [tx_id, 'REFUND', 'SUCCESS']
  );
  if (existingRefund) {
    return res.status(409).json({ success: false, error: 'REFUND_ALREADY_DONE: 该交易已退款', code: 'REFUND_ALREADY_DONE' });
  }

  const card = await getAsync('SELECT * FROM cards WHERE id = ?', [originalTx.card_id]);
  if (!card) return res.status(404).json({ success: false, error: 'card not found' });

  const refundAmount = originalTx.amount;
  const newBalance = card.balance + refundAmount;

  const refundTxId = 'tx_' + uuidv4();

  await runAsync('UPDATE cards SET balance = ? WHERE id = ?', [newBalance, card.id]);
  await runAsync(
    'INSERT INTO transactions (id, card_id, tx_type, amount, balance_after, store_id, category_id, related_tx_id, reason, operator) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [refundTxId, card.id, 'REFUND', refundAmount, newBalance, originalTx.store_id, originalTx.category_id, tx_id, reason, operator]
  );

  const refundTx = await getAsync('SELECT * FROM transactions WHERE id = ?', [refundTxId]);
  res.json({ success: true, data: refundTx });
}));

app.post('/cards/:cardId/freeze', asyncWrap(async (req, res) => {
  const { cardId } = req.params;
  const { reason = '', operator = 'system' } = req.body;

  const card = await getAsync('SELECT * FROM cards WHERE id = ?', [cardId]);
  if (!card) return res.status(404).json({ success: false, error: 'card not found' });
  if (card.status === 'FROZEN') return res.status(400).json({ success: false, error: 'card already frozen' });

  await runAsync('UPDATE cards SET status = ? WHERE id = ?', ['FROZEN', cardId]);
  const txId = 'tx_' + uuidv4();
  await runAsync(
    'INSERT INTO transactions (id, card_id, tx_type, amount, balance_after, reason, operator) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [txId, cardId, 'FREEZE', 0, card.balance, reason, operator]
  );

  const updated = await getAsync('SELECT * FROM cards WHERE id = ?', [cardId]);
  res.json({ success: true, data: updated, tx_id: txId });
}));

app.post('/cards/:cardId/unfreeze', asyncWrap(async (req, res) => {
  const { cardId } = req.params;
  const { reason = '', operator = 'system' } = req.body;

  const card = await getAsync('SELECT * FROM cards WHERE id = ?', [cardId]);
  if (!card) return res.status(404).json({ success: false, error: 'card not found' });
  if (card.status !== 'FROZEN') return res.status(400).json({ success: false, error: 'card is not frozen' });

  await runAsync('UPDATE cards SET status = ? WHERE id = ?', ['ACTIVE', cardId]);
  const txId = 'tx_' + uuidv4();
  await runAsync(
    'INSERT INTO transactions (id, card_id, tx_type, amount, balance_after, reason, operator) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [txId, cardId, 'UNFREEZE', 0, card.balance, reason, operator]
  );

  const updated = await getAsync('SELECT * FROM cards WHERE id = ?', [cardId]);
  res.json({ success: true, data: updated, tx_id: txId });
}));

app.get('/cards/:cardId/summary', asyncWrap(async (req, res) => {
  const { cardId } = req.params;
  const card = await getAsync('SELECT * FROM cards WHERE id = ?', [cardId]);
  if (!card) return res.status(404).json({ success: false, error: 'card not found' });

  const rules = await allAsync(
    'SELECT cr.*, s.name as store_name, c.name as category_name ' +
    'FROM card_rules cr ' +
    'LEFT JOIN stores s ON cr.store_id = s.id ' +
    'LEFT JOIN categories c ON cr.category_id = c.id ' +
    'WHERE cr.card_id = ?',
    [cardId]
  );

  const transactions = await allAsync(
    'SELECT t.*, s.name as store_name, c.name as category_name ' +
    'FROM transactions t ' +
    'LEFT JOIN stores s ON t.store_id = s.id ' +
    'LEFT JOIN categories c ON t.category_id = c.id ' +
    'WHERE t.card_id = ? ' +
    'ORDER BY t.created_at DESC',
    [cardId]
  );

  const consumeTxs = transactions.filter(function(t) { return t.tx_type === 'CONSUME' && t.status === 'SUCCESS'; });
  const refundTxs = transactions.filter(function(t) { return t.tx_type === 'REFUND' && t.status === 'SUCCESS'; });

  const refundsByRelated = {};
  for (var i = 0; i < refundTxs.length; i++) {
    var r = refundTxs[i];
    if (r.related_tx_id) refundsByRelated[r.related_tx_id] = r;
  }

  const reconciliation = [];
  for (var j = 0; j < consumeTxs.length; j++) {
    var consume = consumeTxs[j];
    var refund = refundsByRelated[consume.id];
    reconciliation.push({
      consume_tx: {
        id: consume.id,
        amount: consume.amount,
        created_at: consume.created_at
      },
      refund_tx: refund ? {
        id: refund.id,
        amount: refund.amount,
        created_at: refund.created_at,
        reason: refund.reason
      } : null,
      status: refund ? 'REFUNDED' : 'PAID',
      difference: refund ? 0 : consume.amount
    });
  }

  var totalConsumed = 0;
  for (var k = 0; k < consumeTxs.length; k++) {
    totalConsumed += consumeTxs[k].amount;
  }
  var totalRefunded = 0;
  for (var l = 0; l < refundTxs.length; l++) {
    totalRefunded += refundTxs[l].amount;
  }

  res.json({
    success: true,
    data: {
      card: {
        id: card.id,
        card_type: card.card_type,
        balance: card.balance,
        status: card.status,
        created_at: card.created_at
      },
      available_rules: rules,
      transactions: transactions,
      reconciliation: {
        total_consumed: totalConsumed,
        total_refunded: totalRefunded,
        net_consumed: totalConsumed - totalRefunded,
        items: reconciliation
      }
    }
  });
}));

app.get('/categories', asyncWrap(async (req, res) => {
  const rows = await allAsync('SELECT * FROM categories');
  res.json({ success: true, data: rows });
}));

app.get('/stores', asyncWrap(async (req, res) => {
  const rows = await allAsync('SELECT * FROM stores');
  res.json({ success: true, data: rows });
}));

app.use(function(err, req, res, next) {
  console.error('ERROR:', err);
  res.status(500).json({ success: false, error: err.message || 'Internal server error' });
});

function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function api(method, path, body) {
  return request({
    hostname: 'localhost',
    port: 18080,
    path: path,
    method: method,
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': body ? Buffer.byteLength(JSON.stringify(body)) : 0
    }
  }, body);
}

async function runTests() {
  console.log('=== 初始化数据库 ===');
  await initDB();

  console.log('\n=== 启动服务器 ===');
  const server = app.listen(18080);
  await new Promise(r => setTimeout(r, 500));

  let testCardId = null;
  let consumeTxId = null;

  try {
    console.log('\n[1] 查看门店和品类');
    const stores = await api('GET', '/stores');
    const cats = await api('GET', '/categories');
    console.log('门店:', stores.body.data.map(s => s.id + ':' + s.name));
    console.log('品类:', cats.body.data.map(c => c.id + ':' + c.name));

    console.log('\n[2] 新开测试卡（初始500元）');
    const newCard = await api('POST', '/cards', { card_type: '测试卡', initial_amount: 500 });
    testCardId = newCard.body.data.id;
    console.log('新卡 ID:', testCardId);
    console.log('余额:', newCard.body.data.balance);

    console.log('\n[3] 配置卡规则（北京门店 + 餐饮品类 + 每日限额300）');
    await api('POST', '/cards/' + testCardId + '/rules', { store_id: 'store_beijing' });
    await api('POST', '/cards/' + testCardId + '/rules', { category_id: 'cat_food' });
    await api('POST', '/cards/' + testCardId + '/rules', { daily_limit: 300 });
    const rules = await api('GET', '/cards/' + testCardId + '/rules');
    console.log('规则数量:', rules.body.data.length);

    console.log('\n[4] 正常消费（北京门店 + 餐饮 + 200元）');
    const consume = await api('POST', '/consume', {
      card_id: testCardId,
      amount: 200,
      store_id: 'store_beijing',
      category_id: 'cat_food'
    });
    console.log('成功:', consume.body.success);
    consumeTxId = consume.body.data.id;
    console.log('交易ID:', consumeTxId);

    console.log('\n[5] 限额拦截（再消费150，超过每日300）');
    const limitFail = await api('POST', '/consume', {
      card_id: testCardId,
      amount: 150,
      store_id: 'store_beijing',
      category_id: 'cat_food'
    });
    console.log('期望DAILY_LIMIT_EXCEEDED:', limitFail.body.code === 'DAILY_LIMIT_EXCEEDED');
    console.log('错误码:', limitFail.body.code);

    console.log('\n[6] 门店限制拦截（上海门店）');
    const storeFail = await api('POST', '/consume', {
      card_id: testCardId,
      amount: 50,
      store_id: 'store_shanghai',
      category_id: 'cat_food'
    });
    console.log('期望STORE_NOT_ALLOWED:', storeFail.body.code === 'STORE_NOT_ALLOWED');

    console.log('\n[7] 品类限制拦截（洗护品类）');
    const catFail = await api('POST', '/consume', {
      card_id: testCardId,
      amount: 50,
      store_id: 'store_beijing',
      category_id: 'cat_salon'
    });
    console.log('期望CATEGORY_NOT_ALLOWED:', catFail.body.code === 'CATEGORY_NOT_ALLOWED');

    console.log('\n[8] 余额不足拦截（先充值10，再消费320，当前余额应为310）');
    await api('POST', '/cards/' + testCardId + '/recharge', { amount: 10 });
    const balanceFail = await api('POST', '/consume', {
      card_id: testCardId,
      amount: 320,
      store_id: 'store_beijing',
      category_id: 'cat_food'
    });
    console.log('期望INSUFFICIENT_BALANCE:', balanceFail.body.code === 'INSUFFICIENT_BALANCE');

    console.log('\n[9] 退款回滚');
    const refund = await api('POST', '/refund', {
      tx_id: consumeTxId,
      reason: '顾客取消订单'
    });
    console.log('退款成功:', refund.body.success);
    console.log('退款金额:', refund.body.data ? refund.body.data.amount : 'N/A');

    console.log('\n[10] 重复退款拦截');
    const dupRefund = await api('POST', '/refund', { tx_id: consumeTxId });
    console.log('期望REFUND_ALREADY_DONE:', dupRefund.body.code === 'REFUND_ALREADY_DONE');

    console.log('\n[11] 冻结卡片（原因：疑似盗刷）');
    const freeze = await api('POST', '/cards/' + testCardId + '/freeze', {
      reason: '疑似盗刷',
      operator: '风控系统'
    });
    console.log('冻结成功:', freeze.body.success);
    console.log('当前状态:', freeze.body.data.status);

    console.log('\n[12] 冻结卡消费拦截');
    const frozenFail = await api('POST', '/consume', {
      card_id: testCardId,
      amount: 50,
      store_id: 'store_beijing',
      category_id: 'cat_food'
    });
    console.log('期望CARD_FROZEN:', frozenFail.body.code === 'CARD_FROZEN');

    console.log('\n[13] 解冻卡片（原因：风控核实无异常）');
    const unfreeze = await api('POST', '/cards/' + testCardId + '/unfreeze', {
      reason: '风控核实无异常',
      operator: '客服'
    });
    console.log('解冻成功:', unfreeze.body.success);

    console.log('\n[14] 查看完整卡汇总');
    const summary = await api('GET', '/cards/' + testCardId + '/summary');
    console.log('卡余额:', summary.body.data.card.balance);
    console.log('规则数:', summary.body.data.available_rules.length);
    console.log('流水数:', summary.body.data.transactions.length);
    console.log('对账差异项:', summary.body.data.reconciliation.items.length);
    console.log('总消费:', summary.body.data.reconciliation.total_consumed);
    console.log('总退款:', summary.body.data.reconciliation.total_refunded);

    console.log('\n[15] 流水详情（包含冻结/解冻原因）');
    const freezeTx = summary.body.data.transactions.find(t => t.tx_type === 'FREEZE');
    const unfreezeTx = summary.body.data.transactions.find(t => t.tx_type === 'UNFREEZE');
    const refundTx = summary.body.data.transactions.find(t => t.tx_type === 'REFUND');
    console.log('冻结原因:', freezeTx ? freezeTx.reason : 'N/A');
    console.log('解冻原因:', unfreezeTx ? unfreezeTx.reason : 'N/A');
    console.log('退款原因:', refundTx ? refundTx.reason : 'N/A');

    console.log('\n=== 所有测试完成 ===');
  } catch (e) {
    console.error('测试失败:', e);
  }

  server.close();
  db.close();
}

runTests().catch(console.error);
