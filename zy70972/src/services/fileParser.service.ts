import * as fs from 'fs';
import csvParser from 'csv-parser';
import { RegistrationRow, WaitlistRow, AttendanceRow, BlacklistRow } from '../types/interfaces';

export class FileParserService {
  async parseRegistrationCSV(filePath: string): Promise<RegistrationRow[]> {
    return new Promise((resolve, reject) => {
      const results: RegistrationRow[] = [];
      fs.createReadStream(filePath)
        .pipe(csvParser())
        .on('data', (data: any) => {
          results.push({
            idCard: data.idCard || data.身份证 || data['身份证号'] || '',
            name: data.name || data.姓名 || '',
            phone: data.phone || data.电话 || data.手机号 || '',
            address: data.address || data.地址 || undefined,
            community: data.community || data.社区 || undefined,
          });
        })
        .on('end', () => resolve(results))
        .on('error', reject);
    });
  }

  async parseWaitlistJSON(filePath: string): Promise<WaitlistRow[]> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    
    if (Array.isArray(data)) {
      return data.map((item, index) => ({
        idCard: item.idCard || item.身份证 || item['身份证号'] || '',
        name: item.name || item.姓名 || '',
        phone: item.phone || item.电话 || item.手机号 || '',
        address: item.address || item.地址 || undefined,
        community: item.community || item.社区 || undefined,
        waitlistOrder: item.waitlistOrder || item.候补顺序 || index + 1,
        priority: item.priority || item.优先级 || 0,
        reason: item.reason || item.原因 || undefined,
      }));
    }
    
    if (data.waitlist && Array.isArray(data.waitlist)) {
      return data.waitlist.map((item: any, index: number) => ({
        idCard: item.idCard || item.身份证 || item['身份证号'] || '',
        name: item.name || item.姓名 || '',
        phone: item.phone || item.电话 || item.手机号 || '',
        address: item.address || item.地址 || undefined,
        community: item.community || item.社区 || undefined,
        waitlistOrder: item.waitlistOrder || item.候补顺序 || index + 1,
        priority: item.priority || item.优先级 || 0,
        reason: item.reason || item.原因 || undefined,
      }));
    }

    throw new Error('无效的候补数据格式');
  }

  async parseAttendanceCSV(filePath: string): Promise<AttendanceRow[]> {
    return new Promise((resolve, reject) => {
      const results: AttendanceRow[] = [];
      fs.createReadStream(filePath)
        .pipe(csvParser())
        .on('data', (data: any) => {
          results.push({
            idCard: data.idCard || data.身份证 || data['身份证号'] || '',
            name: data.name || data.姓名 || '',
            signInTime: data.signInTime || data.签到时间 || undefined,
            signOutTime: data.signOutTime || data.签退时间 || undefined,
            status: data.status || data.状态 || undefined,
          });
        })
        .on('end', () => resolve(results))
        .on('error', reject);
    });
  }

  async parseBlacklistCSV(filePath: string): Promise<BlacklistRow[]> {
    return new Promise((resolve, reject) => {
      const results: BlacklistRow[] = [];
      fs.createReadStream(filePath)
        .pipe(csvParser())
        .on('data', (data: any) => {
          results.push({
            idCard: data.idCard || data.身份证 || data['身份证号'] || '',
            name: data.name || data.姓名 || '',
            reason: data.reason || data.原因 || '',
            addedBy: data.addedBy || data.添加人 || 'system',
          });
        })
        .on('end', () => resolve(results))
        .on('error', reject);
    });
  }
}
