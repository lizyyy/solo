const db = require('../database/memoryDB');
const { BORROW_STATUS } = require('../models/BorrowRecord');
const { REMINDER_TYPE, REMINDER_STATUS } = require('../models/ReminderRecord');
const { BUSINESS_CODES, BUSINESS_MESSAGES } = require('../utils/response');

class OverdueReminderService {
  constructor() {
    this.reminderCooldown = new Map();
  }

  async checkOverdue() {
    const now = new Date();
    const records = db.getAllBorrowRecords();
    const overdueRecords = [];

    for (const record of records) {
      if (record.status === BORROW_STATUS.RETURNED) continue;

      const expectedDate = new Date(record.expectedReturnDate);
      if (now > expectedDate) {
        if (record.status === BORROW_STATUS.BORROWING) {
          db.updateBorrowRecordStatus(record.id, BORROW_STATUS.OVERDUE);
        }
        overdueRecords.push(record);
      }
    }

    return overdueRecords;
  }

  async createReminder(borrowRecordId, operatorId = null) {
    const borrowRecord = db.getBorrowRecord(borrowRecordId);
    if (!borrowRecord) {
      return {
        success: false,
        code: BUSINESS_CODES.BORROW_NOT_FOUND,
        message: BUSINESS_MESSAGES[BUSINESS_CODES.BORROW_NOT_FOUND]
      };
    }

    if (borrowRecord.status === BORROW_STATUS.RETURNED) {
      return {
        success: false,
        code: BUSINESS_CODES.ALREADY_RETURNED,
        message: BUSINESS_MESSAGES[BUSINESS_CODES.ALREADY_RETURNED]
      };
    }

    const hasConflict = db.checkDepartmentConflict(
      borrowRecord.userId,
      borrowRecord.userDepartmentId
    );

    if (hasConflict) {
      db.markDepartmentConflict(
        borrowRecordId,
        `借用人已从${borrowRecord.userDepartmentName}转岗，当前部门与借用时不一致`
      );
      return {
        success: false,
        code: BUSINESS_CODES.DEPARTMENT_CONFLICT,
        message: BUSINESS_MESSAGES[BUSINESS_CODES.DEPARTMENT_CONFLICT],
        data: {
          borrowRecordId,
          currentUser: db.getUser(borrowRecord.userId)?.toJSON(),
          recordDepartment: borrowRecord.userDepartmentName
        }
      };
    }

    const lastReminder = this.reminderCooldown.get(borrowRecordId);
    if (lastReminder && (Date.now() - lastReminder) < 5 * 60 * 1000) {
      return {
        success: false,
        code: BUSINESS_CODES.REMINDER_TOO_FREQUENT,
        message: BUSINESS_MESSAGES[BUSINESS_CODES.REMINDER_TOO_FREQUENT]
      };
    }

    const user = db.getUser(borrowRecord.userId);
    const asset = db.getAsset(borrowRecord.assetId);
    const overdueDays = borrowRecord.getOverdueDays();

    const content = overdueDays > 0
      ? `【逾期催还】您借用的「${asset?.name || '资产'}」已逾期${overdueDays}天，请尽快归还。预期归还日期：${borrowRecord.expectedReturnDate}`
      : `【归还提醒】您借用的「${asset?.name || '资产'}」即将到期，请按时归还。预期归还日期：${borrowRecord.expectedReturnDate}`;

    const reminder = db.addReminderRecord({
      borrowRecordId,
      userId: borrowRecord.userId,
      userName: borrowRecord.userName,
      type: operatorId ? REMINDER_TYPE.MANUAL : REMINDER_TYPE.AUTO,
      content,
      status: REMINDER_STATUS.SENT,
      sentAt: new Date()
    });

    if (borrowRecord.status === BORROW_STATUS.OVERDUE) {
      db.updateBorrowRecordStatus(borrowRecordId, BORROW_STATUS.REMINDING);
    }

    this.reminderCooldown.set(borrowRecordId, Date.now());

    return {
      success: true,
      code: 200,
      message: overdueDays > 0 ? '逾期催还通知已发送' : '归还提醒已发送',
      data: {
        reminder: reminder.toJSON(),
        borrowRecord: borrowRecord.toJSON(),
        hasConflict: false
      }
    };
  }

  async forceCreateReminder(borrowRecordId, operatorId = null, conflictConfirmed = false) {
    const borrowRecord = db.getBorrowRecord(borrowRecordId);
    if (!borrowRecord) {
      return {
        success: false,
        code: BUSINESS_CODES.BORROW_NOT_FOUND,
        message: BUSINESS_MESSAGES[BUSINESS_CODES.BORROW_NOT_FOUND]
      };
    }

    const hasConflict = db.checkDepartmentConflict(
      borrowRecord.userId,
      borrowRecord.userDepartmentId
    );

    if (hasConflict && !conflictConfirmed) {
      return {
        success: false,
        code: BUSINESS_CODES.DEPARTMENT_CONFLICT,
        message: BUSINESS_MESSAGES[BUSINESS_CODES.DEPARTMENT_CONFLICT],
        data: {
          borrowRecordId,
          currentUser: db.getUser(borrowRecord.userId)?.toJSON(),
          recordDepartment: borrowRecord.userDepartmentName,
          conflictHint: '请确认通知接收人后，使用 forceCreateReminder 并传入 conflictConfirmed=true'
        }
      };
    }

    const user = db.getUser(borrowRecord.userId);
    const asset = db.getAsset(borrowRecord.assetId);
    const overdueDays = borrowRecord.getOverdueDays();

    const content = overdueDays > 0
      ? `【逾期催还】您借用的「${asset?.name || '资产'}」已逾期${overdueDays}天，请尽快归还。预期归还日期：${borrowRecord.expectedReturnDate}`
      : `【归还提醒】您借用的「${asset?.name || '资产'}」即将到期，请按时归还。预期归还日期：${borrowRecord.expectedReturnDate}`;

    const reminder = db.addReminderRecord({
      borrowRecordId,
      userId: borrowRecord.userId,
      userName: borrowRecord.userName,
      type: operatorId ? REMINDER_TYPE.MANUAL : REMINDER_TYPE.AUTO,
      content,
      status: REMINDER_STATUS.SENT,
      sentAt: new Date(),
      remark: conflictConfirmed ? '已确认部门冲突，强制发送' : ''
    });

    if (borrowRecord.status === BORROW_STATUS.OVERDUE) {
      db.updateBorrowRecordStatus(borrowRecordId, BORROW_STATUS.REMINDING);
    }

    if (hasConflict && conflictConfirmed) {
      db.markDepartmentConflict(
        borrowRecordId,
        `借用人已从${borrowRecord.userDepartmentName}转岗，已确认冲突并强制发送催还通知`
      );
    }

    return {
      success: true,
      code: 200,
      message: '催还通知已发送' + (hasConflict ? '（冲突已确认）' : ''),
      data: {
        reminder: reminder.toJSON(),
        borrowRecord: borrowRecord.toJSON(),
        hasConflict,
        conflictConfirmed
      }
    };
  }

  async getBorrowList(filters = {}) {
    await this.checkOverdue();
    const records = db.getAllBorrowRecords(filters);
    return {
      success: true,
      data: records.map(r => r.toJSON()),
      total: records.length
    };
  }

  async getBorrowDetail(id) {
    await this.checkOverdue();
    const record = db.getBorrowRecord(id);
    if (!record) {
      return {
        success: false,
        code: BUSINESS_CODES.BORROW_NOT_FOUND,
        message: BUSINESS_MESSAGES[BUSINESS_CODES.BORROW_NOT_FOUND]
      };
    }

    const reminders = db.getRemindersByBorrowId(id);
    const asset = db.getAsset(record.assetId);
    const user = db.getUser(record.userId);
    const hasConflict = db.checkDepartmentConflict(record.userId, record.userDepartmentId);

    return {
      success: true,
      data: {
        borrowRecord: record.toJSON(),
        asset: asset?.toJSON() || null,
        currentUser: user?.toJSON() || null,
        reminders: reminders.map(r => r.toJSON()),
        departmentConflict: {
          hasConflict,
          currentDepartment: user?.departmentName,
          borrowDepartment: record.userDepartmentName
        }
      }
    };
  }

  async getReminderHistory(borrowRecordId = null) {
    const reminders = borrowRecordId
      ? db.getRemindersByBorrowId(borrowRecordId)
      : db.getAllReminderRecords();

    return {
      success: true,
      data: reminders.map(r => r.toJSON()),
      total: reminders.length
    };
  }

  async processReturn(borrowRecordId) {
    const record = db.getBorrowRecord(borrowRecordId);
    if (!record) {
      return {
        success: false,
        code: BUSINESS_CODES.BORROW_NOT_FOUND,
        message: BUSINESS_MESSAGES[BUSINESS_CODES.BORROW_NOT_FOUND]
      };
    }

    db.updateBorrowRecordStatus(borrowRecordId, BORROW_STATUS.RETURNED, new Date());

    return {
      success: true,
      message: '资产已归还',
      data: db.getBorrowRecord(borrowRecordId).toJSON()
    };
  }

  async getStatistics() {
    await this.checkOverdue();
    const records = db.getAllBorrowRecords();
    const reminders = db.getAllReminderRecords();

    const stats = {
      total: records.length,
      borrowing: records.filter(r => r.status === BORROW_STATUS.BORROWING).length,
      overdue: records.filter(r => r.status === BORROW_STATUS.OVERDUE).length,
      reminding: records.filter(r => r.status === BORROW_STATUS.REMINDING).length,
      returned: records.filter(r => r.status === BORROW_STATUS.RETURNED).length,
      hasConflict: records.filter(r => r.hasDepartmentConflict).length,
      totalReminders: reminders.length,
      todayReminders: reminders.filter(r => {
        const today = new Date().toDateString();
        return new Date(r.createdAt).toDateString() === today;
      }).length
    };

    return { success: true, data: stats };
  }
}

module.exports = new OverdueReminderService();
