const db = require('../database');
const dayjs = require('dayjs');

const reportService = {
  async getStudentStatus(studentId) {
    const student = await db.get('SELECT * FROM students WHERE id = ?', [studentId]);
    if (!student) {
      return { success: false, error: '学生不存在' };
    }

    const borrows = await db.all(`
      SELECT * FROM borrow_records WHERE student_id = ? ORDER BY created_at DESC
    `, [studentId]);

    const fines = await db.all(`
      SELECT * FROM overdue_fines WHERE student_id = ? ORDER BY created_at DESC
    `, [studentId]);

    const lostBooks = await db.all(`
      SELECT * FROM lost_books WHERE student_id = ? ORDER BY created_at DESC
    `, [studentId]);

    const activeBorrows = borrows.filter(b => ['borrowed', 'renewed', 'overdue'].includes(b.status));
    const overdueBorrows = borrows.filter(b => b.status === 'overdue');
    const pendingFines = fines.filter(f => f.status === 'pending' || f.status === 'partial');
    const unpaidLost = lostBooks.filter(l => l.status === 'reported' || l.status === 'partial');

    const totalFines = fines.reduce((sum, f) => sum + f.calculated_amount, 0);
    const paidFines = fines.reduce((sum, f) => sum + f.paid_amount, 0);
    const waivedFines = fines.reduce((sum, f) => sum + f.waived_amount, 0);
    const pendingFineAmount = pendingFines.reduce((sum, f) => 
      sum + (f.calculated_amount - f.waived_amount - f.paid_amount), 0);

    const totalCompensation = lostBooks.reduce((sum, l) => sum + l.compensation_amount, 0);
    const paidCompensation = lostBooks.reduce((sum, l) => sum + l.paid_amount, 0);
    const refundedCompensation = lostBooks.reduce((sum, l) => sum + l.refund_amount, 0);

    return {
      success: true,
      student: {
        id: student.id,
        studentNo: student.student_no,
        name: student.name,
        classId: student.class_id
      },
      summary: {
        totalBorrows: borrows.length,
        activeBorrows: activeBorrows.length,
        overdueCount: overdueBorrows.length,
        pendingFines: pendingFines.length,
        pendingFineAmount,
        pendingLostBooks: unpaidLost.length,
        totalOutstanding: pendingFineAmount + unpaidLost.reduce((sum, l) => 
          sum + (l.compensation_amount - l.paid_amount), 0)
      },
      details: {
        borrows,
        activeBorrows,
        overdueBorrows,
        fines: {
          all: fines,
          pending: pendingFines,
          total: totalFines,
          paid: paidFines,
          waived: waivedFines
        },
        lostBooks: {
          all: lostBooks,
          unpaid: unpaidLost,
          total: totalCompensation,
          paid: paidCompensation,
          refunded: refundedCompensation
        }
      }
    };
  },

  async getClassUnreturned(classId) {
    const clazz = await db.get('SELECT * FROM classes WHERE id = ?', [classId]);
    if (!clazz) {
      return { success: false, error: '班级不存在' };
    }

    const students = await db.all('SELECT * FROM students WHERE class_id = ?', [classId]);
    const studentIds = students.map(s => s.id);

    let borrows = [];
    if (studentIds.length > 0) {
      borrows = await db.all(`
        SELECT br.*, s.name as student_name, s.student_no
        FROM borrow_records br
        JOIN students s ON br.student_id = s.id
        WHERE br.class_id = ? AND br.status IN ('borrowed', 'renewed', 'overdue')
        ORDER BY br.due_date ASC
      `, [classId]);
    }

    const overdueBorrows = borrows.filter(b => b.status === 'overdue');
    const renewals = borrows.filter(b => b.renew_times > 0);

    const byStudent = {};
    for (const student of students) {
      byStudent[student.id] = {
        student: {
          id: student.id,
          studentNo: student.student_no,
          name: student.name
        },
        books: [],
        overdueCount: 0,
        totalBooks: 0
      };
    }

    for (const borrow of borrows) {
      if (byStudent[borrow.student_id]) {
        byStudent[borrow.student_id].books.push({
          id: borrow.id,
          bookId: borrow.book_id,
          bookTitle: borrow.book_title,
          borrowDate: borrow.borrow_date,
          dueDate: borrow.due_date,
          status: borrow.status,
          renewTimes: borrow.renew_times,
          isBatchBorrow: borrow.is_batch_borrow === 1,
          batchId: borrow.batch_id
        });
        byStudent[borrow.student_id].totalBooks++;
        if (borrow.status === 'overdue') {
          byStudent[borrow.student_id].overdueCount++;
        }
      }
    }

    const studentsWithBooks = Object.values(byStudent).filter(s => s.totalBooks > 0);
    const studentsWithOverdue = studentsWithBooks.filter(s => s.overdueCount > 0);

    return {
      success: true,
      class: {
        id: clazz.id,
        name: clazz.name,
        grade: clazz.grade
      },
      summary: {
        totalStudents: students.length,
        studentsWithBooks: studentsWithBooks.length,
        studentsWithOverdue: studentsWithOverdue.length,
        totalUnreturned: borrows.length,
        overdueCount: overdueBorrows.length,
        renewedCount: renewals.length
      },
      byStudent,
      unreturnedBooks: borrows.map(b => ({
        id: b.id,
        studentId: b.student_id,
        studentName: b.student_name,
        studentNo: b.student_no,
        bookId: b.book_id,
        bookTitle: b.book_title,
        borrowDate: b.borrow_date,
        dueDate: b.due_date,
        status: b.status,
        renewTimes: b.renew_times,
        isBatchBorrow: b.is_batch_borrow === 1
      })),
      overdueBooks: overdueBorrows.map(b => ({
        id: b.id,
        studentId: b.student_id,
        studentName: b.student_name,
        studentNo: b.student_no,
        bookId: b.book_id,
        bookTitle: b.book_title,
        dueDate: b.due_date,
        status: b.status,
        renewTimes: b.renew_times
      }))
    };
  },

  async getFinancialStats() {
    const fines = await db.all('SELECT * FROM overdue_fines');
    const lostBooks = await db.all('SELECT * FROM lost_books');
    const waivers = await db.all('SELECT * FROM waivers');

    const totalFines = fines.reduce((sum, f) => sum + f.calculated_amount, 0);
    const paidFines = fines.reduce((sum, f) => sum + f.paid_amount, 0);
    const waivedFines = fines.reduce((sum, f) => sum + f.waived_amount, 0);
    const pendingFines = fines.filter(f => f.status === 'pending' || f.status === 'partial');
    const pendingFineAmount = pendingFines.reduce((sum, f) => 
      sum + (f.calculated_amount - f.waived_amount - f.paid_amount), 0);

    const totalCompensation = lostBooks.reduce((sum, l) => sum + l.compensation_amount, 0);
    const paidCompensation = lostBooks.reduce((sum, l) => sum + l.paid_amount, 0);
    const refundedCompensation = lostBooks.reduce((sum, l) => sum + l.refund_amount, 0);
    const pendingLost = lostBooks.filter(l => l.status === 'reported' || l.status === 'partial');
    const pendingCompensationAmount = pendingLost.reduce((sum, l) => 
      sum + (l.compensation_amount - l.paid_amount), 0);

    const fineWaivers = waivers.filter(w => w.waiver_type === 'overdue_fine');
    const lostWaivers = waivers.filter(w => w.waiver_type === 'lost_book');

    return {
      success: true,
      summary: {
        totalReceivable: totalFines + totalCompensation,
        totalReceived: paidFines + paidCompensation,
        totalWaived: waivedFines + fineWaivers.reduce((sum, w) => sum + w.waived_amount, 0) + 
                      lostWaivers.reduce((sum, w) => sum + w.waived_amount, 0),
        totalRefunded: refundedCompensation,
        totalOutstanding: pendingFineAmount + pendingCompensationAmount
      },
      overdueFines: {
        count: fines.length,
        totalAmount: totalFines,
        paidAmount: paidFines,
        waivedAmount: waivedFines + fineWaivers.reduce((sum, w) => sum + w.waived_amount, 0),
        pendingCount: pendingFines.length,
        pendingAmount: pendingFineAmount,
        byStatus: {
          pending: fines.filter(f => f.status === 'pending').length,
          partial: fines.filter(f => f.status === 'partial').length,
          paid: fines.filter(f => f.status === 'paid').length,
          waived: fines.filter(f => f.status === 'waived').length
        }
      },
      lostBooks: {
        count: lostBooks.length,
        totalAmount: totalCompensation,
        paidAmount: paidCompensation,
        refundedAmount: refundedCompensation,
        pendingCount: pendingLost.length,
        pendingAmount: pendingCompensationAmount,
        byStatus: {
          reported: lostBooks.filter(l => l.status === 'reported').length,
          partial: lostBooks.filter(l => l.status === 'partial').length,
          compensated: lostBooks.filter(l => l.status === 'compensated').length,
          found: lostBooks.filter(l => l.status === 'found').length
        }
      },
      waivers: {
        count: waivers.length,
        totalAmount: waivers.reduce((sum, w) => sum + w.waived_amount, 0),
        fineWaivers: {
          count: fineWaivers.length,
          totalAmount: fineWaivers.reduce((sum, w) => sum + w.waived_amount, 0)
        },
        lostWaivers: {
          count: lostWaivers.length,
          totalAmount: lostWaivers.reduce((sum, w) => sum + w.waived_amount, 0)
        }
      }
    };
  },

  async getAuditHistory(entityType, entityId) {
    const logs = await db.all(`
      SELECT * FROM audit_logs 
      WHERE entity_type = ? AND entity_id = ?
      ORDER BY created_at DESC
    `, [entityType, entityId]);

    return logs.map(log => ({
      ...log,
      old_value: log.old_value ? JSON.parse(log.old_value) : null,
      new_value: log.new_value ? JSON.parse(log.new_value) : null,
      diff: log.old_value && log.new_value ? this.calculateDiff(
        JSON.parse(log.old_value),
        JSON.parse(log.new_value)
      ) : null
    }));
  },

  calculateDiff(oldVal, newVal) {
    const diff = {};
    const keys = new Set([...Object.keys(oldVal || {}), ...Object.keys(newVal || {})]);
    
    for (const key of keys) {
      if (oldVal[key] !== newVal[key]) {
        diff[key] = {
          old: oldVal[key],
          new: newVal[key]
        };
      }
    }
    
    return Object.keys(diff).length > 0 ? diff : null;
  },

  async exportReport(format = 'json') {
    const financial = await this.getFinancialStats();
    const classes = await db.all('SELECT * FROM classes');
    
    const classReports = [];
    for (const c of classes) {
      classReports.push({
        class: c,
        unreturned: await this.getClassUnreturned(c.id)
      });
    }

    if (format === 'json') {
      return {
        generatedAt: dayjs().toISOString(),
        financial,
        classes: classReports
      };
    }

    if (format === 'text') {
      let text = '=== 校园图书馆财务报告 ===\n';
      text += `生成时间: ${dayjs().format('YYYY-MM-DD HH:mm:ss')}\n\n`;
      
      text += '--- 财务汇总 ---\n';
      if (financial.success) {
        text += `  应收总额: ¥${financial.summary.totalReceivable.toFixed(2)}\n`;
        text += `  已收总额: ¥${financial.summary.totalReceived.toFixed(2)}\n`;
        text += `  减免总额: ¥${financial.summary.totalWaived.toFixed(2)}\n`;
        text += `  退款总额: ¥${financial.summary.totalRefunded.toFixed(2)}\n`;
        text += `  待收总额: ¥${financial.summary.totalOutstanding.toFixed(2)}\n\n`;
        
        text += '--- 逾期罚款 ---\n';
        text += `  罚款记录: ${financial.overdueFines.count} 条\n`;
        text += `  罚款总额: ¥${financial.overdueFines.totalAmount.toFixed(2)}\n`;
        text += `  已缴: ¥${financial.overdueFines.paidAmount.toFixed(2)}\n`;
        text += `  待缴: ¥${financial.overdueFines.pendingAmount.toFixed(2)} (${financial.overdueFines.pendingCount} 条)\n\n`;
        
        text += '--- 丢书赔偿 ---\n';
        text += `  丢书记录: ${financial.lostBooks.count} 条\n`;
        text += `  赔偿总额: ¥${financial.lostBooks.totalAmount.toFixed(2)}\n`;
        text += `  已缴: ¥${financial.lostBooks.paidAmount.toFixed(2)}\n`;
        text += `  退款: ¥${financial.lostBooks.refundedAmount.toFixed(2)}\n`;
        text += `  待缴: ¥${financial.lostBooks.pendingAmount.toFixed(2)} (${financial.lostBooks.pendingCount} 条)\n\n`;
      }

      text += '=== 班级未还清单 ===\n\n';
      for (const report of classReports) {
        if (report.unreturned.success && report.unreturned.summary.totalUnreturned > 0) {
          text += `--- 班级: ${report.class.name} ---\n`;
          text += `  未还图书: ${report.unreturned.summary.totalUnreturned} 本\n`;
          text += `  逾期图书: ${report.unreturned.summary.overdueCount} 本\n`;
          text += `  涉及学生: ${report.unreturned.summary.studentsWithBooks} 人\n\n`;
          
          for (const book of report.unreturned.unreturnedBooks) {
            const statusText = book.status === 'overdue' ? '[逾期]' : '';
            text += `  ${statusText}${book.studentName}(${book.studentNo}): ${book.book_title}\n`;
            text += `    到期: ${dayjs(book.dueDate).format('YYYY-MM-DD')}\n`;
          }
          text += '\n';
        }
      }

      return text;
    }

    return { success: false, error: '不支持的导出格式' };
  }
};

module.exports = reportService;
