import * as fs from 'fs';
import csv = require('csv-parser');
import { AttendanceRecord, AssignmentRecord, CourseRule } from '../types';

export class FileParser {
  public static async parseAttendanceCSV(filePath: string): Promise<AttendanceRecord[]> {
    return new Promise((resolve, reject) => {
      const records: AttendanceRecord[] = [];
      const rawData: Record<string, any>[] = [];

      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data: Record<string, any>) => rawData.push(data))
        .on('end', () => {
          try {
            for (const data of rawData) {
              const record: AttendanceRecord = {
                employeeId: data.employeeId || data.员工编号 || '',
                employeeName: data.employeeName || data.姓名 || '',
                courseBatch: data.courseBatch || data.课程批次 || '',
                courseName: data.courseName || data.课程名称 || '',
                checkInTime: data.checkInTime || data.签到时间 || '',
                scheduledStartTime: data.scheduledStartTime || data.应签到时间 || '',
                checkInStatus: (data.checkInStatus || data.签到状态 || 'normal') as 'normal' | 'late' | 'absent' | 'makeup',
                makeupApproved: data.makeupApproved === 'true' || data.补签审批 === '通过' ? true : 
                               data.makeupApproved === 'false' || data.补签审批 === '未通过' ? false : undefined,
                makeupReason: data.makeupReason || data.补签理由 || undefined,
                rawData: data
              };
              records.push(record);
            }
            resolve(records);
          } catch (error) {
            reject(error);
          }
        })
        .on('error', reject);
    });
  }

  public static parseAssignmentsJSON(content: string): AssignmentRecord[] {
    const data = JSON.parse(content);
    const records: AssignmentRecord[] = [];

    const items = Array.isArray(data) ? data : (data.assignments || data.records || data);

    for (const item of items) {
      const record: AssignmentRecord = {
        employeeId: item.employeeId || item.员工编号 || '',
        employeeName: item.employeeName || item.姓名 || '',
        courseBatch: item.courseBatch || item.课程批次 || '',
        courseName: item.courseName || item.课程名称 || '',
        assignmentId: item.assignmentId || item.作业ID || '',
        assignmentName: item.assignmentName || item.作业名称 || '',
        submittedAt: item.submittedAt || item.提交时间 || '',
        deadline: item.deadline || item.截止时间 || '',
        score: Number(item.score || item.得分 || 0),
        passScore: Number(item.passScore || item.及格分 || 60),
        status: (item.status || item.状态 || 'pending') as 'passed' | 'failed' | 'pending' | 'submitted_late',
        rawData: item
      };
      records.push(record);
    }

    return records;
  }

  public static parseCourseRule(content: string): CourseRule {
    const data = JSON.parse(content);
    return {
      courseBatch: data.courseBatch || data.课程批次 || '',
      courseName: data.courseName || data.课程名称 || '',
      lateThresholdMinutes: Number(data.lateThresholdMinutes || data.迟到阈值分钟 || 15),
      latePenaltyPoints: Number(data.latePenaltyPoints || data.迟到扣分数 || 2),
      maxLateAllowed: Number(data.maxLateAllowed || data.最大迟到次数 || 3),
      allowMakeup: data.allowMakeup !== false && data.允许补签 !== false,
      makeupDeadlineDays: Number(data.makeupDeadlineDays || data.补签期限天 || 7),
      requiredAttendanceRate: Number(data.requiredAttendanceRate || data.要求出勤率 || 0.8),
      certificateRevokeConditions: {
        tooManyLates: data.certificateRevokeConditions?.tooManyLates ?? data.证书撤销条件?.迟到过多 ?? true,
        lowAttendance: data.certificateRevokeConditions?.lowAttendance ?? data.证书撤销条件?.出勤率不足 ?? true,
        assignmentFailed: data.certificateRevokeConditions?.assignmentFailed ?? data.证书撤销条件?.作业不合格 ?? true,
        cheatingDetected: data.certificateRevokeConditions?.cheatingDetected ?? data.证书撤销条件?.作弊 ?? true
      },
      appealWindowDays: Number(data.appealWindowDays || data.申诉期限天 || 3)
    };
  }

  public static parseAttendanceFromJSON(content: string): AttendanceRecord[] {
    const data = JSON.parse(content);
    const items = Array.isArray(data) ? data : (data.attendance || data.records || data);
    return items.map((item: any) => ({
      employeeId: item.employeeId || '',
      employeeName: item.employeeName || '',
      courseBatch: item.courseBatch || '',
      courseName: item.courseName || '',
      checkInTime: item.checkInTime || '',
      scheduledStartTime: item.scheduledStartTime || '',
      checkInStatus: (item.checkInStatus || 'normal') as 'normal' | 'late' | 'absent' | 'makeup',
      makeupApproved: item.makeupApproved,
      makeupReason: item.makeupReason,
      rawData: item
    }));
  }
}
