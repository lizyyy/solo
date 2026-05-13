const db = require('../database/db');

exports.getAllExceptions = (req, res) => {
  const { resolved, severity, contract_id } = req.query;
  
  let query = 'SELECT e.*, c.contract_no, c.contract_name FROM exceptions e ' +
              'LEFT JOIN contracts c ON e.contract_id = c.id WHERE 1=1';
  const params = [];

  if (resolved !== undefined) {
    query += ' AND e.resolved = ?';
    params.push(resolved === 'true' ? 1 : 0);
  }

  if (severity) {
    query += ' AND e.severity = ?';
    params.push(severity);
  }

  if (contract_id) {
    query += ' AND e.contract_id = ?';
    params.push(contract_id);
  }

  query += ' ORDER BY e.created_at DESC';

  db.all(query, params, (err, exceptions) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(exceptions);
  });
};

exports.createException = (req, res) => {
  const { contract_id, exception_type, description, severity = 'medium' } = req.body;

  if (!contract_id || !exception_type) {
    return res.status(400).json({ error: '合同ID和异常类型必填' });
  }

  const sql = `INSERT INTO exceptions 
    (contract_id, exception_type, description, severity)
    VALUES (?, ?, ?, ?)`;

  db.run(sql, [contract_id, exception_type, description, severity], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.status(201).json({ id: this.lastID, message: '异常记录创建成功' });
  });
};

exports.resolveException = (req, res) => {
  const { id } = req.params;
  const { resolved_by } = req.body;

  if (!resolved_by) {
    return res.status(400).json({ error: '处理人不能为空' });
  }

  const sql = `UPDATE exceptions 
    SET resolved = 1, resolved_by = ?, resolved_at = CURRENT_TIMESTAMP
    WHERE id = ?`;

  db.run(sql, [resolved_by, id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: '异常记录不存在' });
    }
    res.json({ message: '异常已处理' });
  });
};

exports.generateExceptions = (req, res) => {
  const exceptionSql = `
    SELECT id, contract_no, contract_name, end_date, electronic_sign_status, paper_archived
    FROM contracts WHERE status = 'active'
  `;

  db.all(exceptionSql, [], (err, contracts) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    const exceptions = [];
    const today = new Date();

    contracts.forEach(contract => {
      const endDate = new Date(contract.end_date);
      const daysUntilEnd = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));

      if (daysUntilEnd <= 30 && daysUntilEnd > 0) {
        exceptions.push({
          contract_id: contract.id,
          exception_type: 'contract_expiring',
          description: `合同即将到期，剩余 ${daysUntilEnd} 天`,
          severity: daysUntilEnd <= 7 ? 'high' : 'medium'
        });
      }

      if (contract.electronic_sign_status === 'pending') {
        exceptions.push({
          contract_id: contract.id,
          exception_type: 'pending_signature',
          description: '电子签待签署',
          severity: 'medium'
        });
      }

      if (!contract.paper_archived) {
        exceptions.push({
          contract_id: contract.id,
          exception_type: 'paper_not_archived',
          description: '纸质合同未归档',
          severity: 'low'
        });
      }
    });

    const insertSql = `INSERT INTO exceptions 
      (contract_id, exception_type, description, severity)
      VALUES (?, ?, ?, ?)`;

    let created = 0;
    exceptions.forEach(ex => {
      db.get('SELECT id FROM exceptions WHERE contract_id = ? AND exception_type = ? AND resolved = 0',
        [ex.contract_id, ex.exception_type], (err, exists) => {
          if (!exists) {
            db.run(insertSql, [ex.contract_id, ex.exception_type, ex.description, ex.severity]);
            created++;
          }
        });
    });

    setTimeout(() => {
      res.json({ 
        message: `异常扫描完成，新增 ${created} 条异常记录`,
        total_scanned: contracts.length,
        new_exceptions: created
      });
    }, 500);
  });
};
