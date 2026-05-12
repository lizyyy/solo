const db = require('../database');
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');
const { createAuditLog } = require('../utils/common');
const config = require('../config');
const borrowService = require('./borrowService');

const batchReturnService = {
  async create(requestId, operatorId, returnDate = null) {
    const existing = await db.get('SELECT * FROM batch_returns WHERE request_id = ?', [requestId]);
    
    if (existing) {
      const items = await db.all('SELECT * FROM batch_return_items WHERE batch_return_id = ?', [existing.id]);
      return {
        success: true,
        requestId,
        batchReturnId: existing.id,
        isIdempotent: true,
        batchReturn: existing,
        items
      };
    }

    const now = dayjs();
    const batchReturnId = uuidv4();
    const actualReturnDate = returnDate ? dayjs(returnDate) : now;

    await db.run(`
      INSERT INTO batch_returns 
      (id, request_id, operator_id, operator_name, return_date, total_books, 
       success_count, failed_count, status, result_summary, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 0, 0, 0, 'processing', NULL, ?, ?)
    `, [
      batchReturnId, requestId, operatorId,
      config.operators.find(o => o.id === operatorId)?.name || operatorId,
      actualReturnDate.toISOString(), now.toISOString(), now.toISOString()
    ]);

    const batchReturn = await db.get('SELECT * FROM batch_returns WHERE id = ?', [batchReturnId]);
    await createAuditLog('CREATE', 'batch_return', batchReturnId, null, batchReturn, operatorId, requestId);

    return {
      success: true,
      requestId,
      batchReturnId,
      isIdempotent: false,
      batchReturn
    };
  },

  async addItem(batchReturnId, borrowId, operatorId) {
    const batchReturn = await db.get('SELECT * FROM batch_returns WHERE id = ?', [batchReturnId]);
    if (!batchReturn) {
      return { success: false, error: '批量归还记录不存在', code: 'BATCH_NOT_FOUND' };
    }

    if (batchReturn.status === 'completed') {
      return { success: false, error: '批量归还已完成', code: 'ALREADY_COMPLETED' };
    }

    const existingItem = await db.get(`
      SELECT * FROM batch_return_items WHERE batch_return_id = ? AND borrow_id = ?
    `, [batchReturnId, borrowId]);

    if (existingItem) {
      return {
        success: true,
        isIdempotent: true,
        item: existingItem
      };
    }

    const borrow = await db.get('SELECT * FROM borrow_records WHERE id = ?', [borrowId]);
    const itemId = uuidv4();
    let status = 'pending';
    let errorMessage = null;

    if (!borrow) {
      status = 'failed';
      errorMessage = '借阅记录不存在';
    } else if (borrow.status === 'returned' || borrow.status === 'lost') {
      status = 'failed';
      errorMessage = `借阅记录已${borrow.status === 'returned' ? '归还' : '报失'}`;
    }

    await db.run(`
      INSERT INTO batch_return_items 
      (id, batch_return_id, borrow_id, student_name, book_title, book_id, status, error_message, fine_amount, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
    `, [
      itemId, batchReturnId, borrowId,
      borrow?.borrower_name || null,
      borrow?.book_title || null,
      borrow?.book_id || null,
      status, errorMessage, dayjs().toISOString()
    ]);

    const item = await db.get('SELECT * FROM batch_return_items WHERE id = ?', [itemId]);
    
    const total = await db.get('SELECT COUNT(*) as count FROM batch_return_items WHERE batch_return_id = ?', [batchReturnId]);
    
    await db.run('UPDATE batch_returns SET total_books = ?, updated_at = ? WHERE id = ?', 
      [total.count, dayjs().toISOString(), batchReturnId]);

    return {
      success: true,
      isIdempotent: false,
      item
    };
  },

  async process(batchReturnId, operatorId, returnDate = null) {
    const batchReturn = await db.get('SELECT * FROM batch_returns WHERE id = ?', [batchReturnId]);
    
    if (!batchReturn) {
      return { success: false, error: '批量归还记录不存在', code: 'BATCH_NOT_FOUND' };
    }

    if (batchReturn.status === 'completed') {
      const items = await db.all('SELECT * FROM batch_return_items WHERE batch_return_id = ?', [batchReturnId]);
      return {
        success: true,
        isIdempotent: true,
        batchReturn,
        items
      };
    }

    const items = await db.all('SELECT * FROM batch_return_items WHERE batch_return_id = ?', [batchReturnId]);
    let successCount = 0;
    let failCount = 0;
    const results = [];
    const actualReturnDate = returnDate ? dayjs(returnDate) : dayjs();

    for (const item of items) {
      if (item.status === 'success') {
        successCount++;
        continue;
      }

      if (item.status === 'failed') {
        failCount++;
        continue;
      }

      const result = await borrowService.returnBook(item.borrow_id, actualReturnDate.toISOString(), operatorId);
      const oldItem = { ...item };

      if (result.success) {
        const fineAmount = result.fine?.calculated_amount || 0;
        await db.run(`
          UPDATE batch_return_items 
          SET status = 'success', fine_amount = ?, error_message = NULL 
          WHERE id = ?
        `, [fineAmount, item.id]);
        
        successCount++;
        results.push({
          itemId: item.id,
          borrowId: item.borrow_id,
          status: 'success',
          fineAmount,
          isOverdue: result.isOverdue,
          overdueDays: result.overdueDays
        });
      } else {
        await db.run(`
          UPDATE batch_return_items 
          SET status = 'failed', error_message = ? 
          WHERE id = ?
        `, [result.error, item.id]);
        
        failCount++;
        results.push({
          itemId: item.id,
          borrowId: item.borrow_id,
          status: 'failed',
          error: result.error,
          code: result.code
        });
      }

      const newItem = await db.get('SELECT * FROM batch_return_items WHERE id = ?', [item.id]);
      await createAuditLog('PROCESS_ITEM', 'batch_return_item', item.id, oldItem, newItem, operatorId, batchReturn.request_id);
    }

    const summary = {
      total: items.length,
      success: successCount,
      failed: failCount,
      totalFineAmount: results.filter(r => r.status === 'success').reduce((sum, r) => sum + (r.fineAmount || 0), 0)
    };

    const oldBatch = { ...batchReturn };
    await db.run(`
      UPDATE batch_returns 
      SET status = 'completed', success_count = ?, failed_count = ?, 
          result_summary = ?, updated_at = ? 
      WHERE id = ?
    `, [successCount, failCount, JSON.stringify(summary), dayjs().toISOString(), batchReturnId]);

    const updatedBatch = await db.get('SELECT * FROM batch_returns WHERE id = ?', [batchReturnId]);
    const updatedItems = await db.all('SELECT * FROM batch_return_items WHERE batch_return_id = ?', [batchReturnId]);

    await createAuditLog('COMPLETE', 'batch_return', batchReturnId, oldBatch, updatedBatch, operatorId, batchReturn.request_id);

    return {
      success: true,
      isIdempotent: false,
      batchReturn: updatedBatch,
      items: updatedItems,
      summary
    };
  },

  async quickReturn(borrowIds, operatorId, returnDate = null, requestId = null) {
    const actualRequestId = requestId || uuidv4();
    
    const createResult = await this.create(actualRequestId, operatorId, returnDate);
    if (!createResult.success) {
      return createResult;
    }

    for (const borrowId of borrowIds) {
      await this.addItem(createResult.batchReturnId, borrowId, operatorId);
    }

    return await this.process(createResult.batchReturnId, operatorId, returnDate);
  },

  async getById(batchReturnId) {
    const batchReturn = await db.get('SELECT * FROM batch_returns WHERE id = ?', [batchReturnId]);
    if (!batchReturn) return null;

    const items = await db.all('SELECT * FROM batch_return_items WHERE batch_return_id = ?', [batchReturnId]);
    return {
      ...batchReturn,
      items,
      result_summary: batchReturn.result_summary ? JSON.parse(batchReturn.result_summary) : null
    };
  },

  async getByRequestId(requestId) {
    const batchReturn = await db.get('SELECT * FROM batch_returns WHERE request_id = ?', [requestId]);
    if (!batchReturn) return null;
    return await this.getById(batchReturn.id);
  },

  async list(filters = {}) {
    let sql = 'SELECT * FROM batch_returns WHERE 1=1';
    const params = [];

    if (filters.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters.operator_id) {
      sql += ' AND operator_id = ?';
      params.push(filters.operator_id);
    }

    sql += ' ORDER BY created_at DESC';
    const batchReturns = await db.all(sql, params);

    return batchReturns.map(br => ({
      ...br,
      result_summary: br.result_summary ? JSON.parse(br.result_summary) : null
    }));
  }
};

module.exports = batchReturnService;
