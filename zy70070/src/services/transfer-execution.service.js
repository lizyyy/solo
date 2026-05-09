const { db, getNextId, now, runTransaction } = require('../db/database');
const { generateNo } = require('../utils/id-generator');
const HistoryService = require('./history.service');

class TransferExecutionService {
  static executeTransfer(applicationId, operator = 'system') {
    let result = null;
    
    runTransaction(() => {
      const app = db.data.transfer_applications.find(a => a.id === applicationId);
      if (!app) throw new Error('申请不存在');
      if (app.status !== 'approved') throw new Error('只有已批准的申请可以执行');
      
      const student = db.data.students.find(s => s.id === app.student_id);
      const originalBed = db.data.beds.find(b => b.id === app.original_bed_id);
      const targetBed = db.data.beds.find(b => b.id === app.target_bed_id);
      
      if (student.current_bed_id !== app.original_bed_id) {
        throw new Error(`数据不一致: 学生当前床位(${student.current_bed_id})与申请原床位(${app.original_bed_id})不符`);
      }
      
      if (originalBed.status !== 'occupied' || originalBed.student_id !== app.student_id) {
        throw new Error('原床位状态异常，无法释放');
      }
      
      if (targetBed.status !== 'available') {
        throw new Error('目标床位已被占用，无法入住');
      }
      
      const originalBedBefore = { ...originalBed };
      const targetBedBefore = { ...targetBed };
      const studentBefore = { ...student };
      
      originalBed.status = 'available';
      originalBed.student_id = null;
      originalBed.assigned_at = null;
      originalBed.updated_at = now();
      
      targetBed.status = 'occupied';
      targetBed.student_id = app.student_id;
      targetBed.assigned_at = now();
      targetBed.updated_at = now();
      
      student.current_bed_id = app.target_bed_id;
      student.updated_at = now();
      
      app.status = 'completed';
      app.completed_at = now();
      app.updated_at = now();
      
      const originalBedAfter = { ...originalBed };
      const targetBedAfter = { ...targetBed };
      const studentAfter = { ...student };
      
      HistoryService.createSnapshot('beds', originalBed.id, 'update', originalBedBefore, originalBedAfter, operator);
      HistoryService.createSnapshot('beds', targetBed.id, 'update', targetBedBefore, targetBedAfter, operator);
      HistoryService.createSnapshot('students', student.id, 'update', studentBefore, studentAfter, operator);
      
      HistoryService.logOperation(
        'TRANSFER_COMPLETE',
        'transfer_applications',
        applicationId,
        operator,
        `换寝完成: 学生${student.name}从床位${originalBed.bed_code}换到${targetBed.bed_code}`
      );
      
      result = {
        application_id: applicationId,
        application_no: app.application_no,
        student_id: app.student_id,
        original_bed_id: app.original_bed_id,
        target_bed_id: app.target_bed_id,
        status: 'completed',
        message: '换寝执行成功'
      };
    });
    
    return result;
  }
  
  static reverseTransfer(applicationId, operator, reason) {
    if (!reason) throw new Error('补录撤回原因不能为空');
    
    let result = null;
    
    runTransaction(() => {
      const app = db.data.transfer_applications.find(a => a.id === applicationId);
      if (!app) throw new Error('申请不存在');
      if (app.status !== 'completed') throw new Error('只有已完成的申请可以撤回');
      
      const student = db.data.students.find(s => s.id === app.student_id);
      const currentBed = db.data.beds.find(b => b.id === app.target_bed_id);
      const originalBed = db.data.beds.find(b => b.id === app.original_bed_id);
      
      if (student.current_bed_id !== app.target_bed_id) {
        throw new Error('学生当前床位与换寝目标床位不符，无法撤回');
      }
      
      if (currentBed.status !== 'occupied' || currentBed.student_id !== app.student_id) {
        throw new Error('当前床位状态异常，无法撤回');
      }
      
      if (originalBed.status !== 'available') {
        throw new Error('原床位已被占用，无法撤回，请先协调');
      }
      
      const studentBefore = { ...student };
      const currentBedBefore = { ...currentBed };
      const originalBedBefore = { ...originalBed };
      
      currentBed.status = 'available';
      currentBed.student_id = null;
      currentBed.assigned_at = null;
      currentBed.updated_at = now();
      
      originalBed.status = 'occupied';
      originalBed.student_id = app.student_id;
      originalBed.assigned_at = now();
      originalBed.updated_at = now();
      
      student.current_bed_id = app.original_bed_id;
      student.updated_at = now();
      
      app.status = 'reversed';
      app.updated_at = now();
      
      const studentAfter = { ...student };
      const currentBedAfter = { ...currentBed };
      const originalBedAfter = { ...originalBed };
      
      HistoryService.createSnapshot('beds', currentBed.id, 'update', currentBedBefore, currentBedAfter, operator);
      HistoryService.createSnapshot('beds', originalBed.id, 'update', originalBedBefore, originalBedAfter, operator);
      HistoryService.createSnapshot('students', student.id, 'update', studentBefore, studentAfter, operator);
      
      HistoryService.logOperation(
        'TRANSFER_REVERSED',
        'transfer_applications',
        applicationId,
        operator,
        `换寝撤回: ${reason}`
      );
      
      result = {
        application_id: applicationId,
        application_no: app.application_no,
        status: 'reversed',
        message: '换寝已撤回'
      };
    });
    
    return result;
  }
  
  static createBackdatedTransfer(studentId, originalBedId, targetBedId, reason, effectiveDate, operator) {
    let result = null;
    
    runTransaction(() => {
      const student = db.data.students.find(s => s.id === studentId);
      if (!student) throw new Error('学生不存在');
      
      if (student.current_bed_id !== originalBedId) {
        throw new Error('原床位与学生当前床位不符');
      }
      
      const originalBed = db.data.beds.find(b => b.id === originalBedId);
      const targetBed = db.data.beds.find(b => b.id === targetBedId);
      
      if (targetBed.status !== 'available') {
        throw new Error('目标床位已被占用');
      }
      
      const applicationNo = generateNo('TRANS');
      const id = getNextId('transfer_applications');
      
      const app = {
        id,
        application_no: applicationNo,
        student_id: studentId,
        original_bed_id: originalBedId,
        target_bed_id: targetBedId,
        reason: `[补录] ${reason}`,
        status: 'completed',
        applicant_note: null,
        operator_note: null,
        reviewed_by: operator,
        submitted_at: effectiveDate,
        reviewed_at: effectiveDate,
        approved_at: effectiveDate,
        completed_at: effectiveDate,
        withdrawn_at: null,
        created_at: now(),
        updated_at: now()
      };
      
      db.data.transfer_applications.push(app);
      
      originalBed.status = 'available';
      originalBed.student_id = null;
      originalBed.assigned_at = null;
      originalBed.updated_at = now();
      
      targetBed.status = 'occupied';
      targetBed.student_id = studentId;
      targetBed.assigned_at = effectiveDate;
      targetBed.updated_at = now();
      
      student.current_bed_id = targetBedId;
      student.updated_at = now();
      
      HistoryService.logOperation(
        'TRANSFER_BACKDATED',
        'transfer_applications',
        id,
        operator,
        `补录换寝: 生效时间 ${effectiveDate}, 原因: ${reason}`
      );
      
      result = {
        id: id,
        application_no: applicationNo,
        status: 'completed',
        is_backdated: true,
        effective_date: effectiveDate,
        message: '补录换寝完成'
      };
    });
    
    return result;
  }
}

module.exports = TransferExecutionService;