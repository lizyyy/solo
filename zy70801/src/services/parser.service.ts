import fs from 'fs';
import csvParser from 'csv-parser';
import { CriticalValueRecord, CallbackRecord, DutyRecord, ConfirmRecord } from '../types';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import crypto from 'crypto';

export const parseCriticalValueCSV = async (filePath: string, batchId: string): Promise<CriticalValueRecord[]> => {
  const records: CriticalValueRecord[] = [];

  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csvParser({
        mapHeaders: ({ header }) => header.trim().toLowerCase()
      }))
      .on('data', (row) => {
        const record: CriticalValueRecord = {
          id: uuidv4(),
          batchId,
          patientId: row['patientid'] || row['患者id'] || row['patient_id'] || '',
          patientName: row['patientname'] || row['患者姓名'] || row['patient_name'] || '',
          testItem: row['testitem'] || row['检验项目'] || row['test_item'] || '',
          testValue: row['testvalue'] || row['检验值'] || row['test_value'] || '',
          unit: row['unit'] || row['单位'] || '',
          referenceRange: row['referencerange'] || row['参考范围'] || row['reference_range'] || '',
          testTime: row['testtime'] || row['检验时间'] || row['test_time'] || '',
          reportTime: row['reporttime'] || row['报告时间'] || row['report_time'] || '',
          department: row['department'] || row['科室'] || '',
          ward: row['ward'] || row['病区'] || '',
          bedNo: row['bedno'] || row['床号'] || row['bed_no'] || '',
          status: 'pending',
          source: 'csv',
          createdAt: dayjs().toISOString()
        };
        records.push(record);
      })
      .on('end', () => {
        resolve(records);
      })
      .on('error', reject);
  });
};

export const parseCallbackJSON = async (filePath: string, batchId: string): Promise<CallbackRecord[]> => {
  const content = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(content);
  const records: CallbackRecord[] = [];

  const items = Array.isArray(data) ? data : (data.records || data.data || []);

  for (const item of items) {
    records.push({
      id: uuidv4(),
      batchId,
      patientId: item.patientId || item.患者id || item.patient_id || '',
      patientName: item.patientName || item.患者姓名 || item.patient_name || '',
      callbackTime: item.callbackTime || item.回告时间 || item.callback_time || '',
      callbackPerson: item.callbackPerson || item.回告人 || item.callback_person || '',
      callbackPhone: item.callbackPhone || item.回告电话 || item.callback_phone || '',
      receiver: item.receiver || item.接收人 || '',
      receiverPhone: item.receiverPhone || item.接收人电话 || item.receiver_phone || '',
      callbackContent: item.callbackContent || item.回告内容 || item.callback_content || '',
      callbackResult: (item.callbackResult || item.回告结果 || 'success') as 'success' | 'failed',
      failureReason: item.failureReason || item.失败原因 || '',
      source: 'json',
      createdAt: dayjs().toISOString()
    });
  }

  return records;
};

export const parseDutyCSV = async (filePath: string, batchId: string): Promise<DutyRecord[]> => {
  const records: DutyRecord[] = [];

  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csvParser({
        mapHeaders: ({ header }) => header.trim().toLowerCase()
      }))
      .on('data', (row) => {
        const record: DutyRecord = {
          id: uuidv4(),
          batchId,
          date: row['date'] || row['日期'] || '',
          shift: (row['shift'] || row['班次'] || 'day') as 'day' | 'night',
          department: row['department'] || row['科室'] || '',
          doctorName: row['doctorname'] || row['医生姓名'] || row['doctor_name'] || '',
          doctorPhone: row['doctorphone'] || row['医生电话'] || row['doctor_phone'] || '',
          startTime: row['starttime'] || row['开始时间'] || row['start_time'] || '',
          endTime: row['endtime'] || row['结束时间'] || row['end_time'] || '',
          isOnDuty: row['isonduty'] !== 'false' && row['是否值班'] !== '否',
          source: 'csv',
          createdAt: dayjs().toISOString()
        };
        records.push(record);
      })
      .on('end', () => {
        resolve(records);
      })
      .on('error', reject);
  });
};

export const parseConfirmJSON = async (filePath: string, batchId: string): Promise<ConfirmRecord[]> => {
  const content = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(content);
  const records: ConfirmRecord[] = [];

  const items = Array.isArray(data) ? data : (data.records || data.data || []);

  for (const item of items) {
    records.push({
      id: uuidv4(),
      criticalValueId: item.criticalValueId || item.危急值ID || item.critical_value_id || '',
      confirmTime: item.confirmTime || item.确认时间 || item.confirm_time || dayjs().toISOString(),
      confirmer: item.confirmer || item.确认人 || '',
      confirmerPhone: item.confirmerPhone || item.确认人电话 || item.confirmer_phone || '',
      confirmResult: (item.confirmResult || item.确认结果 || 'confirmed') as 'confirmed' | 'rejected',
      confirmNote: item.confirmNote || item.确认备注 || '',
      createdAt: dayjs().toISOString()
    });
  }

  return records;
};

export const calculateFileHash = (filePath: string): string => {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
};
