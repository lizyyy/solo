const { db, getNextId, now, runTransaction } = require('../db/database');
const { generateNo } = require('../utils/id-generator');

class TransferService {
  static _enrichApplication(app) {
    const student = db.data.students.find(s => s.id === app.student_id);
    const originalBed = db.data.beds.find(b => b.id === app.original_bed_id);
    const targetBed = db.data.beds.find(b => b.id === app.target_bed_id);
    const originalRoom = originalBed ? db.data.dorm_rooms.find(r => r.id === originalBed.room_id) : null;
    const targetRoom = targetBed ? db.data.dorm_rooms.find(r => r.id === targetBed.room_id) : null;
    const originalBuilding = originalRoom ? db.data.buildings.find(b => b.id === originalRoom.building_id) : null;
    const targetBuilding = targetRoom ? db.data.buildings.find(b => b.id === targetRoom.building_id) : null;
    
    return {
      ...app,
      student_name: student?.name,
      student_no: student?.student_no,
      original_bed_code: originalBed?.bed_code,
      original_room_code: originalRoom?.room_code,
      original_building_name: originalBuilding?.building_name,
      target_bed_code: targetBed?.bed_code,
      target_room_code: targetRoom?.room_code,
      target_building_name: targetBuilding?.building_name
    };
  }
  
  static createApplication(studentId, originalBedId, targetBedId, reason, note = null) {
    const student = db.data.students.find(s => s.id === studentId);
    if (!student) throw new Error('学生不存在');
    
    if (student.current_bed_id !== originalBedId) {
      throw new Error('原床位与学生当前床位不符');
    }
    
    const originalBed = db.data.beds.find(b => b.id === originalBedId);
    if (!originalBed || originalBed.status !== 'occupied') {
      throw new Error('原床位无效或未被占用');
    }
    
    const targetBed = db.data.beds.find(b => b.id === targetBedId);
    if (!targetBed || targetBed.status !== 'available') {
      throw new Error('目标床位无效或已被占用');
    }
    
    const existingPending = db.data.transfer_applications.find(
      ta => ta.student_id === studentId && ['pending', 'approved'].includes(ta.status)
    );
    
    if (existingPending) {
      throw new Error('该学生已有待处理或已批准的换寝申请');
    }
    
    const applicationNo = generateNo('TRANS');
    const id = getNextId('transfer_applications');
    
    const app = {
      id,
      application_no: applicationNo,
      student_id: studentId,
      original_bed_id: originalBedId,
      target_bed_id: targetBedId,
      reason: reason,
      status: 'pending',
      applicant_note: note,
      operator_note: null,
      submitted_at: now(),
      reviewed_at: null,
      reviewed_by: null,
      approved_at: null,
      completed_at: null,
      withdrawn_at: null,
      created_at: now(),
      updated_at: now()
    };
    
    db.data.transfer_applications.push(app);
    
    return {
      id: app.id,
      application_no: applicationNo,
      status: 'pending',
      message: '换寝申请已提交，等待辅导员审批'
    };
  }
  
  static getApplications(status = null) {
    let apps = [...db.data.transfer_applications];
    if (status) {
      apps = apps.filter(a => a.status === status);
    }
    return apps
      .map(a => this._enrichApplication(a))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  
  static getApplicationById(id) {
    const app = db.data.transfer_applications.find(a => a.id === id);
    return app ? this._enrichApplication(app) : null;
  }
  
  static getApplicationByNo(applicationNo) {
    const app = db.data.transfer_applications.find(a => a.application_no === applicationNo);
    return app ? this._enrichApplication(app) : null;
  }
  
  static approveApplication(applicationId, approverName, comment = null) {
    const app = db.data.transfer_applications.find(a => a.id === applicationId);
    if (!app) throw new Error('申请不存在');
    if (app.status !== 'pending') throw new Error('只有待审批的申请可以审批');
    
    app.status = 'approved';
    app.reviewed_by = approverName;
    app.operator_note = comment;
    app.reviewed_at = now();
    app.approved_at = now();
    app.updated_at = now();
    
    db.data.approval_records.push({
      id: getNextId('approval_records'),
      application_id: applicationId,
      approver_type: 'counselor',
      approver_name: approverName,
      action: 'approve',
      comment: comment,
      performed_at: now()
    });
    
    return {
      application_id: applicationId,
      status: 'approved',
      message: '辅导员已批准，进入执行阶段'
    };
  }
  
  static rejectApplication(applicationId, approverName, reason) {
    if (!reason) throw new Error('拒绝原因不能为空');
    
    const app = db.data.transfer_applications.find(a => a.id === applicationId);
    if (!app) throw new Error('申请不存在');
    if (app.status !== 'pending') throw new Error('只有待审批的申请可以审批');
    
    app.status = 'rejected';
    app.reviewed_by = approverName;
    app.operator_note = reason;
    app.reviewed_at = now();
    app.updated_at = now();
    
    db.data.approval_records.push({
      id: getNextId('approval_records'),
      application_id: applicationId,
      approver_type: 'counselor',
      approver_name: approverName,
      action: 'reject',
      comment: reason,
      performed_at: now()
    });
    
    return {
      application_id: applicationId,
      status: 'rejected',
      message: '申请已拒绝'
    };
  }
  
  static withdrawApplication(applicationId, operator, reason) {
    if (!reason) throw new Error('撤回原因不能为空');
    
    const app = db.data.transfer_applications.find(a => a.id === applicationId);
    if (!app) throw new Error('申请不存在');
    if (!['pending', 'approved'].includes(app.status)) {
      throw new Error('只有待审批或已批准未执行的申请可以撤回');
    }
    
    app.status = 'withdrawn';
    app.operator_note = reason;
    app.withdrawn_at = now();
    app.updated_at = now();
    
    db.data.approval_records.push({
      id: getNextId('approval_records'),
      application_id: applicationId,
      approver_type: 'system',
      approver_name: operator,
      action: 'withdraw',
      comment: reason,
      performed_at: now()
    });
    
    return {
      application_id: applicationId,
      status: 'withdrawn',
      message: '申请已撤回'
    };
  }
}

module.exports = TransferService;