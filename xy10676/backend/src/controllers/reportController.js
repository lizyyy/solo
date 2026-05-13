const db = require('../database/db');
const { Parser } = require('json2csv');

exports.exportContracts = (req, res) => {
  const { responsible_person, start_date, end_date, format = 'json' } = req.query;

  let query = `
    SELECT c.*,
           GROUP_CONCAT(
             CASE WHEN sh.id IS NOT NULL THEN 
               json_object('field', sh.field_name, 'old', sh.old_value, 'new', sh.new_value, 'by', sh.changed_by, 'at', sh.changed_at)
             END
           ) as history
    FROM contracts c
    LEFT JOIN status_history sh ON c.id = sh.contract_id
    WHERE 1=1
  `;
  const params = [];

  if (responsible_person) {
    query += ' AND c.responsible_person = ?';
    params.push(responsible_person);
  }

  if (start_date) {
    query += ' AND c.updated_at >= ?';
    params.push(start_date);
  }

  if (end_date) {
    query += ' AND c.updated_at <= ?';
    params.push(end_date);
  }

  query += ' GROUP BY c.id ORDER BY c.updated_at DESC';

  db.all(query, params, (err, contracts) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    contracts.forEach(c => {
      if (c.payment_nodes) {
        c.payment_nodes = JSON.parse(c.payment_nodes);
      }
      if (c.history) {
        try {
          c.history = c.history.split('},{').map((h, i, arr) => {
            if (i === 0) h = h + '}';
            else if (i === arr.length - 1) h = '{' + h;
            else h = '{' + h + '}';
            return JSON.parse(h);
          });
        } catch (e) {
          c.history = [];
        }
      } else {
        c.history = [];
      }
    });

    if (format === 'csv') {
      const fields = [
        'id', 'contract_no', 'contract_name', 'party_a', 'party_b',
        'contract_amount', 'start_date', 'end_date', 'electronic_sign_status',
        'paper_archived', 'responsible_person', 'status', 'created_at', 'updated_at'
      ];
      const json2csvParser = new Parser({ fields });
      const csv = json2csvParser.parse(contracts);
      
      res.header('Content-Type', 'text/csv');
      res.attachment('contracts_report.csv');
      return res.send(csv);
    }

    res.json({
      total: contracts.length,
      filters: { responsible_person, start_date, end_date },
      data: contracts
    });
  });
};

exports.getChangeLogs = (req, res) => {
  const { field_name, changed_by, start_date, end_date, page = 1, limit = 50 } = req.query;

  let query = `
    SELECT sh.*, c.contract_no, c.contract_name
    FROM status_history sh
    LEFT JOIN contracts c ON sh.contract_id = c.id
    WHERE 1=1
  `;
  let countQuery = 'SELECT COUNT(*) as total FROM status_history WHERE 1=1';
  const params = [];
  const countParams = [];

  if (field_name) {
    query += ' AND sh.field_name = ?';
    countQuery += ' AND field_name = ?';
    params.push(field_name);
    countParams.push(field_name);
  }

  if (changed_by) {
    query += ' AND sh.changed_by = ?';
    countQuery += ' AND changed_by = ?';
    params.push(changed_by);
    countParams.push(changed_by);
  }

  if (start_date) {
    query += ' AND sh.changed_at >= ?';
    countQuery += ' AND changed_at >= ?';
    params.push(start_date);
    countParams.push(start_date);
  }

  if (end_date) {
    query += ' AND sh.changed_at <= ?';
    countQuery += ' AND changed_at <= ?';
    params.push(end_date);
    countParams.push(end_date);
  }

  query += ' ORDER BY sh.changed_at DESC LIMIT ? OFFSET ?';
  const offset = (page - 1) * limit;
  const queryParams = [...params, parseInt(limit), offset];

  db.all(query, queryParams, (err, logs) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    db.get(countQuery, countParams, (err, result) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({
        data: logs,
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
