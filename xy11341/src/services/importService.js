const fs = require('fs');
const csv = require('csv-parser');
const db = require('../db');
const { logAction } = require('../utils/audit');

class ImportService {
  async importReceiveOrders(filePath) {
    const results = {
      success: [],
      failed: [],
      total: 0,
    };

    return new Promise((resolve) => {
      const stream = fs.createReadStream(filePath)
        .pipe(csv({
          mapHeaders: ({ header }) => header.trim(),
          mapValues: ({ value }) => value.trim(),
        }));

      stream.on('data', (row) => {
        stream.pause();
        results.total++;
        
        try {
          const result = this.processReceiveOrderRow(row);
          if (result.success) {
            results.success.push(result);
          } else {
            results.failed.push(result);
          }
        } catch (error) {
          results.failed.push({
            row: results.total,
            orderNo: row.order_no || 'N/A',
            success: false,
            error: error.message,
          });
        }
        
        stream.resume();
      });

      stream.on('end', () => {
        resolve(results);
      });

      stream.on('error', (error) => {
        resolve({ ...results, error: error.message });
      });
    });
  }

  processReceiveOrderRow(row) {
    const requiredFields = ['order_no', 'engineer_id', 'engineer_name', 'engineer_phone', 
                            'part_code', 'part_name', 'batch_no', 'receive_date'];
    const missingFields = requiredFields.filter(f => !row[f]);
    
    if (missingFields.length > 0) {
      return {
        orderNo: row.order_no || 'N/A',
        success: false,
        error: `缺少必填字段: ${missingFields.join(', ')}`,
      };
    }

    const existing = db.prepare('SELECT id FROM receive_orders WHERE order_no = ?').get(row.order_no);
    if (existing) {
      return {
        orderNo: row.order_no,
        success: false,
        error: '领件单号已存在',
      };
    }

    const insertStmt = db.prepare(`
      INSERT INTO receive_orders 
      (order_no, engineer_id, engineer_name, engineer_phone, part_code, part_name, batch_no, 
       quantity, receive_date, old_part_expected_return_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    try {
      const result = insertStmt.run(
        row.order_no,
        row.engineer_id,
        row.engineer_name,
        row.engineer_phone,
        row.part_code,
        row.part_name,
        row.batch_no,
        parseInt(row.quantity) || 1,
        row.receive_date,
        row.old_part_expected_return_date || null
      );

      logAction('create', 'receive_order', {
        entityId: result.lastInsertRowid,
        entityNo: row.order_no,
        afterData: row,
      });

      return {
        id: result.lastInsertRowid,
        orderNo: row.order_no,
        success: true,
      };
    } catch (error) {
      return {
        orderNo: row.order_no,
        success: false,
        error: error.message,
      };
    }
  }

  retryFailedImports(failedItems) {
    const results = {
      success: [],
      failed: [],
    };

    for (const item of failedItems) {
      if (!item.rowData) continue;
      try {
        const result = this.processReceiveOrderRow(item.rowData);
        if (result.success) {
          results.success.push(result);
        } else {
          results.failed.push({ ...item, retryError: result.error });
        }
      } catch (error) {
        results.failed.push({ ...item, retryError: error.message });
      }
    }

    return results;
  }
}

module.exports = new ImportService();
