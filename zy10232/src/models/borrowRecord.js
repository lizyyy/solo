class BorrowRecord {
  constructor(data = {}) {
    this.id = data.id || this.generateId();
    this.garmentId = data.garmentId || '';
    this.garmentInfo = data.garmentInfo || {};
    this.department = data.department || '';
    this.borrower = data.borrower || '';
    this.borrowDate = data.borrowDate || '';
    this.dueDate = data.dueDate || '';
    this.returnDate = data.returnDate || null;
    this.returnStatus = data.returnStatus || 'pending';
    this.inspectionStatus = data.inspectionStatus || 'not_inspected';
    this.damageDescription = data.damageDescription || '';
    this.compensationAmount = data.compensationAmount || 0;
    this.compensationStatus = data.compensationStatus || 'not_needed';
    this.importBatchId = data.importBatchId || null;
    this.source = data.source || 'manual';
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    this.confirmedAt = data.confirmedAt || null;
    this.notes = data.notes || '';
  }

  generateId() {
    return `BR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getUniqueImportKey() {
    const garmentKey = `${this.garmentInfo.styleNo || ''}-${this.garmentInfo.size || ''}-${this.garmentInfo.color || ''}`;
    return `${garmentKey}-${this.department}-${this.borrowDate}-${this.dueDate}`;
  }

  isOverdue(currentDate = new Date().toISOString().split('T')[0]) {
    if (this.returnStatus === 'returned' || !this.dueDate) return false;
    return this.dueDate < currentDate;
  }

  canReBorrow() {
    if (this.returnStatus === 'pending') return false;
    if (this.inspectionStatus === 'not_inspected') return false;
    return true;
  }

  toJSON() {
    return {
      id: this.id,
      garmentId: this.garmentId,
      garmentInfo: this.garmentInfo,
      department: this.department,
      borrower: this.borrower,
      borrowDate: this.borrowDate,
      dueDate: this.dueDate,
      returnDate: this.returnDate,
      returnStatus: this.returnStatus,
      inspectionStatus: this.inspectionStatus,
      damageDescription: this.damageDescription,
      compensationAmount: this.compensationAmount,
      compensationStatus: this.compensationStatus,
      importBatchId: this.importBatchId,
      source: this.source,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      confirmedAt: this.confirmedAt,
      notes: this.notes
    };
  }
}

module.exports = BorrowRecord;
