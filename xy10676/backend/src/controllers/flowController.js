const db = require('../database/db');

exports.getAllFlows = (req, res) => {
  const { contract_id, review_status } = req.query;
  
  let query = 'SELECT * FROM flow_records WHERE 1=1';
  const params = [];

  if (contract_id) {
    query += ' AND contract_id = ?';
    params.push(contract_id);
  }

  if (review_status) {
    query += ' AND review_status = ?';
    params.push(review_status);
  }

  query += ' ORDER BY created_at DESC';

  db.all(query, params, (err, flows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(flows);
  });
};

exports.getFlowById = (req, res) => {
  const { id } = req.params;
  db.get('SELECT * FROM flow_records WHERE id = ?', [id], (err, flow) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!flow) {
      return res.status(404).json({ error: '流转记录不存在' });
    }
    if (flow.action_data) {
      flow.action_data = JSON.parse(flow.action_data);
    }
    res.json(flow);
  });
};

exports.reviewFlow = (req, res) => {
  const { id } = req.params;
  const { reviewed_by, review_status, comments } = req.body;

  if (!['approved', 'rejected'].includes(review_status)) {
    return res.status(400).json({ error: '无效的复核状态' });
  }

  db.get('SELECT * FROM flow_records WHERE id = ?', [id], (err, flow) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!flow) {
      return res.status(404).json({ error: '流转记录不存在' });
    }
    if (flow.review_status !== 'pending') {
      return res.status(400).json({ error: '该记录已复核，无法重复操作' });
    }

    const updateSql = `UPDATE flow_records 
      SET reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, review_status = ?, comments = ?
      WHERE id = ?`;

    db.run(updateSql, [reviewed_by, review_status, comments || '', id], function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      if (flow.action_type === 'payment_node_change' && review_status === 'approved') {
        const actionData = JSON.parse(flow.action_data);
        const updateContractSql = `UPDATE contracts 
          SET payment_nodes = ?, updated_at = CURRENT_TIMESTAMP 
          WHERE id = ?`;
        
        db.run(updateContractSql, [JSON.stringify(actionData.new_nodes), flow.contract_id], (err) => {
          if (err) {
            console.error('更新合同付款节点失败:', err);
          }
        });

        const historySql = `INSERT INTO status_history 
          (contract_id, field_name, old_value, new_value, changed_by)
          VALUES (?, ?, ?, ?, ?)`;
        
        db.run(historySql, [
          flow.contract_id,
          'payment_nodes',
          JSON.stringify(actionData.old_nodes),
          JSON.stringify(actionData.new_nodes),
          reviewed_by
        ]);
      }

      res.json({ 
        message: review_status === 'approved' ? '复核通过' : '已驳回',
        flow_id: id 
      });
    });
  });
};
