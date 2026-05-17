const BORROW_STATUS = {
  BORROWING: 'borrowing',
  OVERDUE: 'overdue',
  REMINDING: 'reminding',
  RETURNED: 'returned'
};

class BorrowRecord {
  constructor(data) {
    this.id = data.id;
    this.assetId = data.assetId;
    this.userId = data.userId;
    this.userName = data.userName;
    this.userDepartmentId = data.userDepartmentId;
    this.userDepartmentName = data.userDepartmentName;
    this.borrowDate = data.borrowDate;
    this.expectedReturnDate = data.expectedReturnDate;
    this.actualReturnDate = data.actualReturnDate || null;
    this.status = data.status || BORROW_STATUS.BORROWING;
    this.purpose = data.purpose;
    this.remark = data.remark || '';
    this.hasDepartmentConflict = data.hasDepartmentConflict || false;
    this.conflictRemark = data.conflictRemark || '';
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  isOverdue() {
    if (this.status === BORROW_STATUS.RETURNED) return false;
    return new Date() > new Date(this.expectedReturnDate);
  }

  getOverdueDays() {
    if (!this.isOverdue()) return 0;
    const now = new Date();
    const expected = new Date(this.expectedReturnDate);
    const diff = now - expected;
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  toJSON() {
    return {
      id: this.id,
      assetId: this.assetId,
      userId: this.userId,
      userName: this.userName,
      userDepartmentId: this.userDepartmentId,
      userDepartmentName: this.userDepartmentName,
      borrowDate: this.borrowDate,
      expectedReturnDate: this.expectedReturnDate,
      actualReturnDate: this.actualReturnDate,
      status: this.status,
      statusText: this.getStatusText(),
      purpose: this.purpose,
      remark: this.remark,
      isOverdue: this.isOverdue(),
      overdueDays: this.getOverdueDays(),
      hasDepartmentConflict: this.hasDepartmentConflict,
      conflictRemark: this.conflictRemark,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  getStatusText() {
    const statusMap = {
      [BORROW_STATUS.BORROWING]: '借用中',
      [BORROW_STATUS.OVERDUE]: '逾期',
      [BORROW_STATUS.REMINDING]: '催还中',
      [BORROW_STATUS.RETURNED]: '已归还'
    };
    return statusMap[this.status] || this.status;
  }
}

module.exports = { BorrowRecord, BORROW_STATUS };
