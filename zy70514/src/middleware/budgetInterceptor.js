const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');
const { FREEZE_STATUS } = require('../services/FreezeStatusMachine');

async function budgetInterceptor(req, res, next) {
  const accountId = req.headers['x-account-id'];
  const groupId = req.headers['x-api-group-id'];

  if (!accountId) {
    return res.status(400).json({ error: '缺少 X-Account-ID 头' });
  }

  try {
    const activeFreezes = await db.all(`
      SELECT SUM(freeze_amount) as total_frozen
      FROM budget_freezes
      WHERE account_id = ?
        AND status IN (?, ?, ?, ?)
    `, [
      accountId,
      FREEZE_STATUS.CONFIRMED,
      FREEZE_STATUS.IN_INVESTIGATION,
      FREEZE_STATUS.PENDING_THAW_APPROVAL,
      FREEZE_STATUS.PARTIALLY_THAWED
    ]);

    const totalFrozen = activeFreezes[0]?.total_frozen || 0;

    const account = await db.get(`
      SELECT total_budget, used_budget, status
      FROM customer_accounts
      WHERE account_id = ?
    `, [accountId]);

    if (!account) {
      await logApiCall(accountId, groupId || 'unknown', req.path, 0, 'rejected', '账户不存在');
      return res.status(404).json({ error: '账户不存在' });
    }

    if (account.status !== 'active') {
      await logApiCall(accountId, groupId || 'unknown', req.path, 0, 'rejected', '账户已禁用');
      return res.status(403).json({ error: '账户已禁用' });
    }

    const availableBudget = account.total_budget - account.used_budget - totalFrozen;
    const callCost = calculateCallCost(req.path);

    if (availableBudget < callCost) {
      await logApiCall(accountId, groupId || 'unknown', req.path, callCost, 'rejected',
        `预算不足: 可用=${availableBudget}, 需要=${callCost}, 冻结=${totalFrozen}`);
      return res.status(403).json({
        error: '预算不足，API调用已被拦截',
        details: {
          totalBudget: account.total_budget,
          usedBudget: account.used_budget,
          frozenBudget: totalFrozen,
          availableBudget,
          requiredCost: callCost
        }
      });
    }

    req.budgetInfo = {
      accountId,
      groupId,
      availableBudget,
      frozenBudget: totalFrozen,
      callCost
    };

    await logApiCall(accountId, groupId || 'unknown', req.path, callCost, 'success');
    next();
  } catch (error) {
    console.error('预算拦截中间件错误:', error);
    res.status(500).json({ error: '预算检查失败' });
  }
}

function calculateCallCost(path) {
  if (path.includes('/premium/')) return 10;
  if (path.includes('/advanced/')) return 5;
  return 1;
}

async function logApiCall(accountId, groupId, apiPath, cost, status, rejectedReason = null) {
  const callId = uuidv4();
  await db.run(`
    INSERT INTO api_call_logs (
      call_id, account_id, group_id, api_path, call_time, cost, status, rejected_reason
    ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?)
  `, [callId, accountId, groupId, apiPath, cost, status, rejectedReason]);
}

module.exports = budgetInterceptor;
