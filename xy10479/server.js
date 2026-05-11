const express = require('express');
const bodyParser = require('body-parser');
const db = require('./db');

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

function generateId() {
  return 'id_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

function daysBetween(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24));
}

function calculateHealthScore(customerId, callback) {
  const today = new Date().toISOString().split('T')[0];
  const riskReasons = [];
  let score = 100;

  db.all(`SELECT * FROM contracts WHERE customer_id = ? AND status = 'active'`, [customerId], (err, contracts) => {
    if (err) return callback(err);
    
    if (contracts.length > 0) {
      const contract = contracts[0];
      const daysToExpiry = daysBetween(today, contract.end_date);
      
      if (daysToExpiry <= 30) {
        score -= 30;
        riskReasons.push(`合同即将到期（剩余${daysToExpiry}天）`);
      } else if (daysToExpiry <= 90) {
        score -= 15;
        riskReasons.push(`合同将在90天内到期`);
      }
    }

    db.all(`SELECT * FROM usage_records WHERE customer_id = ? ORDER BY month DESC LIMIT 3`, [customerId], (err, usages) => {
      if (err) return callback(err);
      
      if (usages.length >= 2) {
        const latest = usages[0];
        const previous = usages[1];
        const decline = ((previous.value - latest.value) / previous.value) * 100;
        
        if (decline >= 30) {
          score -= 25;
          riskReasons.push(`使用量大幅下降（${decline.toFixed(1)}%）`);
        } else if (decline >= 15) {
          score -= 15;
          riskReasons.push(`使用量明显下降（${decline.toFixed(1)}%）`);
        }
      }

      db.all(`SELECT * FROM tickets WHERE customer_id = ? AND status IN ('open', 'in_progress')`, [customerId], (err, openTickets) => {
        if (err) return callback(err);
        
        const criticalTickets = openTickets.filter(t => t.severity === 'critical');
        const highTickets = openTickets.filter(t => t.severity === 'high');
        
        if (criticalTickets.length > 0) {
          score -= criticalTickets.length * 15;
          riskReasons.push(`存在${criticalTickets.length}个严重未关闭工单`);
        }
        if (highTickets.length > 0) {
          score -= highTickets.length * 8;
          riskReasons.push(`存在${highTickets.length}个高优先级未关闭工单`);
        }

        db.all(`SELECT * FROM risk_exemptions WHERE customer_id = ? AND next_review_date >= ?`, [customerId, today], (err, exemptions) => {
          if (err) return callback(err);
          
          let riskLevel;
          if (score >= 80) riskLevel = 'low';
          else if (score >= 60) riskLevel = 'medium';
          else if (score >= 40) riskLevel = 'high';
          else riskLevel = 'critical';

          callback(null, {
            score: Math.max(0, score),
            riskLevel,
            riskReasons,
            exemptions
          });
        });
      });
    });
  });
}

function saveHealthScore(customerId, result) {
  const id = generateId();
  db.run(`
    INSERT INTO health_scores (id, customer_id, score, risk_level, risk_reasons)
    VALUES (?, ?, ?, ?, ?)
  `, [id, customerId, result.score, result.riskLevel, JSON.stringify(result.riskReasons)]);
}

app.post('/api/customers', (req, res) => {
  const { name, industry, csm_id, csm_name } = req.body;
  const id = generateId();
  
  db.run(`
    INSERT INTO customers (id, name, industry, csm_id, csm_name)
    VALUES (?, ?, ?, ?, ?)
  `, [id, name, industry, csm_id, csm_name], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id, name, industry, csm_id, csm_name });
  });
});

app.get('/api/customers', (req, res) => {
  db.all(`SELECT * FROM customers`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/contracts', (req, res) => {
  const { customer_id, contract_no, start_date, end_date, amount } = req.body;
  const id = generateId();
  
  db.run(`
    INSERT INTO contracts (id, customer_id, contract_no, start_date, end_date, amount)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [id, customer_id, contract_no, start_date, end_date, amount], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    
    calculateHealthScore(customer_id, (err, result) => {
      if (!err) saveHealthScore(customer_id, result);
    });
    
    res.json({ id, customer_id, contract_no, start_date, end_date, amount });
  });
});

app.get('/api/contracts', (req, res) => {
  const { customer_id } = req.query;
  let query = `SELECT * FROM contracts`;
  let params = [];
  
  if (customer_id) {
    query += ` WHERE customer_id = ?`;
    params.push(customer_id);
  }
  
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/usage', (req, res) => {
  const { customer_id, month, value, unit } = req.body;
  const id = generateId();
  
  db.run(`
    INSERT INTO usage_records (id, customer_id, month, value, unit)
    VALUES (?, ?, ?, ?, ?)
  `, [id, customer_id, month, value, unit], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    
    calculateHealthScore(customer_id, (err, result) => {
      if (!err) saveHealthScore(customer_id, result);
    });
    
    res.json({ id, customer_id, month, value, unit });
  });
});

app.get('/api/usage', (req, res) => {
  const { customer_id } = req.query;
  let query = `SELECT * FROM usage_records`;
  let params = [];
  
  if (customer_id) {
    query += ` WHERE customer_id = ?`;
    params.push(customer_id);
  }
  query += ` ORDER BY month DESC`;
  
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/tickets', (req, res) => {
  const { customer_id, title, severity, status, satisfaction_score } = req.body;
  const id = generateId();
  
  db.run(`
    INSERT INTO tickets (id, customer_id, title, severity, status, satisfaction_score)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [id, customer_id, title, severity, status, satisfaction_score], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    
    calculateHealthScore(customer_id, (err, result) => {
      if (!err) saveHealthScore(customer_id, result);
    });
    
    res.json({ id, customer_id, title, severity, status, satisfaction_score });
  });
});

app.put('/api/tickets/:id', (req, res) => {
  const { status, satisfaction_score } = req.body;
  const closed_at = status === 'closed' ? new Date().toISOString() : null;
  
  db.get(`SELECT customer_id FROM tickets WHERE id = ?`, [req.params.id], (err, ticket) => {
    if (err || !ticket) return res.status(404).json({ error: 'Ticket not found' });
    
    db.run(`
      UPDATE tickets SET status = ?, satisfaction_score = ?, closed_at = ? WHERE id = ?
    `, [status, satisfaction_score, closed_at, req.params.id], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      
      calculateHealthScore(ticket.customer_id, (err, result) => {
        if (!err) saveHealthScore(ticket.customer_id, result);
      });
      
      res.json({ success: true });
    });
  });
});

app.get('/api/tickets', (req, res) => {
  const { customer_id, status } = req.query;
  let query = `SELECT * FROM tickets WHERE 1=1`;
  let params = [];
  
  if (customer_id) {
    query += ` AND customer_id = ?`;
    params.push(customer_id);
  }
  if (status) {
    query += ` AND status = ?`;
    params.push(status);
  }
  
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/renewal-opportunities', (req, res) => {
  const { customer_id, contract_id, amount, stage, probability, notes } = req.body;
  const id = generateId();
  
  db.get(`SELECT * FROM renewal_opportunities WHERE customer_id = ? AND contract_id = ?`, 
    [customer_id, contract_id], (err, existing) => {
      if (err) return res.status(500).json({ error: err.message });
      if (existing) return res.status(400).json({ error: '续约机会已存在，请勿重复创建' });
      
      db.run(`
        INSERT INTO renewal_opportunities (id, customer_id, contract_id, amount, stage, probability, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [id, customer_id, contract_id, amount, stage || 'identified', probability || 0.2, notes], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id, customer_id, contract_id, amount, stage, probability, notes });
      });
    });
});

app.put('/api/renewal-opportunities/:id', (req, res) => {
  const { stage, probability, notes } = req.body;
  
  db.run(`
    UPDATE renewal_opportunities 
    SET stage = ?, probability = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [stage, probability, notes, req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, stage, probability });
  });
});

app.get('/api/renewal-opportunities', (req, res) => {
  const { customer_id, stage } = req.query;
  let query = `SELECT * FROM renewal_opportunities WHERE 1=1`;
  let params = [];
  
  if (customer_id) {
    query += ` AND customer_id = ?`;
    params.push(customer_id);
  }
  if (stage) {
    query += ` AND stage = ?`;
    params.push(stage);
  }
  
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/follow-up', (req, res) => {
  const { customer_id, csm_id, type, content, next_follow_up_date } = req.body;
  const id = generateId();
  
  db.run(`
    INSERT INTO follow_up_records (id, customer_id, csm_id, type, content, next_follow_up_date)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [id, customer_id, csm_id, type, content, next_follow_up_date], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id, customer_id, csm_id, type, content, next_follow_up_date });
  });
});

app.get('/api/follow-up', (req, res) => {
  const { customer_id } = req.query;
  let query = `SELECT * FROM follow_up_records`;
  let params = [];
  
  if (customer_id) {
    query += ` WHERE customer_id = ?`;
    params.push(customer_id);
  }
  query += ` ORDER BY created_at DESC`;
  
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/risk-exemptions', (req, res) => {
  const { customer_id, risk_type, reason, exempted_by, next_review_date } = req.body;
  const id = generateId();
  
  db.run(`
    INSERT INTO risk_exemptions (id, customer_id, risk_type, reason, exempted_by, next_review_date)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [id, customer_id, risk_type, reason, exempted_by, next_review_date], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    
    if (next_review_date) {
      const followUpId = generateId();
      db.run(`
        INSERT INTO follow_up_records (id, customer_id, csm_id, type, content, next_follow_up_date)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [followUpId, customer_id, exempted_by, 'risk_review', `风险豁免后跟进：${reason}`, next_review_date]);
    }
    
    res.json({ id, customer_id, risk_type, reason, exempted_by, next_review_date });
  });
});

app.get('/api/risk-exemptions', (req, res) => {
  const { customer_id } = req.query;
  let query = `SELECT * FROM risk_exemptions`;
  let params = [];
  
  if (customer_id) {
    query += ` WHERE customer_id = ?`;
    params.push(customer_id);
  }
  query += ` ORDER BY exempted_at DESC`;
  
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/health/:customerId', (req, res) => {
  calculateHealthScore(req.params.customerId, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    saveHealthScore(req.params.customerId, result);
    res.json(result);
  });
});

app.get('/api/health-customers', (req, res) => {
  db.all(`SELECT c.*, h.score, h.risk_level 
          FROM customers c 
          JOIN health_scores h ON c.id = h.customer_id
          WHERE h.score >= 80
          ORDER BY h.score DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/risk-customers', (req, res) => {
  const { risk_level } = req.query;
  let query = `SELECT c.*, h.score, h.risk_level, h.risk_reasons
               FROM customers c 
               JOIN health_scores h ON c.id = h.customer_id
               WHERE h.score < 80`;
  let params = [];
  
  if (risk_level) {
    query += ` AND h.risk_level = ?`;
    params.push(risk_level);
  }
  query += ` ORDER BY h.score ASC`;
  
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    const result = rows.map(row => ({
      ...row,
      risk_reasons: JSON.parse(row.risk_reasons || '[]')
    }));
    
    res.json(result);
  });
});

app.get('/api/renewal-prediction', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  
  db.all(`
    SELECT 
      c.id as customer_id,
      c.name as customer_name,
      c.csm_id,
      c.csm_name,
      ct.id as contract_id,
      ct.contract_no,
      ct.end_date,
      ct.amount as contract_amount,
      ro.stage as opportunity_stage,
      ro.probability as renewal_probability,
      (ct.amount * COALESCE(ro.probability, 0.1)) as predicted_renewal_amount
    FROM customers c
    JOIN contracts ct ON c.id = ct.customer_id
    LEFT JOIN renewal_opportunities ro ON c.id = ro.customer_id AND ct.id = ro.contract_id
    WHERE ct.status = 'active' AND ct.end_date >= ?
    ORDER BY ct.end_date ASC
  `, [today], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    const totalPredicted = rows.reduce((sum, row) => sum + (row.predicted_renewal_amount || 0), 0);
    const totalContract = rows.reduce((sum, row) => sum + row.contract_amount, 0);
    
    res.json({
      total_contract_amount: totalContract,
      total_predicted_renewal: totalPredicted,
      renewal_rate_prediction: totalContract > 0 ? (totalPredicted / totalContract * 100).toFixed(1) : 0,
      opportunities: rows
    });
  });
});

app.get('/api/follow-up-pending', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  
  db.all(`
    SELECT 
      c.id as customer_id,
      c.name as customer_name,
      c.csm_id,
      c.csm_name,
      f.id as follow_up_id,
      f.type,
      f.content,
      f.next_follow_up_date,
      h.risk_level
    FROM follow_up_records f
    JOIN customers c ON f.customer_id = c.id
    LEFT JOIN health_scores h ON c.id = h.customer_id
    WHERE f.next_follow_up_date IS NOT NULL AND f.next_follow_up_date <= ?
    ORDER BY f.next_follow_up_date ASC
  `, [today], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/csm-funnel', (req, res) => {
  const stages = ['identified', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost'];
  
  db.all(`
    SELECT 
      c.csm_id,
      c.csm_name,
      ro.stage,
      COUNT(*) as count,
      SUM(ro.amount) as total_amount
    FROM renewal_opportunities ro
    JOIN customers c ON ro.customer_id = c.id
    GROUP BY c.csm_id, c.csm_name, ro.stage
    ORDER BY c.csm_name, ro.stage
  `, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    const csmMap = {};
    rows.forEach(row => {
      const key = row.csm_id || 'unassigned';
      if (!csmMap[key]) {
        csmMap[key] = {
          csm_id: row.csm_id,
          csm_name: row.csm_name || '未分配',
          funnel: {},
          total_amount: 0,
          total_count: 0,
          won_amount: 0,
          won_count: 0
        };
        stages.forEach(s => csmMap[key].funnel[s] = { count: 0, amount: 0 });
      }
      
      csmMap[key].funnel[row.stage] = {
        count: row.count,
        amount: row.total_amount
      };
      csmMap[key].total_amount += row.total_amount;
      csmMap[key].total_count += row.count;
      
      if (row.stage === 'closed_won') {
        csmMap[key].won_amount += row.total_amount;
        csmMap[key].won_count += row.count;
      }
    });
    
    const result = Object.values(csmMap).map(csm => ({
      ...csm,
      win_rate: csm.total_count > 0 ? (csm.won_count / csm.total_count * 100).toFixed(1) : '0.0'
    }));
    
    res.json(result);
  });
});

app.get('/api/dashboard', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  
  db.all(`SELECT * FROM health_scores`, [], (err, healthScores) => {
    if (err) return res.status(500).json({ error: err.message });
    
    const totalCustomers = healthScores.length;
    const healthy = healthScores.filter(h => h.score >= 80).length;
    const atRisk = healthScores.filter(h => h.score < 60).length;
    
    db.all(`SELECT COUNT(*) as count FROM follow_up_records WHERE next_follow_up_date IS NOT NULL AND next_follow_up_date <= ?`, [today], (err, pendingFollowUps) => {
      db.all(`SELECT SUM(amount * probability) as predicted FROM renewal_opportunities`, [], (err, renewalPrediction) => {
        res.json({
          total_customers: totalCustomers,
          healthy_customers: healthy,
          at_risk_customers: atRisk,
          pending_follow_ups: pendingFollowUps[0]?.count || 0,
          predicted_renewal: renewalPrediction[0]?.predicted || 0,
          health_distribution: {
            low_risk: healthScores.filter(h => h.risk_level === 'low').length,
            medium_risk: healthScores.filter(h => h.risk_level === 'medium').length,
            high_risk: healthScores.filter(h => h.risk_level === 'high').length,
            critical_risk: healthScores.filter(h => h.risk_level === 'critical').length
          }
        });
      });
    });
  });
});

app.listen(PORT, () => {
  console.log(`客户成功续约API服务已启动，端口: ${PORT}`);
});
