const db = require('../database');
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');
const { createAuditLog } = require('../utils/common');
const config = require('../config');
const borrowService = require('./borrowService');
const { bookService, studentService, classService } = require('./baseServices');

const fineService = {
  calculateOverdueFine(borrowRecord, returnDate = null) {
    const dueDate = dayjs(borrowRecord.due_date);
    const actualReturnDate = returnDate ? dayjs(returnDate) : dayjs();
    
    const isOverdue = actualReturnDate.isAfter(dueDate);
    const overdueDays = isOverdue 
      ? Math.max(0, actualReturnDate.diff(dueDate, 'day') - config.rules.overdueGraceDays)
      : 0;

    const dailyRate = config.rules.overdueRatePerDay;
    const maxFine = config.rules.maxOverdueFine;
    const calculatedAmount = Math.min(overdueDays * dailyRate, maxFine);

    return {
      isOverdue,
      overdueDays,
      dailyRate,
      maxFine,
      calculatedAmount,
      graceDays: config.rules.overdueGraceDays
    };
  },

  async getById(fineId) {
    return await db.get('SELECT * FROM overdue_fines WHERE id = ?', [fineId]);
  },

  async getByBorrowId(borrowId) {
    return await db.get('SELECT * FROM overdue_fines WHERE borrow_id = ?', [borrowId]);
  },

  async list(filters = {}) {
    let sql = 'SELECT * FROM overdue_fines WHERE 1=1';
    const params = [];

    if (filters.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters.student_id) {
      sql += ' AND student_id = ?';
      params.push(filters.student_id);
    }
    if (filters.min_amount) {
      sql += ' AND (calculated_amount - waived_amount) >= ?';
      params.push(filters.min_amount);
    }

    sql += ' ORDER BY created_at DESC';
    return await db.all(sql, params);
  },

  async getStudentFines(studentId) {
    return await db.all(`
      SELECT f.*, br.borrow_date, br.due_date, br.return_date
      FROM overdue_fines f
      LEFT JOIN borrow_records br ON f.borrow_id = br.id
      WHERE f.student_id = ?
      ORDER BY f.created_at DESC
    `, [studentId]);
  },

  async payFine(fineId, amount, operatorId) {
    const requestId = uuidv4();
    const fine = await db.get('SELECT * FROM overdue_fines WHERE id = ?', [fineId]);
    
    if (!fine) {
      return { success: false, requestId, error: '罚款记录不存在', code: 'FINE_NOT_FOUND' };
    }

    if (fine.status === 'paid') {
      return { 
        success: true, 
        requestId, 
        isIdempotent: true, 
        message: '罚款已全额支付', 
        fine 
      };
    }

    if (fine.status === 'waived') {
      return { 
        success: false, 
        requestId, 
        error: '罚款已减免', 
        code: 'FINE_WAIVED' 
      };
    }

    const remainingAmount = fine.calculated_amount - fine.waived_amount - fine.paid_amount;
    const actualPayment = Math.min(amount, remainingAmount);

    if (actualPayment <= 0) {
      return { 
        success: false, 
        requestId, 
        error: '无可支付金额', 
        code: 'NO_AMOUNT_DUE' 
      };
    }

    const oldFine = { ...fine };
    const newPaidAmount = fine.paid_amount + actualPayment;
    const isFullyPaid = newPaidAmount >= (fine.calculated_amount - fine.waived_amount);
    const newStatus = isFullyPaid ? 'paid' : 'partial';
    const now = dayjs().toISOString();

    await db.run(`
      UPDATE overdue_fines 
      SET paid_amount = ?, status = ?, updated_at = ? 
      WHERE id = ?
    `, [newPaidAmount, newStatus, now, fineId]);

    const updatedFine = await db.get('SELECT * FROM overdue_fines WHERE id = ?', [fineId]);
    await createAuditLog('PAY', 'fine', fineId, oldFine, updatedFine, operatorId, requestId);

    return {
      success: true,
      requestId,
      isIdempotent: false,
      payment: {
        amount: actualPayment,
        isFullyPaid,
        remaining: (fine.calculated_amount - fine.waived_amount) - newPaidAmount
      },
      fine: updatedFine
    };
  },

  async waiveFine(fineId, amount, reason, operatorId) {
    const requestId = uuidv4();
    const fine = await db.get('SELECT * FROM overdue_fines WHERE id = ?', [fineId]);
    
    if (!fine) {
      return { success: false, requestId, error: '罚款记录不存在', code: 'FINE_NOT_FOUND' };
    }

    if (fine.status === 'waived') {
      return { success: true, requestId, isIdempotent: true, message: '罚款已全额减免', fine };
    }

    if (!reason || reason.trim().length === 0) {
      return { success: false, requestId, error: '减免原因不能为空', code: 'REASON_REQUIRED' };
    }

    const maxWaivable = fine.calculated_amount - fine.waived_amount - fine.paid_amount;
    const actualWaive = Math.min(amount, maxWaivable);

    if (actualWaive <= 0) {
      return { success: false, requestId, error: '无可减免金额', code: 'NO_AMOUNT_WAIVABLE' };
    }

    const oldFine = { ...fine };
    const newWaivedAmount = fine.waived_amount + actualWaive;
    const isFullyWaived = newWaivedAmount >= (fine.calculated_amount - fine.paid_amount);
    const newStatus = isFullyWaived ? 'waived' : (fine.status === 'partial' ? 'partial' : 'pending');
    const now = dayjs().toISOString();

    await db.run(`
      UPDATE overdue_fines 
      SET waived_amount = ?, status = ?, updated_at = ? 
      WHERE id = ?
    `, [newWaivedAmount, newStatus, now, fineId]);

    const waiverId = uuidv4();
    await db.run(`
      INSERT INTO waivers 
      (id, fine_id, lost_book_id, waiver_type, original_amount, waived_amount, reason, 
       operator_id, operator_name, created_at)
      VALUES (?, ?, NULL, 'overdue_fine', ?, ?, ?, ?, ?, ?)
    `, [
      waiverId, fineId, fine.calculated_amount, actualWaive, reason,
      operatorId, config.operators.find(o => o.id === operatorId)?.name || operatorId, now
    ]);

    const updatedFine = await db.get('SELECT * FROM overdue_fines WHERE id = ?', [fineId]);
    await createAuditLog('WAIVE', 'fine', fineId, oldFine, updatedFine, operatorId, requestId);

    return {
      success: true,
      requestId,
      isIdempotent: false,
      waiver: {
        id: waiverId,
        amount: actualWaive,
        reason,
        isFullyWaived
      },
      fine: updatedFine
    };
  },

  async refreshOverdueFines(operatorId) {
    const overdueBorrows = await db.all(`
      SELECT br.* 
      FROM borrow_records br
      WHERE br.status = 'overdue'
    `);

    const results = [];
    for (const borrow of overdueBorrows) {
      const existingFine = await this.getByBorrowId(borrow.id);
      const calculation = this.calculateOverdueFine(borrow);

      if (existingFine) {
        if (existingFine.overdue_days !== calculation.overdueDays || 
            existingFine.calculated_amount !== calculation.calculatedAmount) {
          const oldFine = { ...existingFine };
          await db.run(`
            UPDATE overdue_fines 
            SET overdue_days = ?, calculated_amount = ?, last_calculated_at = ?, updated_at = ?
            WHERE id = ?
          `, [calculation.overdueDays, calculation.calculatedAmount, 
               dayjs().toISOString(), dayjs().toISOString(), existingFine.id]);

          const updatedFine = await this.getByBorrowId(borrow.id);
          await createAuditLog('REFRESH', 'fine', existingFine.id, oldFine, updatedFine, operatorId);
          results.push({ action: 'updated', fine: updatedFine });
        } else {
          results.push({ action: 'unchanged', fine: existingFine });
        }
      } else {
        const fineId = uuidv4();
        const now = dayjs().toISOString();
        await db.run(`
          INSERT INTO overdue_fines 
          (id, borrow_id, student_id, student_name, book_title, due_date, 
           overdue_days, daily_rate, calculated_amount, waived_amount, paid_amount, 
           status, max_amount, last_calculated_at, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 'pending', ?, ?, ?, ?)
        `, [
          fineId, borrow.id, borrow.student_id, borrow.borrower_name, borrow.book_title,
          borrow.due_date, calculation.overdueDays, calculation.dailyRate,
          calculation.calculatedAmount, calculation.maxFine, now, now, now
        ]);

        const newFine = await this.getByBorrowId(borrow.id);
        await createAuditLog('CREATE', 'fine', fineId, null, newFine, operatorId);
        results.push({ action: 'created', fine: newFine });
      }
    }

    return {
      totalChecked: overdueBorrows.length,
      created: results.filter(r => r.action === 'created').length,
      updated: results.filter(r => r.action === 'updated').length,
      unchanged: results.filter(r => r.action === 'unchanged').length,
      results
    };
  }
};

const lostBookService = {
  async reportLost(borrowId, operatorId, reportedDate = null) {
    const requestId = uuidv4();
    const borrow = await db.get('SELECT * FROM borrow_records WHERE id = ?', [borrowId]);

    if (!borrow) {
      return { success: false, requestId, error: '借阅记录不存在', code: 'BORROW_NOT_FOUND' };
    }

    if (borrow.status === 'returned') {
      return { success: false, requestId, error: '图书已归还', code: 'ALREADY_RETURNED' };
    }

    if (borrow.status === 'lost') {
      const existingLost = await db.get('SELECT * FROM lost_books WHERE borrow_id = ?', [borrowId]);
      return { 
        success: true, 
        requestId, 
        isIdempotent: true, 
        message: '图书已报失', 
        lostBook: existingLost 
      };
    }

    const book = await bookService.getById(borrow.book_id);
    if (!book) {
      return { success: false, requestId, error: '图书信息不存在', code: 'BOOK_NOT_FOUND' };
    }

    const compensationRatio = config.rules.lostBookRatio;
    const compensationAmount = book.price * compensationRatio;
    const actualReportedDate = reportedDate ? dayjs(reportedDate) : dayjs();
    const now = dayjs().toISOString();
    const lostBookId = uuidv4();

    const oldBorrow = { ...borrow };
    await db.run(`
      UPDATE borrow_records 
      SET status = 'lost', updated_at = ? 
      WHERE id = ?
    `, [now, borrowId]);

    await bookService.updateStatus(borrow.book_id, 'lost', operatorId);

    await db.run(`
      INSERT INTO lost_books 
      (id, borrow_id, book_id, book_title, book_price, student_id, student_name, 
       class_id, reported_date, compensation_ratio, compensation_amount, paid_amount, 
       status, operator_id, operator_name, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'reported', ?, ?, ?, ?)
    `, [
      lostBookId, borrowId, book.id, book.title, book.price,
      borrow.student_id, borrow.borrower_name, borrow.class_id,
      actualReportedDate.toISOString(), compensationRatio, compensationAmount,
      operatorId, config.operators.find(o => o.id === operatorId)?.name || operatorId,
      now, now
    ]);

    const lostBook = await db.get('SELECT * FROM lost_books WHERE id = ?', [lostBookId]);
    const updatedBorrow = await db.get('SELECT * FROM borrow_records WHERE id = ?', [borrowId]);
    
    await createAuditLog('LOST_REPORT', 'borrow', borrowId, oldBorrow, updatedBorrow, operatorId, requestId);
    await createAuditLog('CREATE', 'lost_book', lostBookId, null, lostBook, operatorId, requestId);

    return {
      success: true,
      requestId,
      isIdempotent: false,
      lostBook
    };
  },

  async reportFound(lostBookId, operatorId, foundDate = null) {
    const requestId = uuidv4();
    const lostBook = await db.get('SELECT * FROM lost_books WHERE id = ?', [lostBookId]);

    if (!lostBook) {
      return { success: false, requestId, error: '丢书记录不存在', code: 'LOST_NOT_FOUND' };
    }

    if (lostBook.status === 'found') {
      return { 
        success: true, 
        requestId, 
        isIdempotent: true, 
        message: '图书已找回', 
        lostBook 
      };
    }

    if (lostBook.status === 'compensated') {
      return { success: false, requestId, error: '已赔偿，不可直接找回', code: 'ALREADY_COMPENSATED' };
    }

    const oldLostBook = { ...lostBook };
    const actualFoundDate = foundDate ? dayjs(foundDate) : dayjs();
    const now = dayjs().toISOString();

    let refundAmount = 0;
    if (lostBook.paid_amount > 0) {
      refundAmount = lostBook.paid_amount;
    }

    await db.run(`
      UPDATE lost_books 
      SET status = 'found', found_date = ?, refund_amount = ?, updated_at = ? 
      WHERE id = ?
    `, [actualFoundDate.toISOString(), refundAmount, now, lostBookId]);

    const borrow = await db.get('SELECT * FROM borrow_records WHERE id = ?', [lostBook.borrow_id]);
    if (borrow) {
      const oldBorrow = { ...borrow };
      await db.run(`
        UPDATE borrow_records 
        SET status = 'returned', return_date = ?, updated_at = ? 
        WHERE id = ?
      `, [actualFoundDate.toISOString(), now, lostBook.borrow_id]);

      await bookService.updateStatus(lostBook.book_id, 'available', operatorId);
      
      const updatedBorrow = await db.get('SELECT * FROM borrow_records WHERE id = ?', [lostBook.borrow_id]);
      await createAuditLog('LOST_FOUND', 'borrow', lostBook.borrow_id, oldBorrow, updatedBorrow, operatorId, requestId);
    }

    const updatedLostBook = await db.get('SELECT * FROM lost_books WHERE id = ?', [lostBookId]);
    await createAuditLog('FOUND', 'lost_book', lostBookId, oldLostBook, updatedLostBook, operatorId, requestId);

    return {
      success: true,
      requestId,
      isIdempotent: false,
      lostBook: updatedLostBook,
      refundAmount
    };
  },

  async payCompensation(lostBookId, amount, operatorId) {
    const requestId = uuidv4();
    const lostBook = await db.get('SELECT * FROM lost_books WHERE id = ?', [lostBookId]);

    if (!lostBook) {
      return { success: false, requestId, error: '丢书记录不存在', code: 'LOST_NOT_FOUND' };
    }

    if (lostBook.status === 'compensated') {
      return { 
        success: true, 
        requestId, 
        isIdempotent: true, 
        message: '已全额赔偿', 
        lostBook 
      };
    }

    if (lostBook.status === 'found') {
      return { success: false, requestId, error: '图书已找回，无需赔偿', code: 'BOOK_FOUND' };
    }

    const remainingAmount = lostBook.compensation_amount - lostBook.paid_amount;
    const actualPayment = Math.min(amount, remainingAmount);

    if (actualPayment <= 0) {
      return { success: false, requestId, error: '无可支付金额', code: 'NO_AMOUNT_DUE' };
    }

    const oldLostBook = { ...lostBook };
    const newPaidAmount = lostBook.paid_amount + actualPayment;
    const isFullyPaid = newPaidAmount >= lostBook.compensation_amount;
    const newStatus = isFullyPaid ? 'compensated' : 'partial';
    const now = dayjs().toISOString();

    await db.run(`
      UPDATE lost_books 
      SET paid_amount = ?, status = ?, updated_at = ? 
      WHERE id = ?
    `, [newPaidAmount, newStatus, now, lostBookId]);

    const updatedLostBook = await db.get('SELECT * FROM lost_books WHERE id = ?', [lostBookId]);
    await createAuditLog('PAY_COMPENSATION', 'lost_book', lostBookId, oldLostBook, updatedLostBook, operatorId, requestId);

    return {
      success: true,
      requestId,
      isIdempotent: false,
      payment: {
        amount: actualPayment,
        isFullyPaid,
        remaining: lostBook.compensation_amount - newPaidAmount
      },
      lostBook: updatedLostBook
    };
  },

  async waiveCompensation(lostBookId, amount, reason, operatorId) {
    const requestId = uuidv4();
    const lostBook = await db.get('SELECT * FROM lost_books WHERE id = ?', [lostBookId]);

    if (!lostBook) {
      return { success: false, requestId, error: '丢书记录不存在', code: 'LOST_NOT_FOUND' };
    }

    if (!reason || reason.trim().length === 0) {
      return { success: false, requestId, error: '减免原因不能为空', code: 'REASON_REQUIRED' };
    }

    const oldLostBook = { ...lostBook };
    const now = dayjs().toISOString();
    const waiverId = uuidv4();

    await db.run(`
      INSERT INTO waivers 
      (id, fine_id, lost_book_id, waiver_type, original_amount, waived_amount, reason, 
       operator_id, operator_name, created_at)
      VALUES (?, NULL, ?, 'lost_book', ?, ?, ?, ?, ?, ?)
    `, [
      waiverId, lostBookId, lostBook.compensation_amount, amount, reason,
      operatorId, config.operators.find(o => o.id === operatorId)?.name || operatorId, now
    ]);

    const updatedLostBook = await db.get('SELECT * FROM lost_books WHERE id = ?', [lostBookId]);
    await createAuditLog('WAIVE', 'lost_book', lostBookId, oldLostBook, updatedLostBook, operatorId, requestId);

    return {
      success: true,
      requestId,
      waiver: {
        id: waiverId,
        amount,
        reason
      },
      lostBook: updatedLostBook
    };
  },

  async getById(lostBookId) {
    return await db.get('SELECT * FROM lost_books WHERE id = ?', [lostBookId]);
  },

  async list(filters = {}) {
    let sql = 'SELECT * FROM lost_books WHERE 1=1';
    const params = [];

    if (filters.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters.student_id) {
      sql += ' AND student_id = ?';
      params.push(filters.student_id);
    }
    if (filters.class_id) {
      sql += ' AND class_id = ?';
      params.push(filters.class_id);
    }

    sql += ' ORDER BY created_at DESC';
    return await db.all(sql, params);
  },

  async getStudentLostBooks(studentId) {
    return await this.list({ student_id: studentId });
  }
};

module.exports = {
  fineService,
  lostBookService
};
