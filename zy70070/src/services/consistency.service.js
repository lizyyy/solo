const { db, getNextId, now } = require('../db/database');
const { generateNo } = require('../utils/id-generator');
const HistoryService = require('./history.service');

class ConsistencyService {
  static checkStudentBedConsistency() {
    const issues = [];
    
    const studentsWithoutBed = db.data.students.filter(
      s => s.status === 'active' && s.current_bed_id === null
    );
    
    studentsWithoutBed.forEach(s => {
      issues.push({
        type: 'STUDENT_NO_BED',
        severity: 'warning',
        student_id: s.id,
        student_no: s.student_no,
        student_name: s.name,
        message: `学生 ${s.name}(${s.student_no}) 未分配床位`
      });
    });
    
    const occupiedBeds = db.data.beds.filter(b => b.status === 'occupied');
    occupiedBeds.forEach(bed => {
      if (!bed.student_id) {
        issues.push({
          type: 'BED_OCCUPIED_NO_STUDENT',
          severity: 'error',
          bed_id: bed.id,
          bed_code: bed.bed_code,
          message: `床位 ${bed.bed_code} 状态为occupied但未关联学生`
        });
      } else {
        const student = db.data.students.find(s => s.id === bed.student_id);
        if (!student || student.current_bed_id !== bed.id) {
          issues.push({
            type: 'BED_STUDENT_MISMATCH',
            severity: 'error',
            bed_id: bed.id,
            bed_code: bed.bed_code,
            student_id: bed.student_id,
            student_no: student?.student_no,
            message: `床位 ${bed.bed_code} 关联学生，但学生当前床位为 ${student?.current_bed_id}`
          });
        }
      }
    });
    
    const availableWithStudent = db.data.beds.filter(b => b.status === 'available' && b.student_id !== null);
    availableWithStudent.forEach(bed => {
      const student = db.data.students.find(s => s.id === bed.student_id);
      issues.push({
        type: 'BED_AVAILABLE_HAS_STUDENT',
        severity: 'error',
        bed_id: bed.id,
        bed_code: bed.bed_code,
        student_id: bed.student_id,
        student_no: student?.student_no,
        message: `床位 ${bed.bed_code} 状态为available但关联了学生`
      });
    });
    
    return issues;
  }
  
  static checkTransferConsistency() {
    const issues = [];
    
    const completedTransfers = db.data.transfer_applications.filter(ta => ta.status === 'completed');
    completedTransfers.forEach(transfer => {
      const student = db.data.students.find(s => s.id === transfer.student_id);
      const originalBed = db.data.beds.find(b => b.id === transfer.original_bed_id);
      const targetBed = db.data.beds.find(b => b.id === transfer.target_bed_id);
      
      if (student && student.current_bed_id !== transfer.target_bed_id) {
        issues.push({
          type: 'TRANSFER_STUDENT_BED_MISMATCH',
          severity: 'error',
          application_id: transfer.id,
          application_no: transfer.application_no,
          student_id: transfer.student_id,
          message: `换寝申请 ${transfer.application_no} 已完成，但学生当前床位不是目标床位`
        });
      }
      
      if (targetBed && (targetBed.status !== 'occupied' || targetBed.student_id !== transfer.student_id)) {
        issues.push({
          type: 'TRANSFER_TARGET_BED_INVALID',
          severity: 'error',
          application_id: transfer.id,
          application_no: transfer.application_no,
          target_bed_id: transfer.target_bed_id,
          message: `换寝申请 ${transfer.application_no} 的目标床位状态异常`
        });
      }
      
      if (originalBed && originalBed.status !== 'available') {
        issues.push({
          type: 'TRANSFER_ORIGINAL_BED_OCCUPIED',
          severity: 'warning',
          application_id: transfer.id,
          application_no: transfer.application_no,
          original_bed_id: transfer.original_bed_id,
          message: `换寝申请 ${transfer.application_no} 的原床位未释放`
        });
      }
    });
    
    return issues;
  }
  
  static checkFeeConsistency() {
    const issues = [];
    const currentPeriod = this.getCurrentPeriod();
    
    const studentsWithBed = db.data.students
      .filter(s => s.status === 'active' && s.current_bed_id !== null);
    
    studentsWithBed.forEach(student => {
      const hasFee = db.data.fees.some(
        f => f.student_id === student.id && f.bed_id === student.current_bed_id && f.bill_period === currentPeriod
      );
      
      if (!hasFee) {
        const bed = db.data.beds.find(b => b.id === student.current_bed_id);
        issues.push({
          type: 'FEE_MISSING',
          severity: 'warning',
          student_id: student.id,
          student_no: student.student_no,
          bed_id: student.current_bed_id,
          bed_code: bed?.bed_code,
          bill_period: currentPeriod,
          message: `学生 ${student.name} 当前床位在 ${currentPeriod} 账期缺少费用记录`
        });
      }
    });
    
    return issues;
  }
  
  static checkAccessConsistency() {
    const issues = [];
    
    const studentsWithBed = db.data.students
      .filter(s => s.status === 'active' && s.current_bed_id !== null);
    
    studentsWithBed.forEach(student => {
      const card = db.data.access_cards.find(
        c => c.student_id === student.id && c.status === 'active'
      );
      
      if (!card) {
        issues.push({
          type: 'ACCESS_CARD_MISSING',
          severity: 'warning',
          student_id: student.id,
          student_no: student.student_no,
          message: `学生 ${student.name} 没有有效门禁卡`
        });
        return;
      }
      
      const authorizedBeds = JSON.parse(card.authorized_bed_ids || '[]');
      
      if (!authorizedBeds.includes(student.current_bed_id)) {
        issues.push({
          type: 'ACCESS_PERMISSION_MISMATCH',
          severity: 'error',
          student_id: student.id,
          student_no: student.student_no,
          current_bed_id: student.current_bed_id,
          authorized_beds: authorizedBeds,
          message: `学生 ${student.name} 门禁权限与当前床位不符`
        });
      }
    });
    
    return issues;
  }
  
  static getCurrentPeriod() {
    const nowDate = new Date();
    const month = nowDate.getMonth() + 1;
    const year = nowDate.getFullYear();
    if (month >= 2 && month <= 7) {
      return `${year}-春季`;
    } else {
      return `${year}-秋季`;
    }
  }
  
  static runFullCheck(operator = 'system') {
    const allIssues = [];
    
    allIssues.push(...this.checkStudentBedConsistency());
    allIssues.push(...this.checkTransferConsistency());
    allIssues.push(...this.checkFeeConsistency());
    allIssues.push(...this.checkAccessConsistency());
    
    const errors = allIssues.filter(i => i.severity === 'error');
    const warnings = allIssues.filter(i => i.severity === 'warning');
    
    const checkId = generateNo('CHECK');
    
    db.data.consistency_checks.push({
      id: getNextId('consistency_checks'),
      check_id: checkId,
      check_type: 'full_check',
      check_result: JSON.stringify({ errors: errors.length, warnings: warnings.length }),
      issues_found: JSON.stringify(allIssues),
      fixed_issues: null,
      checked_at: now(),
      operator: operator
    });
    
    HistoryService.logOperation(
      'CONSISTENCY_CHECK',
      'system',
      0,
      operator,
      `一致性检查完成: 发现${errors.length}个错误, ${warnings.length}个警告`
    );
    
    return {
      check_id: checkId,
      checked_at: now(),
      total_issues: allIssues.length,
      errors: errors.length,
      warnings: warnings.length,
      issues: allIssues,
      status: allIssues.length === 0 ? 'passed' : 'has_issues'
    };
  }
  
  static fixBedStudentMismatch(issue, operator = 'system') {
    if (issue.type === 'BED_STUDENT_MISMATCH') {
      const bed = db.data.beds.find(b => b.id === issue.bed_id);
      const student = db.data.students.find(s => s.id === bed.student_id);
      
      if (student.current_bed_id) {
        const oldBed = db.data.beds.find(b => b.id === student.current_bed_id);
        if (oldBed) {
          oldBed.status = 'available';
          oldBed.student_id = null;
          oldBed.assigned_at = null;
        }
      }
      
      student.current_bed_id = issue.bed_id;
      student.updated_at = now();
      
      bed.status = 'occupied';
      bed.assigned_at = now();
      bed.updated_at = now();
      
      HistoryService.logOperation(
        'CONSISTENCY_FIX',
        issue.type,
        issue.bed_id || 0,
        operator,
        `修复一致性问题: ${issue.message}`
      );
      
      return { fixed: true, message: '已同步床位和学生关系' };
    }
    
    if (issue.type === 'BED_OCCUPIED_NO_STUDENT') {
      const bed = db.data.beds.find(b => b.id === issue.bed_id);
      bed.status = 'available';
      bed.student_id = null;
      bed.assigned_at = null;
      bed.updated_at = now();
      
      HistoryService.logOperation(
        'CONSISTENCY_FIX',
        issue.type,
        issue.bed_id,
        operator,
        `修复一致性问题: ${issue.message}`
      );
      
      return { fixed: true, message: '已释放无人占用的床位' };
    }
    
    if (issue.type === 'BED_AVAILABLE_HAS_STUDENT') {
      const bed = db.data.beds.find(b => b.id === issue.bed_id);
      bed.status = 'occupied';
      bed.assigned_at = now();
      bed.updated_at = now();
      
      HistoryService.logOperation(
        'CONSISTENCY_FIX',
        issue.type,
        issue.bed_id,
        operator,
        `修复一致性问题: ${issue.message}`
      );
      
      return { fixed: true, message: '已更新床位状态' };
    }
    
    return { fixed: false, message: '不支持自动修复此问题' };
  }
  
  static autoFix(operator = 'system') {
    const issues = this.runFullCheck(operator);
    const fixedIssues = [];
    const unfixableIssues = [];
    
    for (const issue of issues.issues) {
      if (['BED_STUDENT_MISMATCH', 'BED_OCCUPIED_NO_STUDENT', 'BED_AVAILABLE_HAS_STUDENT'].includes(issue.type)) {
        const result = this.fixBedStudentMismatch(issue, operator);
        if (result.fixed) {
          fixedIssues.push({ ...issue, fix_message: result.message });
        } else {
          unfixableIssues.push(issue);
        }
      } else {
        unfixableIssues.push(issue);
      }
    }
    
    return {
      total_checked: issues.total_issues,
      fixed: fixedIssues.length,
      remaining: unfixableIssues.length,
      fixed_issues: fixedIssues,
      unfixable_issues: unfixableIssues
    };
  }
}

module.exports = ConsistencyService;