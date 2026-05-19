const fs = require('fs');
const path = require('path');
const db = require('../db');
const { maskObject } = require('../utils/mask');

class ExportService {
  exportReceiveOrders(outputPath, filters = {}) {
    let sql = 'SELECT * FROM receive_orders WHERE 1=1';
    const params = [];

    if (filters.engineer_id) {
      sql += ' AND engineer_id = ?';
      params.push(filters.engineer_id);
    }

    if (filters.old_part_returned !== undefined) {
      sql += ' AND old_part_returned = ?';
      params.push(filters.old_part_returned ? 1 : 0);
    }

    if (filters.claim_status) {
      sql += ' AND claim_status = ?';
      params.push(filters.claim_status);
    }

    sql += ' ORDER BY created_at DESC';

    const orders = db.prepare(sql).all(...params);
    const maskedOrders = orders.map(order => maskObject(order));

    return this.writeCSV(outputPath, maskedOrders);
  }

  exportClaims(outputPath, claimId = null) {
    let claims;
    if (claimId) {
      claims = db.prepare('SELECT * FROM claims WHERE id = ?').all(claimId);
    } else {
      claims = db.prepare('SELECT * FROM claims ORDER BY created_at DESC').all();
    }

    const allItems = [];
    for (const claim of claims) {
      const items = db.prepare('SELECT * FROM claim_items WHERE claim_id = ?').all(claim.id);
      items.forEach(item => {
        allItems.push({
          claim_no: claim.claim_no,
          vendor_code: claim.vendor_code,
          vendor_name: claim.vendor_name,
          claim_date: claim.claim_date,
          claim_status: claim.status,
          ...maskObject(item),
        });
      });
    }

    return this.writeCSV(outputPath, allItems);
  }

  exportRuleResults(outputPath, dataNo = null) {
    let results;
    if (dataNo) {
      results = db.prepare('SELECT * FROM rule_results WHERE data_no = ? ORDER BY created_at DESC').all(dataNo);
    } else {
      results = db.prepare('SELECT * FROM rule_results ORDER BY created_at DESC').all();
    }

    return this.writeCSV(outputPath, results);
  }

  writeCSV(filePath, data) {
    if (!data || data.length === 0) {
      return { success: false, error: '没有数据可导出' };
    }

    const headers = Object.keys(data[0]);
    const lines = [headers.join(',')];

    for (const row of data) {
      const values = headers.map(h => {
        let value = row[h];
        if (value === null || value === undefined) value = '';
        value = String(value).replace(/"/g, '""');
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          value = `"${value}"`;
        }
        return value;
      });
      lines.push(values.join(','));
    }

    const outputDir = path.dirname(filePath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(filePath, lines.join('\n'));

    return {
      success: true,
      filePath,
      count: data.length,
    };
  }
}

module.exports = new ExportService();
