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
