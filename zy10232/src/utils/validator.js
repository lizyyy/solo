const dataStore = require('../store/dataStore');

class Validator {
  static validateGarmentData(data) {
    const errors = [];
    
    if (!data.styleNo || !data.styleNo.trim()) {
      errors.push('款号不能为空');
    }
    if (!data.size || !data.size.trim()) {
      errors.push('尺码不能为空');
    }
    if (!data.color || !data.color.trim()) {
      errors.push('颜色不能为空');
    }
    
    return errors;
  }

  static validateBorrowData(data) {
    const errors = [];
    
    const garmentInfo = data.garmentInfo || data;
    const styleNo = garmentInfo.styleNo || '';
    const size = garmentInfo.size || '';
    const color = garmentInfo.color || '';
    
    if (!styleNo || !styleNo.trim()) {
      errors.push('款号不能为空');
    }
    if (!size || !size.trim()) {
      errors.push('尺码不能为空');
    }
    if (!color || !color.trim()) {
      errors.push('颜色不能为空');
    }
    if (!data.department || !data.department.trim()) {
      errors.push('借用部门不能为空');
    }
    if (!data.borrowDate || !this.isValidDate(data.borrowDate)) {
      errors.push('借用日期格式无效（应为YYYY-MM-DD）');
    }
    if (!data.dueDate || !this.isValidDate(data.dueDate)) {
      errors.push('预计归还日期格式无效（应为YYYY-MM-DD）');
    }
    if (data.borrowDate && data.dueDate && data.borrowDate > data.dueDate) {
      errors.push('预计归还日期不能早于借用日期');
    }
    
    return errors;
  }

  static isValidDate(dateStr) {
    if (!dateStr) return false;
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateStr)) return false;
    
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && 
           date.getMonth() === month - 1 && 
           date.getDate() === day;
  }

  static datesOverlap(start1, end1, start2, end2) {
    return start1 <= end2 && start2 <= end1;
  }

  static checkScheduleOverlap(garmentId, borrowDate, dueDate, excludeRecordId = null) {
    const records = dataStore.getRecordsByGarmentId(garmentId);
    const overlaps = [];
    
    for (const record of records) {
      if (excludeRecordId && record.id === excludeRecordId) continue;
      if (record.returnStatus === 'returned') continue;
      
      if (this.datesOverlap(borrowDate, dueDate, record.borrowDate, record.dueDate)) {
        overlaps.push(record);
      }
    }
    
    return overlaps;
  }

  static checkUninspectedReturn(garmentId) {
    const records = dataStore.getRecordsByGarmentId(garmentId);
    return records.find(r => 
      r.returnStatus !== 'pending' && 
      r.inspectionStatus === 'not_inspected'
    );
  }

  static checkUnpaidDamage(record) {
    if (!record.damageDescription || !record.damageDescription.trim()) {
      return false;
    }
    return record.compensationStatus === 'not_needed' || 
           (record.compensationAmount > 0 && record.compensationStatus === 'pending');
  }

  static checkAllIssues() {
    const issues = {
      scheduleOverlaps: [],
      uninspectedReturns: [],
      unpaidDamages: [],
      overdueRecords: []
    };

    const records = dataStore.getRecords();
    const currentDate = new Date().toISOString().split('T')[0];

    for (const record of records) {
      if (record.returnStatus === 'pending' || record.returnStatus === 'partial') {
        if (record.dueDate && record.dueDate < currentDate) {
          issues.overdueRecords.push(record);
        }
      }

      if (record.returnStatus === 'returned' && record.inspectionStatus === 'not_inspected') {
        issues.uninspectedReturns.push(record);
      }

      if (this.checkUnpaidDamage(record)) {
        issues.unpaidDamages.push(record);
      }
    }

    const garments = dataStore.getGarments();
    for (const garment of garments) {
      const garmentRecords = records.filter(r => 
        r.garmentId === garment.id && r.returnStatus !== 'returned'
      );
      
      for (let i = 0; i < garmentRecords.length; i++) {
        for (let j = i + 1; j < garmentRecords.length; j++) {
          if (this.datesOverlap(
            garmentRecords[i].borrowDate, garmentRecords[i].dueDate,
            garmentRecords[j].borrowDate, garmentRecords[j].dueDate
          )) {
            issues.scheduleOverlaps.push({
              garment,
              records: [garmentRecords[i], garmentRecords[j]]
            });
          }
        }
      }
    }

    return issues;
  }
}

module.exports = Validator;
