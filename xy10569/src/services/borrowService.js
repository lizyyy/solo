const db = require('../database');
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');
const { createAuditLog } = require('../utils/common');
const config = require('../config');
const { bookService, studentService, classService, teacherService } = require('./baseServices');

const borrowService = {
  async borrow(studentId, bookId, options = {}, operatorId) {
    const requestId = options.requestId || uuidv4();
    
    const existingBorrowByRequest = await db.get(`
      SELECT * FROM borrow_records WHERE request_id = ?
    `, [requestId]);
    
    if (existingBorrowByRequest) {
      return {
        success: true,
        requestId,
        isIdempotent: true,
        message: '借阅记录已存在（幂等调用）',
        borrow: existingBorrowByRequest
      };
    }
    
    const existingBorrow = await db.get(`
      SELECT * FROM borrow_records 
      WHERE book_id = ? AND status IN ('borrowed', 'renewed')
    `, [bookId]);
    
    if (existingBorrow) {
      return {
        success: false,
        requestId,
        error: '图书已被借出',
        code: 'BOOK_ALREADY_BORROWED',
        existingBorrow: {
          id: existingBorrow.id,
          studentName: existingBorrow.borrower_name,
          borrowDate: existingBorrow.borrow_date,
          dueDate: existingBorrow.due_date
        }
      };
    }

    const book = await bookService.getById(bookId);
    if (!book) {
      return { success: false, requestId, error: '图书不存在', code: 'BOOK_NOT_FOUND' };
    }

    if (book.status !== 'available') {
      return { success: false, requestId, error: '图书状态不可借', code: 'BOOK_NOT_AVAILABLE' };
    }

    const student = await studentService.getById(studentId);
    if (!student) {
      return { success: false, requestId, error: '学生不存在', code: 'STUDENT_NOT_FOUND' };
    }

    const now = dayjs();
    const loanDays = options.loanDays || config.rules.defaultLoanDays;
    const dueDate = now.add(loanDays, 'day');
    
    const borrowId = uuidv4();
    const borrowRecord = {
      id: borrowId,
      requestId,
      student_id: studentId,
      book_id: bookId,
      class_id: student.class_id,
      borrower_type: 'student',
      borrower_name: student.name,
      book_title: book.title,
      borrow_date: now.toISOString(),
      due_date: dueDate.toISOString(),
      renew_times: 0,
      max_renew_times: config.rules.maxRenewTimes,
      status: 'borrowed',
      is_batch_borrow: options.isBatchBorrow ? 1 : 0,
      batch_id: options.batchId || null,
      operator_id: operatorId,
      operator_name: config.operators.find(o => o.id === operatorId)?.name || operatorId,
      created_at: now.toISOString(),
      updated_at: now.toISOString()
    };

    await db.run(`
      INSERT INTO borrow_records 
      (id, request_id, student_id, book_id, class_id, borrower_type, borrower_name, book_title, 
       borrow_date, due_date, renew_times, max_renew_times, status, is_batch_borrow, batch_id, 
       operator_id, operator_name, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      borrowRecord.id, borrowRecord.requestId, borrowRecord.student_id, borrowRecord.book_id,
      borrowRecord.class_id, borrowRecord.borrower_type, borrowRecord.borrower_name, borrowRecord.book_title,
      borrowRecord.borrow_date, borrowRecord.due_date, borrowRecord.renew_times, borrowRecord.max_renew_times,
      borrowRecord.status, borrowRecord.is_batch_borrow, borrowRecord.batch_id,
      borrowRecord.operator_id, borrowRecord.operator_name, borrowRecord.created_at, borrowRecord.updated_at
    ]);

    await bookService.updateStatus(bookId, 'borrowed', operatorId);
    await createAuditLog('CREATE', 'borrow', borrowId, null, borrowRecord, operatorId, requestId);

    return {
      success: true,
      requestId,
      borrow: borrowRecord
    };
  },

  async batchBorrow(classId, teacherId, bookStudentPairs, operatorId) {
    const requestId = uuidv4();
    const teacher = await teacherService.getById(teacherId);
    if (!teacher) {
      return { success: false, requestId, error: '教师不存在', code: 'TEACHER_NOT_FOUND' };
    }

    const clazz = await classService.getById(classId);
    if (!clazz) {
      return { success: false, requestId, error: '班级不存在', code: 'CLASS_NOT_FOUND' };
    }

    const results = [];
    let successCount = 0;
    let failCount = 0;
    const now = dayjs();

    const batchId = uuidv4();
    const batchRecord = {
      id: batchId,
      class_id: classId,
      teacher_id: teacherId,
      teacher_name: teacher.name,
      book_count: bookStudentPairs.length,
      borrow_date: now.toISOString(),
      status: 'active',
      operator_id: operatorId,
      operator_name: config.operators.find(o => o.id === operatorId)?.name || operatorId,
      created_at: now.toISOString(),
      updated_at: now.toISOString()
    };

    await db.run(`
      INSERT INTO batch_borrows 
      (id, class_id, teacher_id, teacher_name, book_count, borrow_date, status, 
       operator_id, operator_name, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      batchRecord.id, batchRecord.class_id, batchRecord.teacher_id, batchRecord.teacher_name,
      batchRecord.book_count, batchRecord.borrow_date, batchRecord.status,
      batchRecord.operator_id, batchRecord.operator_name, batchRecord.created_at, batchRecord.updated_at
    ]);

    for (let i = 0; i < bookStudentPairs.length; i++) {
      const pair = bookStudentPairs[i];
      const result = await this.borrow(pair.studentId, pair.bookId, {
        isBatchBorrow: true,
        batchId,
        requestId: `${requestId}_${i}`
      }, operatorId);

      results.push(result);

      if (result.success) {
        successCount++;
      } else {
        failCount++;
      }
    }

    if (successCount === 0) {
      await db.run('UPDATE batch_borrows SET status = ? WHERE id = ?', ['failed', batchId]);
    } else if (successCount < bookStudentPairs.length) {
      await db.run('UPDATE batch_borrows SET status = ?, book_count = ? WHERE id = ?', ['partial', successCount, batchId]);
    }

    await createAuditLog('BATCH_BORROW', 'batch_borrow', batchId, null, {
      ...batchRecord,
      results: { total: bookStudentPairs.length, success: successCount, failed: failCount }
    }, operatorId, requestId);

    return {
      success: true,
      requestId,
      batchId,
      teacherId,
      teacherName: teacher.name,
      classId,
      className: clazz.name,
      total: bookStudentPairs.length,
      successCount,
      failCount,
      results
    };
  },

  async returnBook(borrowId, returnDate = null, operatorId) {
    const requestId = uuidv4();
    const borrow = await db.get('SELECT * FROM borrow_records WHERE id = ?', [borrowId]);

    if (!borrow) {
      return { success: false, requestId, error: '借阅记录不存在', code: 'BORROW_NOT_FOUND' };
    }

    if (borrow.status !== 'borrowed' && borrow.status !== 'renewed' && borrow.status !== 'overdue') {
      return { 
        success: false, 
        requestId, 
        error: '借阅记录已处理', 
        code: 'ALREADY_PROCESSED',
        currentStatus: borrow.status
      };
    }

    const oldBorrow = { ...borrow };
    const actualReturnDate = returnDate ? dayjs(returnDate) : dayjs();
    const dueDate = dayjs(borrow.due_date);
    
    const isOverdue = actualReturnDate.isAfter(dueDate);
    const overdueDays = isOverdue 
      ? Math.max(0, actualReturnDate.diff(dueDate, 'day') - config.rules.overdueGraceDays)
      : 0;

    const now = dayjs().toISOString();
    await db.run(`
      UPDATE borrow_records 
      SET status = ?, return_date = ?, updated_at = ? 
      WHERE id = ?
    `, ['returned', actualReturnDate.toISOString(), now, borrowId]);

    const updatedBorrow = await db.get('SELECT * FROM borrow_records WHERE id = ?', [borrowId]);
    await bookService.updateStatus(borrow.book_id, 'available', operatorId);

    let fineRecord = null;
    if (overdueDays > 0) {
      const dailyRate = config.rules.overdueRatePerDay;
      const maxAmount = config.rules.maxOverdueFine;
      const calculatedAmount = Math.min(overdueDays * dailyRate, maxAmount);
      
      const fineId = uuidv4();
      fineRecord = {
        id: fineId,
        borrow_id: borrowId,
        student_id: borrow.student_id,
        student_name: borrow.borrower_name,
        book_title: borrow.book_title,
        due_date: borrow.due_date,
        return_date: actualReturnDate.toISOString(),
        overdue_days: overdueDays,
        daily_rate: dailyRate,
        calculated_amount: calculatedAmount,
        waived_amount: 0,
        paid_amount: 0,
        status: calculatedAmount === 0 ? 'waived' : 'pending',
        max_amount: maxAmount,
        last_calculated_at: now,
        created_at: now,
        updated_at: now
      };

      await db.run(`
        INSERT INTO overdue_fines 
        (id, borrow_id, student_id, student_name, book_title, due_date, return_date, 
         overdue_days, daily_rate, calculated_amount, waived_amount, paid_amount, 
         status, max_amount, last_calculated_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        fineRecord.id, fineRecord.borrow_id, fineRecord.student_id, fineRecord.student_name,
        fineRecord.book_title, fineRecord.due_date, fineRecord.return_date,
        fineRecord.overdue_days, fineRecord.daily_rate, fineRecord.calculated_amount,
        fineRecord.waived_amount, fineRecord.paid_amount, fineRecord.status,
        fineRecord.max_amount, fineRecord.last_calculated_at, fineRecord.created_at, fineRecord.updated_at
      ]);

      await createAuditLog('CREATE', 'fine', fineId, null, fineRecord, operatorId, requestId);
    }

    await createAuditLog('RETURN', 'borrow', borrowId, oldBorrow, updatedBorrow, operatorId, requestId);

    return {
      success: true,
      requestId,
      borrow: updatedBorrow,
      isOverdue,
      overdueDays,
      fine: fineRecord
    };
  },

  async renew(borrowId, operatorId, reason = null) {
    const requestId = uuidv4();
    const borrow = await db.get('SELECT * FROM borrow_records WHERE id = ?', [borrowId]);

    if (!borrow) {
      return { success: false, requestId, error: '借阅记录不存在', code: 'BORROW_NOT_FOUND' };
    }

    if (borrow.status !== 'borrowed' && borrow.status !== 'renewed') {
      return { success: false, requestId, error: '不可续借状态', code: 'INVALID_STATUS' };
    }

    if (borrow.renew_times >= borrow.max_renew_times) {
      return { 
        success: false, 
        requestId, 
        error: `已达到最大续借次数(${borrow.max_renew_times}次)`, 
        code: 'MAX_RENEW_EXCEEDED' 
      };
    }

    const oldBorrow = { ...borrow };
    const now = dayjs();
    const currentDueDate = dayjs(borrow.due_date);
    const newDueDate = currentDueDate.add(config.rules.renewDays, 'day');
    const newRenewTimes = borrow.renew_times + 1;

    await db.run(`
      UPDATE borrow_records 
      SET due_date = ?, renew_times = ?, status = ?, updated_at = ? 
      WHERE id = ?
    `, [newDueDate.toISOString(), newRenewTimes, 'renewed', now.toISOString(), borrowId]);

    const renewId = uuidv4();
    await db.run(`
      INSERT INTO renew_records 
      (id, borrow_id, old_due_date, new_due_date, renew_count, operator_id, operator_name, reason, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      renewId, borrowId, borrow.due_date, newDueDate.toISOString(), newRenewTimes,
      operatorId, config.operators.find(o => o.id === operatorId)?.name || operatorId,
      reason, now.toISOString()
    ]);

    const updatedBorrow = await db.get('SELECT * FROM borrow_records WHERE id = ?', [borrowId]);
    await createAuditLog('RENEW', 'borrow', borrowId, oldBorrow, updatedBorrow, operatorId, requestId);

    return {
      success: true,
      requestId,
      borrow: updatedBorrow,
      renewRecord: {
        id: renewId,
        oldDueDate: borrow.due_date,
        newDueDate: newDueDate.toISOString(),
        renewCount: newRenewTimes
      }
    };
  },

  async getById(id) {
    return await db.get('SELECT * FROM borrow_records WHERE id = ?', [id]);
  },

  async list(filters = {}) {
    let sql = 'SELECT * FROM borrow_records WHERE 1=1';
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
    if (filters.book_id) {
      sql += ' AND book_id = ?';
      params.push(filters.book_id);
    }

    sql += ' ORDER BY created_at DESC';
    return await db.all(sql, params);
  },

  async getStudentBorrows(studentId) {
    return await db.all(`
      SELECT br.*, s.name as student_name, s.student_no, b.title as book_title, b.isbn
      FROM borrow_records br
      JOIN students s ON br.student_id = s.id
      JOIN books b ON br.book_id = b.id
      WHERE br.student_id = ?
      ORDER BY br.created_at DESC
    `, [studentId]);
  },

  async getRenewHistory(borrowId) {
    return await db.all('SELECT * FROM renew_records WHERE borrow_id = ? ORDER BY created_at DESC', [borrowId]);
  },

  calculateOverdueStatus(borrowRecord, checkDate = dayjs()) {
    const dueDate = dayjs(borrowRecord.due_date);
    const isOverdue = checkDate.isAfter(dueDate);
    const overdueDays = isOverdue 
      ? Math.max(0, checkDate.diff(dueDate, 'day') - config.rules.overdueGraceDays)
      : 0;

    return {
      isOverdue,
      overdueDays,
      dailyRate: config.rules.overdueRatePerDay,
      maxFine: config.rules.maxOverdueFine,
      estimatedFine: Math.min(overdueDays * config.rules.overdueRatePerDay, config.rules.maxOverdueFine)
    };
  },

  async refreshOverdueStatus(operatorId) {
    const now = dayjs();
    const borrowed = await db.all(`
      SELECT * FROM borrow_records 
      WHERE status IN ('borrowed', 'renewed')
    `);

    const updated = [];
    for (const borrow of borrowed) {
      const status = this.calculateOverdueStatus(borrow, now);
      if (status.isOverdue && borrow.status !== 'overdue') {
        const oldBorrow = { ...borrow };
        await db.run('UPDATE borrow_records SET status = ?, updated_at = ? WHERE id = ?', 
          ['overdue', now.toISOString(), borrow.id]);
        
        const newBorrow = await db.get('SELECT * FROM borrow_records WHERE id = ?', [borrow.id]);
        await createAuditLog('MARK_OVERDUE', 'borrow', borrow.id, oldBorrow, newBorrow, operatorId);
        updated.push({ ...newBorrow, overdueInfo: status });
      }
    }

    return {
      totalChecked: borrowed.length,
      newlyOverdue: updated.length,
      updated
    };
  }
};

module.exports = borrowService;
