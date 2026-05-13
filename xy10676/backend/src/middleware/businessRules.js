const db = require('../database/db');

exports.validatePaymentNodeChange = (req, res, next) => {
  const { id } = req.params;
  const { payment_nodes, changed_by } = req.body;

  if (!payment_nodes) {
    return next();
  }

  db.get('SELECT payment_nodes FROM contracts WHERE id = ?', [id], (err, contract) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    const oldNodes = contract.payment_nodes ? JSON.parse(contract.payment_nodes) : [];
    const newNodes = payment_nodes;

    const hasAmountChange = oldNodes.some((oldNode, idx) => {
      const newNode = newNodes[idx];
      return newNode && Math.abs(oldNode.amount - newNode.amount) > 0.01;
    });

    if (hasAmountChange) {
      const flowSql = `INSERT INTO flow_records 
        (contract_id, action_type, action_data, operator, review_status)
        VALUES (?, ?, ?, ?, ?)`;
      
      const actionData = JSON.stringify({
        old_nodes: oldNodes,
        new_nodes: newNodes
      });

      db.run(flowSql, [id, 'payment_node_change', actionData, changed_by, 'pending'], function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        return res.status(202).json({
          message: '付款节点变更需复核，已提交审批',
          flow_id: this.lastID,
          requires_review: true
        });
      });
    } else {
      next();
    }
  });
};

exports.checkRenewalClause = (req, res, next) => {
  const { id } = req.params;
  const { status } = req.body;

  if (status !== 'renewed') {
    return next();
  }

  db.get('SELECT renewal_clause, end_date FROM contracts WHERE id = ?', [id], (err, contract) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    if (!contract.renewal_clause || contract.renewal_clause.trim() === '') {
      return res.status(400).json({
        error: '无续约条款，无法标记为已续约',
        code: 'NO_RENEWAL_CLAUSE'
      });
    }

    const endDate = new Date(contract.end_date);
    const today = new Date();
    const daysUntilEnd = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));

    if (daysUntilEnd > 30) {
      return res.status(400).json({
        error: '距离合同到期超过30天，无法提前续约',
        days_until_end: daysUntilEnd,
        code: 'RENEWAL_TOO_EARLY'
      });
    }

    next();
  });
};

exports.preventDuplicateSubmission = (req, res, next) => {
  const { contract_no } = req.body;
  
  if (!contract_no) {
    return next();
  }

  db.get('SELECT id FROM contracts WHERE contract_no = ?', [contract_no], (err, contract) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (contract) {
      return res.status(409).json({
        error: '合同编号已存在，请勿重复提交',
        contract_no,
        code: 'DUPLICATE_CONTRACT'
      });
    }
    next();
  });
};

exports.validateReviewer = (req, res, next) => {
  const { reviewed_by } = req.body;
  
  if (!reviewed_by) {
    return res.status(400).json({
      error: '复核人不能为空',
      code: 'MISSING_REVIEWER'
    });
  }

  db.get('SELECT * FROM users WHERE name = ? AND role = "manager"', [reviewed_by], (err, user) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!user) {
      return res.status(403).json({
        error: '该用户无复核权限',
        reviewed_by,
        code: 'INVALID_REVIEWER'
      });
    }
    next();
  });
};
