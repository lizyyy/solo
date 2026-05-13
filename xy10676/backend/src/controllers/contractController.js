const db = require('../database/db');
const Joi = require('joi');

const contractSchema = Joi.object({
  contract_no: Joi.string().required(),
  contract_name: Joi.string().required(),
  party_a: Joi.string().required(),
  party_b: Joi.string().required(),
  contract_amount: Joi.number().required(),
  start_date: Joi.date().required(),
  end_date: Joi.date().required(),
  renewal_clause: Joi.string().allow(''),
  electronic_sign_status: Joi.string().valid('pending', 'signed', 'rejected').default('pending'),
  paper_archived: Joi.boolean().default(false),
  payment_nodes: Joi.any(),
  responsible_person: Joi.string().required(),
  status: Joi.string().valid('active', 'expired', 'renewed', 'terminated').default('active')
});

exports.getAllContracts = (req, res) => {
  const { 
    search, 
    status, 
    electronic_sign_status, 
    paper_archived,
    responsible_person,
    page = 1,
    limit = 20
  } = req.query;

  let query = 'SELECT * FROM contracts WHERE 1=1';
  let countQuery = 'SELECT COUNT(*) as total FROM contracts WHERE 1=1';
  const params = [];

  if (search) {
    const searchCondition = ' (contract_no LIKE ? OR contract_name LIKE ? OR party_a LIKE ? OR party_b LIKE ?)';
    query += searchCondition;
    countQuery += searchCondition;
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm, searchTerm, searchTerm);
  }

  if (status) {
    query += ' AND status = ?';
    countQuery += ' AND status = ?';
    params.push(status);
  }

  if (electronic_sign_status) {
    query += ' AND electronic_sign_status = ?';
    countQuery += ' AND electronic_sign_status = ?';
    params.push(electronic_sign_status);
  }

  if (paper_archived !== undefined) {
    query += ' AND paper_archived = ?';
    countQuery += ' AND paper_archived = ?';
    params.push(paper_archived === 'true' ? 1 : 0);
  }

  if (responsible_person) {
    query += ' AND responsible_person = ?';
    countQuery += ' AND responsible_person = ?';
    params.push(responsible_person);
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  const offset = (page - 1) * limit;
  const queryParams = [...params, parseInt(limit), offset];

  db.all(query, queryParams, (err, contracts) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    db.get(countQuery, params, (err, result) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({
        data: contracts,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: result.total,
          totalPages: Math.ceil(result.total / limit)
        }
      });
    });
  });
};

exports.getContractById = (req, res) => {
  const { id } = req.params;
  db.get('SELECT * FROM contracts WHERE id = ?', [id], (err, contract) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!contract) {
      return res.status(404).json({ error: '合同不存在' });
    }
    if (contract.payment_nodes) {
      contract.payment_nodes = JSON.parse(contract.payment_nodes);
    }
    res.json(contract);
  });
};

exports.createContract = (req, res) => {
  const { error, value } = contractSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  const paymentNodesStr = value.payment_nodes ? JSON.stringify(value.payment_nodes) : null;

  const sql = `INSERT INTO contracts 
    (contract_no, contract_name, party_a, party_b, contract_amount, start_date, end_date, 
     renewal_clause, electronic_sign_status, paper_archived, payment_nodes, responsible_person, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  const params = [
    value.contract_no, value.contract_name, value.party_a, value.party_b, value.contract_amount,
    value.start_date, value.end_date, value.renewal_clause, value.electronic_sign_status,
    value.paper_archived ? 1 : 0, paymentNodesStr, value.responsible_person, value.status
  ];

  db.run(sql, params, function(err) {
    if (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({ error: '合同编号已存在' });
      }
      return res.status(500).json({ error: err.message });
    }
    res.status(201).json({ id: this.lastID, ...value });
  });
};

exports.updateContract = (req, res) => {
  const { id } = req.params;
  const { changed_by } = req.body;

  if (!changed_by) {
    return res.status(400).json({ error: '操作人不能为空' });
  }

  db.get('SELECT * FROM contracts WHERE id = ?', [id], (err, oldContract) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!oldContract) {
      return res.status(404).json({ error: '合同不存在' });
    }

    const updateFields = [];
    const updateValues = [];
    const historyRecords = [];

    const trackFields = ['electronic_sign_status', 'paper_archived', 'payment_nodes', 'status', 'responsible_person'];

    for (const field of trackFields) {
      if (req.body[field] !== undefined) {
        let oldValue = oldContract[field];
        let newValue = req.body[field];

        if (field === 'payment_nodes') {
          oldValue = oldContract.payment_nodes;
          newValue = JSON.stringify(req.body[field]);
        } else if (field === 'paper_archived') {
          oldValue = oldContract.paper_archived ? 1 : 0;
          newValue = req.body[field] ? 1 : 0;
        }

        if (String(oldValue) !== String(newValue)) {
          updateFields.push(`${field} = ?`);
          updateValues.push(field === 'payment_nodes' ? newValue : req.body[field]);
          historyRecords.push({
            contract_id: id,
            field_name: field,
            old_value: String(oldValue),
            new_value: String(newValue),
            changed_by
          });
        }
      }
    }

    if (updateFields.length === 0) {
      return res.json({ message: '没有需要更新的字段' });
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(id);

    const updateSql = `UPDATE contracts SET ${updateFields.join(', ')} WHERE id = ?`;

    db.run(updateSql, updateValues, function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      const historySql = `INSERT INTO status_history 
        (contract_id, field_name, old_value, new_value, changed_by)
        VALUES (?, ?, ?, ?, ?)`;

      historyRecords.forEach(record => {
        db.run(historySql, [
          record.contract_id,
          record.field_name,
          record.old_value,
          record.new_value,
          record.changed_by
        ]);
      });

      res.json({ 
        message: '更新成功', 
        changes: historyRecords.length,
        fields: historyRecords.map(r => r.field_name)
      });
    });
  });
};

exports.getContractHistory = (req, res) => {
  const { id } = req.params;
  db.all('SELECT * FROM status_history WHERE contract_id = ? ORDER BY changed_at DESC', [id], (err, history) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(history);
  });
};

exports.getDashboardStats = (req, res) => {
  const stats = {};
  
  db.get('SELECT COUNT(*) as total FROM contracts', (err, result) => {
    stats.total = result.total;
    
    db.get('SELECT COUNT(*) as active FROM contracts WHERE status = "active"', (err, result) => {
      stats.active = result.active;
      
      db.get('SELECT COUNT(*) as pending_sign FROM contracts WHERE electronic_sign_status = "pending"', (err, result) => {
        stats.pending_sign = result.pending_sign;
        
        db.get('SELECT COUNT(*) as not_archived FROM contracts WHERE paper_archived = 0', (err, result) => {
          stats.not_archived = result.not_archived;
          
          db.all('SELECT responsible_person, COUNT(*) as count FROM contracts GROUP BY responsible_person', (err, result) => {
            stats.by_responsible = result;
            
            res.json(stats);
          });
        });
      });
    });
  });
};
