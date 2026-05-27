import * as fs from 'fs';
import * as csv from 'csv-parser';
import { Readable } from 'stream';
import dayjs from 'dayjs';
import {
  RentalOrder,
  RepairRecord,
  DepositRule,
  ImportSummary,
  OrderStatus,
  RepairLiability,
} from '../types';
import { dataStore } from '../store/dataStore';

export class ImportService {
  async importRentalOrdersFromCSV(filePath: string): Promise<ImportSummary> {
    const results: RentalOrder[] = [];
    const errors: { row: number; message: string }[] = [];
    let rowCount = 0;

    return new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => {
          rowCount++;
          try {
            const order = this.parseRentalOrder(data, rowCount);
            results.push(order);
          } catch (error: any) {
            errors.push({ row: rowCount, message: error.message });
          }
        })
        .on('end', () => {
          results.forEach((order) => {
            const existing = dataStore.getRentalOrderByNo(order.orderNo);
            if (existing) {
              dataStore.updateRentalOrder(existing.id, order);
            } else {
              dataStore.addRentalOrder(order);
            }
          });

          resolve({
            totalRecords: rowCount,
            successful: results.length,
            failed: errors.length,
            errors,
          });
        })
        .on('error', reject);
    });
  }

  async importRentalOrdersFromCSVBuffer(buffer: Buffer): Promise<ImportSummary> {
    const results: RentalOrder[] = [];
    const errors: { row: number; message: string }[] = [];
    let rowCount = 0;

    return new Promise((resolve) => {
      const stream = Readable.from(buffer.toString());
      stream
        .pipe(csv())
        .on('data', (data) => {
          rowCount++;
          try {
            const order = this.parseRentalOrder(data, rowCount);
            results.push(order);
          } catch (error: any) {
            errors.push({ row: rowCount, message: error.message });
          }
        })
        .on('end', () => {
          results.forEach((order) => {
            const existing = dataStore.getRentalOrderByNo(order.orderNo);
            if (existing) {
              dataStore.updateRentalOrder(existing.id, order);
            } else {
              dataStore.addRentalOrder(order);
            }
          });

          resolve({
            totalRecords: rowCount,
            successful: results.length,
            failed: errors.length,
            errors,
          });
        });
    });
  }

  private parseRentalOrder(data: any, rowNum: number): Omit<RentalOrder, 'id'> {
    const requiredFields = [
      'orderNo',
      'tenantName',
      'tenantId',
      'equipmentSerialNo',
      'equipmentName',
      'startDate',
      'endDate',
      'monthlyRent',
      'depositAmount',
      'actualDepositPaid',
    ];

    for (const field of requiredFields) {
      if (!data[field]) {
        throw new Error(`缺少必填字段: ${field}`);
      }
    }

    const startDate = dayjs(data.startDate);
    const endDate = dayjs(data.endDate);

    if (!startDate.isValid()) {
      throw new Error(`开始日期格式无效: ${data.startDate}`);
    }
    if (!endDate.isValid()) {
      throw new Error(`结束日期格式无效: ${data.endDate}`);
    }

    const monthlyRent = parseFloat(data.monthlyRent);
    const depositAmount = parseFloat(data.depositAmount);
    const actualDepositPaid = parseFloat(data.actualDepositPaid);

    if (isNaN(monthlyRent)) {
      throw new Error(`月租金必须是数字: ${data.monthlyRent}`);
    }
    if (isNaN(depositAmount)) {
      throw new Error(`押金金额必须是数字: ${data.depositAmount}`);
    }
    if (isNaN(actualDepositPaid)) {
      throw new Error(`实际支付押金必须是数字: ${data.actualDepositPaid}`);
    }

    return {
      orderNo: data.orderNo.trim(),
      tenantName: data.tenantName.trim(),
      tenantId: data.tenantId.trim(),
      equipmentSerialNo: data.equipmentSerialNo.trim(),
      equipmentName: data.equipmentName.trim(),
      startDate: startDate.format('YYYY-MM-DD'),
      endDate: endDate.format('YYYY-MM-DD'),
      actualReturnDate: data.actualReturnDate
        ? dayjs(data.actualReturnDate).format('YYYY-MM-DD')
        : undefined,
      monthlyRent,
      depositAmount,
      actualDepositPaid,
      status: (data.status as OrderStatus) || 'pending',
      createdAt: dayjs().toISOString(),
      notes: data.notes,
    };
  }

  async importRepairRecordsFromJSON(filePath: string): Promise<ImportSummary> {
    const content = fs.readFileSync(filePath, 'utf-8');
    return this.importRepairRecordsFromJSONContent(content);
  }

  async importRepairRecordsFromJSONContent(content: string): Promise<ImportSummary> {
    const errors: { row: number; message: string }[] = [];
    let records: any[] = [];

    try {
      const parsed = JSON.parse(content);
      records = Array.isArray(parsed) ? parsed : [parsed];
    } catch (error: any) {
      throw new Error(`JSON 解析失败: ${error.message}`);
    }

    const validRecords: Omit<RepairRecord, 'id'>[] = [];

    records.forEach((data, index) => {
      try {
        const record = this.parseRepairRecord(data, index + 1);
        validRecords.push(record);
      } catch (error: any) {
        errors.push({ row: index + 1, message: error.message });
      }
    });

    validRecords.forEach((record) => {
      dataStore.addRepairRecord(record);
    });

    return {
      totalRecords: records.length,
      successful: validRecords.length,
      failed: errors.length,
      errors,
    };
  }

  private parseRepairRecord(data: any, rowNum: number): Omit<RepairRecord, 'id'> {
    const requiredFields = [
      'repairNo',
      'equipmentSerialNo',
      'reportDate',
      'repairDate',
      'repairContent',
      'repairCost',
      'liability',
      'reporter',
    ];

    for (const field of requiredFields) {
      if (data[field] === undefined || data[field] === null || data[field] === '') {
        throw new Error(`第 ${rowNum} 条记录缺少必填字段: ${field}`);
      }
    }

    const reportDate = dayjs(data.reportDate);
    const repairDate = dayjs(data.repairDate);

    if (!reportDate.isValid()) {
      throw new Error(`第 ${rowNum} 条记录报修日期格式无效: ${data.reportDate}`);
    }
    if (!repairDate.isValid()) {
      throw new Error(`第 ${rowNum} 条记录维修日期格式无效: ${data.repairDate}`);
    }

    const repairCost = parseFloat(data.repairCost);
    if (isNaN(repairCost)) {
      throw new Error(`第 ${rowNum} 条记录维修费用必须是数字: ${data.repairCost}`);
    }

    const validLiabilities: RepairLiability[] = ['tenant', 'owner', 'natural_wear', 'pending'];
    if (!validLiabilities.includes(data.liability as RepairLiability)) {
      throw new Error(
        `第 ${rowNum} 条记录责任归属无效，必须是: ${validLiabilities.join(', ')}`
      );
    }

    return {
      repairNo: data.repairNo.trim(),
      equipmentSerialNo: data.equipmentSerialNo.trim(),
      reportDate: reportDate.format('YYYY-MM-DD'),
      repairDate: repairDate.format('YYYY-MM-DD'),
      repairContent: data.repairContent.trim(),
      repairCost,
      liability: data.liability as RepairLiability,
      reporter: data.reporter.trim(),
      isBoundToOrder: !!data.boundOrderNo,
      boundOrderNo: data.boundOrderNo?.trim(),
      notes: data.notes,
    };
  }

  async importDepositRules(rules: Omit<DepositRule, 'id'>[]): Promise<ImportSummary> {
    const errors: { row: number; message: string }[] = [];
    const validRules: Omit<DepositRule, 'id'>[] = [];

    rules.forEach((rule, index) => {
      try {
        this.validateDepositRule(rule, index + 1);
        validRules.push(rule);
      } catch (error: any) {
        errors.push({ row: index + 1, message: error.message });
      }
    });

    validRules.forEach((rule) => {
      dataStore.addDepositRule(rule);
    });

    return {
      totalRecords: rules.length,
      successful: validRules.length,
      failed: errors.length,
      errors,
    };
  }

  private validateDepositRule(rule: Omit<DepositRule, 'id'>, rowNum: number): void {
    if (!rule.ruleName || !rule.ruleName.trim()) {
      throw new Error(`第 ${rowNum} 条规则缺少规则名称`);
    }
    if (rule.depositRate < 0 || rule.depositRate > 1) {
      throw new Error(`第 ${rowNum} 条规则押金比例必须在 0-1 之间`);
    }
    if (rule.minDeposit < 0) {
      throw new Error(`第 ${rowNum} 条规则最低押金不能为负数`);
    }
    if (rule.overduePenaltyRate < 0) {
      throw new Error(`第 ${rowNum} 条规则逾期罚息比例不能为负数`);
    }
    if (rule.overdueGraceDays < 0) {
      throw new Error(`第 ${rowNum} 条规则逾期宽限天数不能为负数`);
    }
  }
}

export const importService = new ImportService();
