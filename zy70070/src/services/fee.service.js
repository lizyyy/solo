const { db, getNextId, now, runTransaction } = require('../db/database');
const { generateNo } = require('../utils/id-generator');
const moment = require('moment');
const config = require('../../config.json');
const HistoryService = require('./history.service');

class FeeService {
  static calculateDailyRate(semesterFee) {
    return semesterFee / 30;
  }
  
  static getCurrentSemester() {
    const nowDate = moment();
    const month = nowDate.month() + 1;
    const year = nowDate.year();
    if (month >= 2 && month <= 7) {
      return `${year}-春季`;
    } else {
      return `${year}-秋季`;
    }
  }
  
  static createFee(studentId, bedId, semesterFee = null, billPeriod = null) {
    const bed = db.data.beds.find(b => b.id === bedId);
    if (!bed) throw new Error('床位不存在');
    
    const room = db.data.dorm_rooms.find(r => r.id === bed.room_id);
    const feeAmount = semesterFee || room.fee_per_semester || config.business.defaultDormFee;
    const period = billPeriod || this.getCurrentSemester();
    
    const existingFee = db.data.fees.find(
      f => f.student_id === studentId && f.bed_id === bedId && f.bill_period === period
    );
    
    if (existingFee) {
      return existingFee;
    }
    
    const feeNo = generateNo('FEE');
    const id = getNextId('fees');
    
    const fee = {
      id,
      fee_no: feeNo,
      student_id: studentId,
      bed_id: bedId,
      fee_type: 'dorm_fee',
      amount: feeAmount,
      bill_period: period,
      status: 'unpaid',
      paid_at: null,
      created_at: now(),
      updated_at: now()
    };
    
    db.data.fees.push(fee);
    
    HistoryService.logOperation(
      'FEE_CREATE',
      'fees',
      id,
      'system',
      `生成住宿费: 学生${studentId}, 床位${bedId}, 金额${feeAmount}, 账期${period}`
    );
    
    return fee;
  }
  
  static recalculateFee(applicationId, operator = 'system') {
    let result = null;
    
    runTransaction(() => {
      const app = db.data.transfer_applications.find(a => a.id === applicationId);
      if (!app) throw new Error('申请不存在');
      
      const originalBed = db.data.beds.find(b => b.id === app.original_bed_id);
      const originalRoom = db.data.dorm_rooms.find(r => r.id === originalBed.room_id);
      
      const targetBed = db.data.beds.find(b => b.id === app.target_bed_id);
      const targetRoom = db.data.dorm_rooms.find(r => r.id === targetBed.room_id);
      
      const period = this.getCurrentSemester();
      
      const originalFee = db.data.fees.find(
        f => f.student_id === app.student_id && f.bed_id === app.original_bed_id && f.bill_period === period
      );
      
      if (!originalFee) {
        result = {
          message: '原床位未生成本账期费用，跳过重算',
          adjustment_amount: 0
        };
        return;
      }
      
      const originalSemesterFee = originalRoom.fee_per_semester || config.business.defaultDormFee;
      const targetSemesterFee = targetRoom.fee_per_semester || config.business.defaultDormFee;
      
      const dailyRate = originalSemesterFee / 30;
      const today = moment();
      const startOfMonth = today.clone().startOf('month');
      const daysLeft = today.diff(startOfMonth, 'days') + 1;
      
      const refundDays = 30 - daysLeft;
      const refundAmount = Math.round(dailyRate * refundDays * 100) / 100;
      
      const originalDailyRate = originalSemesterFee / 30;
      const targetDailyRate = targetSemesterFee / 30;
      const dailyDiff = targetDailyRate - originalDailyRate;
      const adjustmentAmount = Math.round(dailyDiff * daysLeft * 100) / 100;
      
      const totalDiff = Math.round((adjustmentAmount - refundAmount) * 100) / 100;
      
      const targetFee = this.createFee(app.student_id, app.target_bed_id, targetSemesterFee, period);
      
      const adjustmentNo = generateNo('ADJ');
      const adjId = getNextId('fee_adjustments');
      
      db.data.fee_adjustments.push({
        id: adjId,
        adjustment_no: adjustmentNo,
        student_id: app.student_id,
        original_fee_id: originalFee.id,
        new_fee_id: targetFee.id,
        reason: `换寝费用调整: 申请号${app.application_no}`,
        adjustment_amount: totalDiff,
        operator: operator,
        created_at: now()
      });
      
      HistoryService.logOperation(
        'FEE_RECALCULATE',
        'transfer_applications',
        applicationId,
        operator,
        `换寝费用重算: 原床位退款${refundAmount}元, 新床位追加${adjustmentAmount}元, 净调整${totalDiff}元`
      );
      
      result = {
        original_fee: {
          bed_code: originalBed.bed_code,
          semester_fee: originalSemesterFee,
          daily_rate: Math.round(originalDailyRate * 100) / 100,
          refund_amount: refundAmount
        },
        new_fee: {
          bed_code: targetBed.bed_code,
          semester_fee: targetSemesterFee,
          daily_rate: Math.round(targetDailyRate * 100) / 100,
          additional_amount: adjustmentAmount
        },
        net_adjustment: totalDiff,
        adjustment_no: adjustmentNo,
        bill_period: period,
        message: `费用重算完成，净调整${totalDiff}元`
      };
    });
    
    return result;
  }
  
  static getStudentFees(studentId) {
    return db.data.fees
      .filter(f => f.student_id === studentId)
      .map(f => {
        const bed = db.data.beds.find(b => b.id === f.bed_id);
        const room = bed ? db.data.dorm_rooms.find(r => r.id === bed.room_id) : null;
        const building = room ? db.data.buildings.find(b => b.id === room.building_id) : null;
        return {
          ...f,
          bed_code: bed?.bed_code,
          room_code: room?.room_code,
          building_name: building?.building_name
        };
      })
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  
  static getFeeAdjustments(studentId = null) {
    let adjustments = [...db.data.fee_adjustments];
    if (studentId) {
      adjustments = adjustments.filter(fa => fa.student_id === studentId);
    }
    
    return adjustments
      .map(fa => {
        const student = db.data.students.find(s => s.id === fa.student_id);
        const originalFee = fa.original_fee_id ? db.data.fees.find(f => f.id === fa.original_fee_id) : null;
        const newFee = fa.new_fee_id ? db.data.fees.find(f => f.id === fa.new_fee_id) : null;
        return {
          ...fa,
          student_name: student?.name,
          student_no: student?.student_no,
          original_fee_no: originalFee?.fee_no,
          new_fee_no: newFee?.fee_no
        };
      })
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  
  static markFeePaid(feeId, operator = 'system') {
    const fee = db.data.fees.find(f => f.id === feeId);
    if (!fee) throw new Error('费用记录不存在');
    
    fee.status = 'paid';
    fee.paid_at = now();
    fee.updated_at = now();
    
    HistoryService.logOperation(
      'FEE_PAID',
      'fees',
      feeId,
      operator,
      `费用已缴纳: 费用号${fee.fee_no}, 金额${fee.amount}元`
    );
    
    return fee;
  }
}

module.exports = FeeService;