const createObjectCsvWriter = require('csv-writer').createObjectCsvWriter;
const { db } = require('../database');
const logger = require('../logger');
const { maskData } = require('../middleware/dataMasking');
const path = require('path');
const fs = require('fs');

const exportDir = path.join(__dirname, '../exports');

if (!fs.existsSync(exportDir)) {
  fs.mkdirSync(exportDir, { recursive: true });
}

const exportClaims = async (filters = {}) => {
  return new Promise((resolve, reject) => {
    let query = `
      SELECT 
        c.id,
        c.request_id,
        e.engineer_code,
        e.engineer_name,
        p.part_code,
        p.part_name,
        c.quantity,
        c.status,
        c.requested_at,
        c.notes
      FROM claims c
      JOIN engineers e ON c.engineer_id = e.id
      JOIN parts p ON c.part_id = p.id
      WHERE 1=1
    `;
    const params = [];
    
    if (filters.start_date) {
      query += ' AND c.requested_at >= ?';
      params.push(filters.start_date);
    }
    if (filters.end_date) {
      query += ' AND c.requested_at <= ?';
      params.push(filters.end_date);
    }
    if (filters.engineer_code) {
      query += ' AND e.engineer_code = ?';
      params.push(filters.engineer_code);
    }
    if (filters.status) {
      query += ' AND c.status = ?';
      params.push(filters.status);
    }
    
    query += ' ORDER BY c.requested_at DESC';
    
    db.all(query, params, async (err, rows) => {
      if (err) {
        logger.error('Failed to get claims for export', { error: err.message });
        return reject(err);
      }
      
      const maskedRows = maskData(rows);
      const filename = `claims_${Date.now()}.csv`;
      const filePath = path.join(exportDir, filename);
      
      const csvWriter = createObjectCsvWriter({
        path: filePath,
        header: [
          { id: 'id', title: 'ID' },
          { id: 'request_id', title: 'Request ID' },
          { id: 'engineer_code', title: 'Engineer Code' },
          { id: 'engineer_name', title: 'Engineer Name' },
          { id: 'part_code', title: 'Part Code' },
          { id: 'part_name', title: 'Part Name' },
          { id: 'quantity', title: 'Quantity' },
          { id: 'status', title: 'Status' },
          { id: 'requested_at', title: 'Requested At' },
          { id: 'notes', title: 'Notes' }
        ]
      });
      
      await csvWriter.writeRecords(maskedRows);
      logger.info('Claims exported', { filename, count: rows.length });
      resolve({ filePath, filename, count: rows.length });
    });
  });
};

const exportReturns = async (filters = {}) => {
  return new Promise((resolve, reject) => {
    let query = `
      SELECT 
        r.id,
        r.request_id,
        r.claim_id,
        p.part_code,
        p.part_name,
        r.quantity,
        r.condition,
        r.warehouse_keeper,
        r.return_date,
        r.notes
      FROM returns r
      JOIN parts p ON r.part_id = p.id
      WHERE 1=1
    `;
    const params = [];
    
    if (filters.start_date) {
      query += ' AND r.return_date >= ?';
      params.push(filters.start_date);
    }
    if (filters.end_date) {
      query += ' AND r.return_date <= ?';
      params.push(filters.end_date);
    }
    if (filters.condition) {
      query += ' AND r.condition = ?';
      params.push(filters.condition);
    }
    
    query += ' ORDER BY r.return_date DESC';
    
    db.all(query, params, async (err, rows) => {
      if (err) {
        logger.error('Failed to get returns for export', { error: err.message });
        return reject(err);
      }
      
      const maskedRows = maskData(rows);
      const filename = `returns_${Date.now()}.csv`;
      const filePath = path.join(exportDir, filename);
      
      const csvWriter = createObjectCsvWriter({
        path: filePath,
        header: [
          { id: 'id', title: 'ID' },
          { id: 'request_id', title: 'Request ID' },
          { id: 'claim_id', title: 'Claim ID' },
          { id: 'part_code', title: 'Part Code' },
          { id: 'part_name', title: 'Part Name' },
          { id: 'quantity', title: 'Quantity' },
          { id: 'condition', title: 'Condition' },
          { id: 'warehouse_keeper', title: 'Warehouse Keeper' },
          { id: 'return_date', title: 'Return Date' },
          { id: 'notes', title: 'Notes' }
        ]
      });
      
      await csvWriter.writeRecords(maskedRows);
      logger.info('Returns exported', { filename, count: rows.length });
      resolve({ filePath, filename, count: rows.length });
    });
  });
};

const exportVendorClaims = async (filters = {}) => {
  return new Promise((resolve, reject) => {
    let query = `
      SELECT 
        vc.id,
        vc.request_id,
        vc.return_id,
        r.claim_id,
        p.part_code,
        vc.vendor_name,
        vc.claim_amount,
        vc.status,
        vc.submitted_at,
        vc.approved_at,
        vc.paid_at,
        vc.notes
      FROM vendor_claims vc
      JOIN returns r ON vc.return_id = r.id
      JOIN parts p ON r.part_id = p.id
      WHERE 1=1
    `;
    const params = [];
    
    if (filters.start_date) {
      query += ' AND vc.submitted_at >= ?';
      params.push(filters.start_date);
    }
    if (filters.end_date) {
      query += ' AND vc.submitted_at <= ?';
      params.push(filters.end_date);
    }
    if (filters.status) {
      query += ' AND vc.status = ?';
      params.push(filters.status);
    }
    if (filters.vendor_name) {
      query += ' AND vc.vendor_name LIKE ?';
      params.push(`%${filters.vendor_name}%`);
    }
    
    query += ' ORDER BY vc.submitted_at DESC';
    
    db.all(query, params, async (err, rows) => {
      if (err) {
        logger.error('Failed to get vendor claims for export', { error: err.message });
        return reject(err);
      }
      
      const maskedRows = maskData(rows);
      const filename = `vendor_claims_${Date.now()}.csv`;
      const filePath = path.join(exportDir, filename);
      
      const csvWriter = createObjectCsvWriter({
        path: filePath,
        header: [
          { id: 'id', title: 'ID' },
          { id: 'request_id', title: 'Request ID' },
          { id: 'return_id', title: 'Return ID' },
          { id: 'claim_id', title: 'Claim ID' },
          { id: 'part_code', title: 'Part Code' },
          { id: 'vendor_name', title: 'Vendor Name' },
          { id: 'claim_amount', title: 'Claim Amount' },
          { id: 'status', title: 'Status' },
          { id: 'submitted_at', title: 'Submitted At' },
          { id: 'approved_at', title: 'Approved At' },
          { id: 'paid_at', title: 'Paid At' },
          { id: 'notes', title: 'Notes' }
        ]
      });
      
      await csvWriter.writeRecords(maskedRows);
      logger.info('Vendor claims exported', { filename, count: rows.length });
      resolve({ filePath, filename, count: rows.length });
    });
  });
};

const exportAuditLogs = async (filters = {}) => {
  return new Promise((resolve, reject) => {
    let query = 'SELECT * FROM audit_logs WHERE 1=1';
    const params = [];
    
    if (filters.start_date) {
      query += ' AND created_at >= ?';
      params.push(filters.start_date);
    }
    if (filters.end_date) {
      query += ' AND created_at <= ?';
      params.push(filters.end_date);
    }
    if (filters.action) {
      query += ' AND action = ?';
      params.push(filters.action);
    }
    if (filters.entity_type) {
      query += ' AND entity_type = ?';
      params.push(filters.entity_type);
    }
    
    query += ' ORDER BY created_at DESC';
    
    db.all(query, params, async (err, rows) => {
      if (err) {
        logger.error('Failed to get audit logs for export', { error: err.message });
        return reject(err);
      }
      
      const maskedRows = maskData(rows);
      const filename = `audit_logs_${Date.now()}.csv`;
      const filePath = path.join(exportDir, filename);
      
      const csvWriter = createObjectCsvWriter({
        path: filePath,
        header: [
          { id: 'id', title: 'ID' },
          { id: 'action', title: 'Action' },
          { id: 'entity_type', title: 'Entity Type' },
          { id: 'entity_id', title: 'Entity ID' },
          { id: 'request_id', title: 'Request ID' },
          { id: 'operator', title: 'Operator' },
          { id: 'details', title: 'Details' },
          { id: 'created_at', title: 'Created At' }
        ]
      });
      
      await csvWriter.writeRecords(maskedRows);
      logger.info('Audit logs exported', { filename, count: rows.length });
      resolve({ filePath, filename, count: rows.length });
    });
  });
};

module.exports = {
  exportClaims,
  exportReturns,
  exportVendorClaims,
  exportAuditLogs,
  exportDir
};
