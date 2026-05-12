import { v4 as uuidv4 } from 'uuid';
import db from '../config/database';
import { Contract, Installment, Attendance, Schedule } from '../types';
import { BusinessError, ErrorCodes } from '../utils/errors';
import { recordBusinessHistory } from '../utils/history';

export const getContractById = (id: string): Promise<Contract> => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM contracts WHERE id = ?', [id], (err, row: any) => {
      if (err) reject(err);
      else if (!row) reject(new BusinessError(ErrorCodes.CONTRACT_NOT_FOUND, '合同不存在'));
      else resolve(row);
    });
  });
};

export const getContractByNo = (contractNo: string): Promise<Contract> => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM contracts WHERE contract_no = ?', [contractNo], (err, row: any) => {
      if (err) reject(err);
      else if (!row) reject(new BusinessError(ErrorCodes.CONTRACT_NOT_FOUND, '合同不存在'));
      else resolve(row);
    });
  });
};

export const createContract = (data: Omit<Contract, 'id' | 'created_at' | 'updated_at'>, operatorId: string, operatorName: string): Promise<Contract> => {
  return new Promise((resolve, reject) => {
    const id = uuidv4();
    const now = new Date().toISOString();
    const contract = { ...data, id, created_at: now, updated_at: now };
    
    db.run(
      `INSERT INTO contracts (id, contract_no, student_id, student_name, campus_id, campus_name, course_name, total_lessons, paid_lessons, gifted_lessons, total_amount, material_fee, installment_fee, unit_price, status, signed_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.contract_no,
        data.student_id,
        data.student_name,
        data.campus_id,
        data.campus_name,
        data.course_name,
        data.total_lessons,
        data.paid_lessons,
        data.gifted_lessons,
        data.total_amount,
        data.material_fee,
        data.installment_fee,
        data.unit_price,
        data.status,
        data.signed_date,
        now,
        now
      ],
      async (err) => {
        if (err) {
          reject(err);
        } else {
          await recordBusinessHistory('contract', id, 'create', operatorId, operatorName, null, contract);
          resolve(contract);
        }
      }
    );
  });
};

export const getInstallmentsByContractId = (contractId: string): Promise<Installment[]> => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM installments WHERE contract_id = ? ORDER BY installment_no', [contractId], (err, rows: any[]) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

export const getAttendancesByContractId = (contractId: string): Promise<Attendance[]> => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM attendances WHERE contract_id = ? ORDER BY attended_date', [contractId], (err, rows: any[]) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

export const getSchedulesByContractId = (contractId: string): Promise<Schedule[]> => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM schedules WHERE contract_id = ? ORDER BY lesson_date', [contractId], (err, rows: any[]) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

export const createSchedule = (data: Omit<Schedule, 'id' | 'created_at'>, operatorId: string, operatorName: string): Promise<Schedule> => {
  return new Promise((resolve, reject) => {
    const id = uuidv4();
    const now = new Date().toISOString();
    const schedule = { ...data, id, created_at: now };
    
    db.run(
      `INSERT INTO schedules (id, contract_id, lesson_date, lesson_time, teacher_id, teacher_name, status, is_gifted, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.contract_id, data.lesson_date, data.lesson_time, data.teacher_id, data.teacher_name, data.status || 'scheduled', data.is_gifted || 0, now],
      async (err) => {
        if (err) {
          reject(err);
        } else {
          await recordBusinessHistory('schedule', id, 'create', operatorId, operatorName, null, schedule);
          resolve(schedule as Schedule);
        }
      }
    );
  });
};

export const updateScheduleStatus = (scheduleId: string, status: string, operatorId: string, operatorName: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    
    db.get('SELECT * FROM schedules WHERE id = ?', [scheduleId], async (err, oldSchedule: any) => {
      if (err) {
        reject(err);
        return;
      }
      if (!oldSchedule) {
        reject(new Error('排课不存在'));
        return;
      }
      
      db.run('UPDATE schedules SET status = ? WHERE id = ?', [status, scheduleId], async (err) => {
        if (err) {
          reject(err);
        } else {
          await recordBusinessHistory('schedule', scheduleId, 'update_status', operatorId, operatorName, oldSchedule, { ...oldSchedule, status });
          resolve();
        }
      });
    });
  });
};

export const createAttendance = (
  scheduleId: string, 
  contractId: string, 
  isGifted: number, 
  operatorId: string, 
  operatorName: string
): Promise<Attendance> => {
  return new Promise((resolve, reject) => {
    const id = uuidv4();
    const now = new Date().toISOString();
    const attendedDate = new Date().toISOString().split('T')[0];
    
    db.run(
      `INSERT INTO attendances (id, schedule_id, contract_id, attended_date, is_gifted, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, scheduleId, contractId, attendedDate, isGifted, now],
      async (err) => {
        if (err) {
          reject(err);
        } else {
          const attendance = { id, schedule_id: scheduleId, contract_id: contractId, attended_date: attendedDate, is_gifted: isGifted, created_at: now };
          await recordBusinessHistory('attendance', id, 'create', operatorId, operatorName, null, attendance);
          await updateScheduleStatus(scheduleId, 'completed', operatorId, operatorName);
          resolve(attendance as Attendance);
        }
      }
    );
  });
};

export const createInstallment = (data: Omit<Installment, 'id' | 'created_at'>, operatorId: string, operatorName: string): Promise<Installment> => {
  return new Promise((resolve, reject) => {
    const id = uuidv4();
    const now = new Date().toISOString();
    
    db.run(
      `INSERT INTO installments (id, contract_id, installment_no, due_date, amount, principal, fee, status, paid_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.contract_id, data.installment_no, data.due_date, data.amount, data.principal, data.fee, data.status || 'pending', data.paid_date || null, now],
      async (err) => {
        if (err) {
          reject(err);
        } else {
          const installment = { ...data, id, created_at: now };
          await recordBusinessHistory('installment', id, 'create', operatorId, operatorName, null, installment);
          resolve(installment as Installment);
        }
      }
    );
  });
};

export const payInstallment = (installmentId: string, operatorId: string, operatorName: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    const paidDate = new Date().toISOString().split('T')[0];
    
    db.get('SELECT * FROM installments WHERE id = ?', [installmentId], async (err, oldInstallment: any) => {
      if (err) {
        reject(err);
        return;
      }
      if (!oldInstallment) {
        reject(new Error('分期不存在'));
        return;
      }
      if (oldInstallment.status === 'paid') {
        reject(new Error('该分期已支付'));
        return;
      }
      
      db.run('UPDATE installments SET status = ?, paid_date = ? WHERE id = ?', ['paid', paidDate, installmentId], async (err) => {
        if (err) {
          reject(err);
        } else {
          await recordBusinessHistory('installment', installmentId, 'pay', operatorId, operatorName, oldInstallment, { ...oldInstallment, status: 'paid', paid_date: paidDate });
          resolve();
        }
      });
    });
  });
};

export const updateContract = (contractId: string, data: Partial<Contract>, operatorId: string, operatorName: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    
    db.get('SELECT * FROM contracts WHERE id = ?', [contractId], async (err, oldContract: any) => {
      if (err) {
        reject(err);
        return;
      }
      if (!oldContract) {
        reject(new BusinessError(ErrorCodes.CONTRACT_NOT_FOUND, '合同不存在'));
        return;
      }
      
      const fields: string[] = [];
      const values: any[] = [];
      
      if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status); }
      if (data.student_name !== undefined) { fields.push('student_name = ?'); values.push(data.student_name); }
      if (data.course_name !== undefined) { fields.push('course_name = ?'); values.push(data.course_name); }
      
      fields.push('updated_at = ?');
      values.push(now);
      values.push(contractId);
      
      db.run(`UPDATE contracts SET ${fields.join(', ')} WHERE id = ?`, values, async (err) => {
        if (err) {
          reject(err);
        } else {
          await recordBusinessHistory('contract', contractId, 'update', operatorId, operatorName, oldContract, { ...oldContract, ...data, updated_at: now });
          resolve();
        }
      });
    });
  });
};
