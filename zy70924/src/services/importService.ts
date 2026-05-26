import { v4 as uuidv4 } from 'uuid';
import { db } from '../database';
import { logAction } from './auditService';
import csv from 'csv-parser';
import { Readable } from 'stream';

export interface AttendanceRow {
  学员工号: string;
  学员姓名: string;
  部门?: string;
  签到日期: string;
  签到时间: string;
  签退时间?: string;
}

export interface HomeworkData {
  学员工号: string;
  作业名称: string;
  分数?: number;
  提交时间?: string;
}

export const importAttendanceCSV = async (
  batchId: string,
  csvContent: string,
  operator: string
): Promise<{ imported: number; errors: string[] }> => {
  const results: AttendanceRow[] = [];
  const errors: string[] = [];
  
  return new Promise((resolve, reject) => {
    const stream = Readable.from(csvContent);
    stream
      .pipe(csv())
      .on('data', (data: any) => results.push(data))
      .on('end', async () => {
        try {
          let imported = 0;
          const now = new Date().toISOString();
          
          for (const row of results) {
            if (!row['学员工号'] || !row['签到日期']) {
              errors.push(`跳过无效行: ${JSON.stringify(row)}`);
              continue;
            }
            
            const studentId = await getOrCreateStudent(
              batchId,
              row['学员工号'],
              row['学员姓名'],
              row['部门']
            );
            
            const recordId = `att_${studentId}_${row['签到日期']}`;
            const { status, lateMinutes } = calculateAttendanceStatus(
              row['签到时间'],
              '09:00',
              30
            );
            
            await new Promise<void>((res, rej) => {
              db.run(
                `INSERT OR REPLACE INTO attendance_records 
                 (id, student_id, batch_id, session_date, check_in_time, check_out_time, status, late_minutes, is_makeup, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
                 ON CONFLICT(student_id, session_date, batch_id) DO UPDATE SET
                 check_in_time=excluded.check_in_time, check_out_time=excluded.check_out_time,
                 status=excluded.status, late_minutes=excluded.late_minutes`,
                [recordId, studentId, batchId, row['签到日期'], 
                 row['签到时间'] || null, row['签退时间'] || null, 
                 status, lateMinutes, now],
                (err) => err ? rej(err) : res()
              );
            });
            imported++;
          }
          
          await updateBatchStudentCount(batchId);
          await logAction({
            batch_id: batchId,
            action: 'import_attendance',
            details: `导入签到记录 ${imported} 条`,
            operator
          });
          
          resolve({ imported, errors });
        } catch (err) {
          reject(err);
        }
      })
      .on('error', reject);
  });
};

export const importHomeworkJSON = async (
  batchId: string,
  homeworkList: HomeworkData[],
  operator: string
): Promise<{ imported: number }> => {
  const now = new Date().toISOString();
  let imported = 0;
  
  for (const hw of homeworkList) {
    const studentId = await getStudentByEmployeeId(batchId, hw.学员工号);
    if (!studentId) continue;
    
    const recordId = `hw_${studentId}_${hw.作业名称}`;
    const status = hw.分数 !== undefined ? 'graded' : (hw.提交时间 ? 'submitted' : 'pending');
    
    await new Promise<void>((resolve, reject) => {
      db.run(
        `INSERT OR REPLACE INTO homework_records 
         (id, student_id, batch_id, homework_name, score, submitted_at, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(student_id, homework_name, batch_id) DO UPDATE SET
         score=excluded.score, submitted_at=excluded.submitted_at, status=excluded.status`,
        [recordId, studentId, batchId, hw.作业名称, 
         hw.分数 || null, hw.提交时间 || null, status, now],
        (err) => err ? reject(err) : resolve()
      );
    });
    imported++;
  }
  
  await logAction({
    batch_id: batchId,
    action: 'import_homework',
    details: `导入作业记录 ${imported} 条`,
    operator
  });
  
  return { imported };
};

const getOrCreateStudent = (
  batchId: string,
  employeeId: string,
  name: string,
  department?: string
): Promise<string> => {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT id FROM students WHERE batch_id = ? AND employee_id = ?`,
      [batchId, employeeId],
      (err, row: any) => {
        if (err) return reject(err);
        if (row) return resolve(row.id);
        
        const id = uuidv4();
        const now = new Date().toISOString();
        db.run(
          `INSERT INTO students (id, batch_id, employee_id, name, department, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [id, batchId, employeeId, name, department || null, now],
          (insertErr) => insertErr ? reject(insertErr) : resolve(id)
        );
      }
    );
  });
};

const getStudentByEmployeeId = (batchId: string, employeeId: string): Promise<string | null> => {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT id FROM students WHERE batch_id = ? AND employee_id = ?`,
      [batchId, employeeId],
      (err, row: any) => err ? reject(err) : resolve(row?.id || null)
    );
  });
};

const updateBatchStudentCount = (batchId: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE batches SET total_students = (
        SELECT COUNT(DISTINCT student_id) FROM attendance_records WHERE batch_id = ?
      ) WHERE id = ?`,
      [batchId, batchId],
      (err) => err ? reject(err) : resolve()
    );
  });
};

const calculateAttendanceStatus = (
  checkInTime?: string,
  expectedTime: string = '09:00',
  thresholdMinutes: number = 30
): { status: string; lateMinutes: number } => {
  if (!checkInTime) {
    return { status: 'absent', lateMinutes: 0 };
  }
  
  const checkIn = parseTime(checkInTime);
  const expected = parseTime(expectedTime);
  
  if (checkIn <= expected) {
    return { status: 'normal', lateMinutes: 0 };
  }
  
  const lateMinutes = Math.floor((checkIn - expected) / 60000);
  
  if (lateMinutes > thresholdMinutes) {
    return { status: 'absent', lateMinutes };
  }
  
  return { status: 'late', lateMinutes };
};

const parseTime = (timeStr: string): number => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const date = new Date();
  date.setHours(hours || 0, minutes || 0, 0, 0);
  return date.getTime();
};
