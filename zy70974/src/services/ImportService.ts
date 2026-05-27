import * as fs from 'fs';
import csvParser from 'csv-parser';
import { v4 as uuidv4 } from 'uuid';
import {
  RegistrationRecord,
  WaitlistRecord,
  CheckInRecord,
  BlacklistRecord,
  ImportResult,
  DataSource,
  ActivityType,
  RegistrationStatus,
  CheckInStatus,
} from '../types';

export class ImportService {
  private parseDate(dateStr: string | undefined): Date {
    if (!dateStr) return new Date();
    const parsed = new Date(dateStr);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  private parseActivityType(type: string | undefined): ActivityType {
    if (!type) return ActivityType.PARENT_CHILD;
    const lower = type.toLowerCase();
    if (lower.includes('parent') || lower.includes('child') || lower.includes('亲子')) {
      return ActivityType.PARENT_CHILD;
    }
    if (lower.includes('elder') || lower.includes('老人') || lower.includes('老年')) {
      return ActivityType.ELDERLY;
    }
    return ActivityType.PARENT_CHILD;
  }

  private parseRegistrationStatus(status: string | undefined): RegistrationStatus {
    if (!status) return RegistrationStatus.CONFIRMED;
    const lower = status.toLowerCase();
    if (lower.includes('cancel') || lower.includes('取消')) return RegistrationStatus.CANCELLED;
    if (lower.includes('wait') || lower.includes('候补')) return RegistrationStatus.WAITLIST;
    if (lower.includes('pending') || lower.includes('待确认')) return RegistrationStatus.PENDING;
    if (lower.includes('promote') || lower.includes('递补')) return RegistrationStatus.PROMOTED;
    return RegistrationStatus.CONFIRMED;
  }

  private parseCheckInStatus(status: string | undefined): CheckInStatus {
    if (!status) return CheckInStatus.CHECKED_IN;
    const lower = status.toLowerCase();
    if (lower.includes('no') || lower.includes('未签') || lower.includes('缺席')) return CheckInStatus.NOT_CHECKED_IN;
    if (lower.includes('absent') || lower.includes('缺勤')) return CheckInStatus.ABSENT;
    return CheckInStatus.CHECKED_IN;
  }

  public async parseRegistrationCSV(filePath: string): Promise<ImportResult<RegistrationRecord>> {
    return new Promise((resolve) => {
      const results: RegistrationRecord[] = [];
      const errors: string[] = [];
      const warnings: string[] = [];
      let rowCount = 0;

      fs.createReadStream(filePath)
        .pipe(csvParser())
        .on('data', (data: Record<string, string>) => {
          rowCount++;
          try {
            const name = data['姓名'] || data['name'] || data['Name'];
            const phone = data['电话'] || data['手机'] || data['phone'] || data['Phone'];
            
            if (!name || !phone) {
              warnings.push(`第 ${rowCount} 行: 缺少姓名或电话，已跳过`);
              return;
            }

            const record: RegistrationRecord = {
              id: uuidv4(),
              activityType: this.parseActivityType(data['活动类型'] || data['activityType']),
              activityName: data['活动名称'] || data['activityName'] || data['Activity'] || '未命名活动',
              name: name.trim(),
              phone: phone.trim(),
              idCard: data['身份证'] || data['idCard'] || data['ID'],
              registrationTime: this.parseDate(data['报名时间'] || data['registrationTime'] || data['Date']),
              status: this.parseRegistrationStatus(data['状态'] || data['status']),
              source: DataSource.REGISTRATION_CSV,
              originalData: { ...data, rowNumber: rowCount },
            };
            results.push(record);
          } catch (e) {
            errors.push(`第 ${rowCount} 行解析失败: ${(e as Error).message}`);
          }
        })
        .on('end', () => {
          resolve({
            success: errors.length === 0,
            data: results,
            errors,
            warnings,
            totalCount: rowCount,
            validCount: results.length,
          });
        })
        .on('error', (err: Error) => {
          resolve({
            success: false,
            data: results,
            errors: [`文件读取失败: ${err.message}`],
            warnings,
            totalCount: rowCount,
            validCount: results.length,
          });
        });
    });
  }

  public async parseWaitlistJSON(filePath: string): Promise<ImportResult<WaitlistRecord>> {
    return new Promise((resolve) => {
      try {
        const rawData = fs.readFileSync(filePath, 'utf-8');
        const jsonData = JSON.parse(rawData);
        const results: WaitlistRecord[] = [];
        const errors: string[] = [];
        const warnings: string[] = [];
        let rowCount = 0;

        const waitlistArray = Array.isArray(jsonData) ? jsonData : (jsonData.waitlist || jsonData.data || []);

        for (const item of waitlistArray) {
          rowCount++;
          try {
            const name = item.name || item.姓名;
            const phone = item.phone || item.电话 || item.手机;
            
            if (!name || !phone) {
              warnings.push(`候补记录 ${rowCount}: 缺少姓名或电话，已跳过`);
              continue;
            }

            const record: WaitlistRecord = {
              id: uuidv4(),
              activityType: this.parseActivityType(item.activityType || item.活动类型),
              activityName: item.activityName || item.活动名称 || '未命名活动',
              name: name.trim(),
              phone: phone.trim(),
              idCard: item.idCard || item.身份证,
              waitlistPosition: item.position || item.排名 || rowCount,
              addedTime: this.parseDate(item.addedTime || item.添加时间),
              promotedToMain: item.promoted || item.已递补 || false,
              promotedTime: item.promotedTime ? this.parseDate(item.promotedTime) : undefined,
              source: DataSource.WAITLIST_JSON,
              originalData: { ...item, index: rowCount },
            };
            results.push(record);
          } catch (e) {
            errors.push(`候补记录 ${rowCount} 解析失败: ${(e as Error).message}`);
          }
        }

        resolve({
          success: errors.length === 0,
          data: results,
          errors,
          warnings,
          totalCount: rowCount,
          validCount: results.length,
        });
      } catch (err) {
        resolve({
          success: false,
          data: [],
          errors: [`JSON文件解析失败: ${(err as Error).message}`],
          warnings: [],
          totalCount: 0,
          validCount: 0,
        });
      }
    });
  }

  public async parseCheckInCSV(filePath: string): Promise<ImportResult<CheckInRecord>> {
    return new Promise((resolve) => {
      const results: CheckInRecord[] = [];
      const errors: string[] = [];
      const warnings: string[] = [];
      let rowCount = 0;

      fs.createReadStream(filePath)
        .pipe(csvParser())
        .on('data', (data: Record<string, string>) => {
          rowCount++;
          try {
            const name = data['姓名'] || data['name'] || data['Name'];
            const phone = data['电话'] || data['手机'] || data['phone'] || data['Phone'];
            
            if (!name || !phone) {
              warnings.push(`签到表第 ${rowCount} 行: 缺少姓名或电话，已跳过`);
              return;
            }

            const record: CheckInRecord = {
              id: uuidv4(),
              activityType: this.parseActivityType(data['活动类型'] || data['activityType']),
              activityName: data['活动名称'] || data['activityName'] || data['Activity'] || '未命名活动',
              name: name.trim(),
              phone: phone.trim(),
              checkInTime: this.parseDate(data['签到时间'] || data['checkInTime'] || data['Time']),
              status: this.parseCheckInStatus(data['状态'] || data['status']),
              source: DataSource.CHECKIN_CSV,
              originalData: { ...data, rowNumber: rowCount },
            };
            results.push(record);
          } catch (e) {
            errors.push(`签到表第 ${rowCount} 行解析失败: ${(e as Error).message}`);
          }
        })
        .on('end', () => {
          resolve({
            success: errors.length === 0,
            data: results,
            errors,
            warnings,
            totalCount: rowCount,
            validCount: results.length,
          });
        })
        .on('error', (err: Error) => {
          resolve({
            success: false,
            data: results,
            errors: [`签到表文件读取失败: ${err.message}`],
            warnings,
            totalCount: rowCount,
            validCount: results.length,
          });
        });
    });
  }

  public async parseBlacklistJSON(filePath: string): Promise<ImportResult<BlacklistRecord>> {
    return new Promise((resolve) => {
      try {
        const rawData = fs.readFileSync(filePath, 'utf-8');
        const jsonData = JSON.parse(rawData);
        const results: BlacklistRecord[] = [];
        const errors: string[] = [];
        const warnings: string[] = [];
        let rowCount = 0;

        const blacklistArray = Array.isArray(jsonData) ? jsonData : (jsonData.blacklist || jsonData.data || []);

        for (const item of blacklistArray) {
          rowCount++;
          try {
            const name = item.name || item.姓名;
            const phone = item.phone || item.电话 || item.手机;
            
            if (!name || !phone) {
              warnings.push(`黑名单记录 ${rowCount}: 缺少姓名或电话，已跳过`);
              continue;
            }

            const record: BlacklistRecord = {
              id: uuidv4(),
              name: name.trim(),
              phone: phone.trim(),
              idCard: item.idCard || item.身份证,
              reason: item.reason || item.原因 || '未说明原因',
              addedTime: this.parseDate(item.addedTime || item.添加时间),
              source: DataSource.BLACKLIST_JSON,
            };
            results.push(record);
          } catch (e) {
            errors.push(`黑名单记录 ${rowCount} 解析失败: ${(e as Error).message}`);
          }
        }

        resolve({
          success: errors.length === 0,
          data: results,
          errors,
          warnings,
          totalCount: rowCount,
          validCount: results.length,
        });
      } catch (err) {
        resolve({
          success: false,
          data: [],
          errors: [`黑名单JSON文件解析失败: ${(err as Error).message}`],
          warnings: [],
          totalCount: 0,
          validCount: 0,
        });
      }
    });
  }
}
