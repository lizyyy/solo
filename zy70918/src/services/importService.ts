import * as fs from 'fs';
const csv = require('csv-parser');
import { v4 as uuidv4 } from 'uuid';
import {
  ElderProfile,
  NurseSchedule,
  ServiceOrder,
  ImportResult,
  ServiceOrderStatus,
} from '../types';
import dataStore from '../store/dataStore';

export class ImportService {
  async importServiceOrdersFromCSV(filePath: string): Promise<ImportResult<ServiceOrder>> {
    const results: ServiceOrder[] = [];
    const errors: string[] = [];
    let lineNumber = 0;
    return new Promise((resolve) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data: Record<string, string>) => {
          lineNumber++;
          try {
            const order = this.parseServiceOrder(data, lineNumber);
            if (order) results.push(order);
          } catch (e: any) {
            errors.push(`行 ${lineNumber}: ${e.message}`);
          }
        })
        .on('end', () => {
          dataStore.saveServiceOrders(results);
          resolve({ success: errors.length === 0, data: results, errors, totalCount: lineNumber, validCount: results.length });
        })
        .on('error', (err: Error) => {
          errors.push(`文件读取错误: ${err.message}`);
          resolve({ success: false, data: results, errors, totalCount: lineNumber, validCount: results.length });
        });
    });
  }

  async importNurseSchedulesFromJSON(filePath: string): Promise<ImportResult<NurseSchedule>> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);
      const schedules: NurseSchedule[] = [];
      const errors: string[] = [];
      const scheduleArray = Array.isArray(data) ? data : [data];
      scheduleArray.forEach((item: any, index: number) => {
        try {
          const schedule = this.parseNurseSchedule(item);
          schedules.push(schedule);
        } catch (e: any) {
          errors.push(`条目 ${index + 1}: ${e.message}`);
        }
      });
      dataStore.saveSchedules(schedules);
      return { success: errors.length === 0, data: schedules, errors, totalCount: scheduleArray.length, validCount: schedules.length };
    } catch (e: any) {
      return { success: false, data: [], errors: [`JSON解析错误: ${e.message}`], totalCount: 0, validCount: 0 };
    }
  }

  async importElderProfilesFromJSON(filePath: string): Promise<ImportResult<ElderProfile>> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);
      const elders: ElderProfile[] = [];
      const errors: string[] = [];
      const elderArray = Array.isArray(data) ? data : [data];
      elderArray.forEach((item: any, index: number) => {
        try {
          const elder = this.parseElderProfile(item);
          elders.push(elder);
        } catch (e: any) {
          errors.push(`条目 ${index + 1}: ${e.message}`);
        }
      });
      dataStore.saveElders(elders);
      return { success: errors.length === 0, data: elders, errors, totalCount: elderArray.length, validCount: elders.length };
    } catch (e: any) {
      return { success: false, data: [], errors: [`JSON解析错误: ${e.message}`], totalCount: 0, validCount: 0 };
    }
  }

  private parseServiceOrder(data: Record<string, string>, lineNumber: number): ServiceOrder | null {
    const requiredFields = ['orderNo', 'elderId', 'elderName', 'nurseId', 'nurseName', 'serviceDate', 'serviceTime', 'serviceItems', 'actualDuration', 'status'];
    const missing = requiredFields.filter(f => !data[f]);
    if (missing.length > 0) throw new Error(`缺少必填字段: ${missing.join(', ')}`);
    const statusMap: Record<string, ServiceOrderStatus> = { '已完成': 'completed', '待处理': 'pending', '已取消': 'cancelled' };
    const status = statusMap[data.status];
    if (!status) throw new Error(`无效的状态值: ${data.status}`);
    return {
      id: uuidv4(),
      orderNo: data.orderNo,
      elderId: data.elderId,
      elderName: data.elderName,
      nurseId: data.nurseId,
      nurseName: data.nurseName,
      serviceDate: data.serviceDate,
      serviceTime: data.serviceTime,
      serviceItems: (data.serviceItems || '').split(/[,，;；]/).map((s: string) => s.trim()).filter(Boolean),
      actualDuration: parseInt(data.actualDuration, 10) || 0,
      status,
      cancelReason: data.cancelReason,
      createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
      signedBy: data.signedBy,
    };
  }

  private parseNurseSchedule(data: any): NurseSchedule {
    const requiredFields = ['nurseId', 'nurseName', 'date', 'timeSlots'];
    const missing = requiredFields.filter(f => !data[f]);
    if (missing.length > 0) throw new Error(`缺少必填字段: ${missing.join(', ')}`);
    if (!Array.isArray(data.timeSlots)) throw new Error('timeSlots 必须是数组');
    return {
      nurseId: data.nurseId,
      nurseName: data.nurseName,
      skills: data.skills || [],
      district: data.district || '',
      date: data.date,
      timeSlots: data.timeSlots.map((slot: any) => ({
        start: slot.start,
        end: slot.end,
        elderId: slot.elderId,
        elderName: slot.elderName,
        serviceType: slot.serviceType,
        status: slot.status || 'scheduled',
        cancelReason: slot.cancelReason,
      })),
    };
  }

  private parseElderProfile(data: any): ElderProfile {
    const requiredFields = ['id', 'name', 'idCard', 'phone', 'address', 'district'];
    const missing = requiredFields.filter(f => !data[f]);
    if (missing.length > 0) throw new Error(`缺少必填字段: ${missing.join(', ')}`);
    return {
      id: data.id,
      name: data.name,
      idCard: data.idCard,
      phone: data.phone,
      address: data.address,
      district: data.district,
      serviceItems: data.serviceItems || [],
      careLevel: data.careLevel || '',
      createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
    };
  }
}

export default new ImportService();
