const { v4: uuidv4 } = require('uuid');
const { run, get, all } = require('../db');
const { Parser } = require('json2csv');

class ReportExceptionService {
  async logException(requestType, requestData, errorMessage, processResult, operator) {
    const id = uuidv4();
    const now = new Date().toISOString();

    await run(`
      INSERT INTO exception_logs 
      (id, request_type, request_data, error_message, process_result, operator, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [id, requestType, JSON.stringify(requestData), errorMessage, processResult, operator, now]);

    return get('SELECT * FROM exception_logs WHERE id = ?', [id]);
  }

  async getExceptionLogs(filters = {}) {
    let sql = 'SELECT * FROM exception_logs WHERE 1=1';
    const params = [];

    if (filters.request_type) {
      sql += ' AND request_type = ?';
      params.push(filters.request_type);
    }

    sql += ' ORDER BY created_at DESC';
    return all(sql, params);
  }

  async getExceptionLogById(id) {
    return get('SELECT * FROM exception_logs WHERE id = ?', [id]);
  }

  async getManualCorrections(filters = {}) {
    let sql = 'SELECT * FROM manual_corrections WHERE 1=1';
    const params = [];

    if (filters.target_type) {
      sql += ' AND target_type = ?';
      params.push(filters.target_type);
    }

    sql += ' ORDER BY created_at DESC';
    return all(sql, params);
  }

  async generateVerificationReport(startDate, endDate, storeId = null) {
    let sql = `
      SELECT 
        vr.*,
        c.name as customer_name,
        c.phone as customer_phone,
        s.name as store_name,
        tp.name as package_name
      FROM verification_records vr
      JOIN customers c ON vr.customer_id = c.id
      JOIN stores s ON vr.store_id = s.id
      JOIN treatment_packages tp ON vr.package_id = tp.id
      WHERE vr.verify_date >= ? AND vr.verify_date <= ?
    `;
    const params = [startDate, endDate];

    if (storeId) {
      sql += ' AND vr.store_id = ?';
      params.push(storeId);
    }

    sql += ' ORDER BY vr.verify_date DESC';

    const records = await all(sql, params);

    const summary = await get(`
      SELECT 
        COUNT(*) as total_verifications,
        SUM(verify_count) as total_count,
        SUM(use_gift_count) as total_gift_count
      FROM verification_records
      WHERE verify_date >= ? AND verify_date <= ?
      ${storeId ? ' AND store_id = ?' : ''}
    `, params);

    return {
      summary,
      records
    };
  }

  async generatePackageReport(storeId = null) {
    let sql = `
      SELECT 
        tp.*,
        c.name as customer_name,
        c.phone as customer_phone,
        s.name as store_name
      FROM treatment_packages tp
      JOIN customers c ON tp.customer_id = c.id
      JOIN stores s ON tp.current_store_id = s.id
      WHERE 1=1
    `;
    const params = [];

    if (storeId) {
      sql += ' AND tp.current_store_id = ?';
      params.push(storeId);
    }

    sql += ' ORDER BY tp.created_at DESC';

    const packages = await all(sql, params);

    const summary = await get(`
      SELECT 
        COUNT(*) as total_packages,
        SUM(total_count) as total_count,
        SUM(remaining_count) as total_remaining_count
      FROM treatment_packages
      ${storeId ? ' WHERE current_store_id = ?' : ''}
    `, params);

    return {
      summary,
      packages
    };
  }

  async exportToCSV(data, fields) {
    const parser = new Parser({ fields });
    return parser.parse(data);
  }

  async getFullCustomerInfo(customerId) {
    const customer = await get('SELECT * FROM customers WHERE id = ?', [customerId]);
    if (!customer) return null;

    const packages = await all(`
      SELECT 
        tp.*,
        s.name as store_name
      FROM treatment_packages tp
      JOIN stores s ON tp.current_store_id = s.id
      WHERE tp.customer_id = ?
      ORDER BY tp.created_at DESC
    `, [customerId]);

    const verifications = await all(`
      SELECT 
        vr.*,
        s.name as store_name,
        tp.name as package_name
      FROM verification_records vr
      JOIN stores s ON vr.store_id = s.id
      JOIN treatment_packages tp ON vr.package_id = tp.id
      WHERE vr.customer_id = ?
      ORDER BY vr.verify_date DESC
    `, [customerId]);

    const gifts = await all(`
      SELECT 
        gr.*,
        tp.name as package_name
      FROM gift_records gr
      JOIN treatment_packages tp ON gr.package_id = tp.id
      WHERE tp.customer_id = ?
      ORDER BY gr.created_at DESC
    `, [customerId]);

    return {
      customer,
      packages,
      verifications,
      gifts
    };
  }
}

module.exports = new ReportExceptionService();
