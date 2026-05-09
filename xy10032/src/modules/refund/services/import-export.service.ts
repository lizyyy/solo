import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { Refund } from '../refund.entity';
import { CreateRefundDto } from '../dto/create-refund.dto';
import { RefundService } from './refund.service';
import { RefundStatus } from '../../../common/enums/refund-status.enum';
import { ActionType } from '../../../common/enums/action-type.enum';
import { LogLevel } from '../../../common/enums/log-level.enum';
import { Role } from '../../../common/enums/role.enum';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { QueryRefundDto } from '../dto/query-refund.dto';

@Injectable()
export class ImportExportService {
  private readonly logger = new Logger(ImportExportService.name);

  constructor(
    @InjectRepository(Refund)
    private refundRepository: Repository<Refund>,
    private refundService: RefundService,
    private auditLogService: AuditLogService,
  ) {}

  async exportToCSV(query: QueryRefundDto, userId: string, username: string): Promise<string> {
    const result = await this.refundService.findAll(query);
    const refunds = result.items;

    const headers = [
      '退款单号',
      '订单号',
      '金额',
      '货币',
      '退款方式',
      '状态',
      '原因',
      '备注',
      '重试次数',
      '创建人',
      '创建时间',
      '更新时间',
    ];

    const rows = refunds.map((refund) => [
      refund.refundNo,
      refund.orderNo,
      String(refund.amount),
      refund.currency,
      refund.refundMethod,
      this.getStatusDescription(refund.status),
      (refund.reason || '').replace(/"/g, '""'),
      (refund.remark || '').replace(/"/g, '""'),
      String(refund.retryCount),
      username,
      refund.createdAt.toISOString(),
      refund.updatedAt.toISOString(),
    ]);

    const csv = [headers.join(','), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(','))].join('\n');

    await this.auditLogService.create({
      level: LogLevel.INFO,
      actionType: ActionType.EXPORT,
      entityType: 'Refund',
      performedById: userId,
      performedByUsername: username,
      description: `Exported ${refunds.length} refunds to CSV`,
      details: { count: refunds.length, format: 'CSV' },
    });

    return csv;
  }

  async exportToExcel(
    query: QueryRefundDto,
    userId: string,
    username: string,
  ): Promise<Buffer> {
    const result = await this.refundService.findAll(query);
    const refunds = result.items;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('退款记录');

    worksheet.columns = [
      { header: '退款单号', key: 'refundNo', width: 20 },
      { header: '订单号', key: 'orderNo', width: 20 },
      { header: '金额', key: 'amount', width: 12 },
      { header: '货币', key: 'currency', width: 8 },
      { header: '退款方式', key: 'refundMethod', width: 15 },
      { header: '状态', key: 'status', width: 12 },
      { header: '原因', key: 'reason', width: 30 },
      { header: '备注', key: 'remark', width: 30 },
      { header: '重试次数', key: 'retryCount', width: 10 },
      { header: '创建时间', key: 'createdAt', width: 20 },
      { header: '更新时间', key: 'updatedAt', width: 20 },
    ];

    worksheet.getRow(1).font = { bold: true };

    refunds.forEach((refund) => {
      worksheet.addRow({
        refundNo: refund.refundNo,
        orderNo: refund.orderNo,
        amount: refund.amount,
        currency: refund.currency,
        refundMethod: refund.refundMethod,
        status: this.getStatusDescription(refund.status),
        reason: refund.reason,
        remark: refund.remark,
        retryCount: refund.retryCount,
        createdAt: refund.createdAt.toISOString(),
        updatedAt: refund.updatedAt.toISOString(),
      });
    });

    await this.auditLogService.create({
      level: LogLevel.INFO,
      actionType: ActionType.EXPORT,
      entityType: 'Refund',
      performedById: userId,
      performedByUsername: username,
      description: `Exported ${refunds.length} refunds to Excel`,
      details: { count: refunds.length, format: 'Excel' },
    });

    const buffer = (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
    return buffer;
  }

  async importFromCSV(
    csvContent: string,
    userId: string,
    username: string,
    userRole: Role,
  ): Promise<{
    successCount: number;
    failedCount: number;
    results: Array<{
      row: number;
      orderNo: string;
      success: boolean;
      refundId?: string;
      refundNo?: string;
      error?: string;
    }>;
  }> {
    const lines = csvContent.split(/\r?\n/).filter((line) => line.trim() !== '');
    if (lines.length < 2) {
      throw new BadRequestException('CSV file is empty or has no data rows');
    }

    const headerLine = lines[0];
    const headers = this.parseCSVLine(headerLine);

    const rows: Array<Record<string, string>> = [];
    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      if (values.some((v) => v.trim() !== '')) {
        const rowData: Record<string, string> = {};
        headers.forEach((header, idx) => {
          rowData[header] = values[idx] || '';
        });
        rows.push(rowData);
      }
    }

    const results = [];
    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2;

      try {
        const createDto: CreateRefundDto = {
          orderNo: this.parseField(row, ['订单号', 'orderNo', 'order_no']),
          amount: parseFloat(this.parseField(row, ['金额', 'amount'])),
          currency: this.parseField(row, ['货币', 'currency']) || 'CNY',
          refundMethod: this.parseField(row, ['退款方式', 'refundMethod', 'refund_method']) || 'original_payment',
          reason: this.parseField(row, ['原因', 'reason']),
          remark: this.parseField(row, ['备注', 'remark']),
        };

        if (!createDto.orderNo || !createDto.amount || isNaN(createDto.amount)) {
          throw new BadRequestException('订单号和金额为必填字段');
        }

        const refund = await this.refundService.create(createDto, userId, username);
        successCount++;
        results.push({
          row: rowNumber,
          orderNo: createDto.orderNo,
          success: true,
          refundId: refund.id,
          refundNo: refund.refundNo,
        });
      } catch (error) {
        failedCount++;
        results.push({
          row: rowNumber,
          orderNo: this.parseField(row, ['订单号', 'orderNo', 'order_no']) || 'unknown',
          success: false,
          error: error.message,
        });
        this.logger.warn(`Import failed for row ${rowNumber}: ${error.message}`);
      }
    }

    await this.auditLogService.create({
      level: LogLevel.INFO,
      actionType: ActionType.IMPORT,
      entityType: 'Refund',
      performedById: userId,
      performedByUsername: username,
      description: `Imported refunds from CSV: ${successCount} success, ${failedCount} failed`,
      details: {
        totalRows: rows.length,
        successCount,
        failedCount,
        format: 'CSV',
      },
    });

    return {
      successCount,
      failedCount,
      results,
    };
  }

  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (inQuotes) {
        if (char === '"' && line[i + 1] === '"') {
          current += '"';
          i++;
        } else if (char === '"') {
          inQuotes = false;
        } else {
          current += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === ',') {
          result.push(current);
          current = '';
        } else {
          current += char;
        }
      }
    }
    result.push(current);

    return result;
  }

  async importFromExcel(
    excelBuffer: Buffer,
    userId: string,
    username: string,
    userRole: Role,
  ): Promise<{
    successCount: number;
    failedCount: number;
    results: Array<{
      row: number;
      orderNo: string;
      success: boolean;
      refundId?: string;
      refundNo?: string;
      error?: string;
    }>;
  }> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(excelBuffer as any);
    const worksheet = workbook.worksheets[0];

    const headers: string[] = [];
    const rows: Array<Record<string, string>> = [];

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        row.eachCell((cell) => {
          headers.push(String(cell.value).trim());
        });
      } else {
        const rowData: Record<string, string> = {};
        row.eachCell((cell, colNumber) => {
          if (headers[colNumber - 1]) {
            rowData[headers[colNumber - 1]] = String(cell.value || '').trim();
          }
        });
        if (Object.keys(rowData).some((key) => rowData[key])) {
          rows.push(rowData);
        }
      }
    });

    const results = [];
    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2;

      try {
        const createDto: CreateRefundDto = {
          orderNo: this.parseField(row, ['订单号', 'orderNo', 'order_no']),
          amount: parseFloat(this.parseField(row, ['金额', 'amount'])),
          currency: this.parseField(row, ['货币', 'currency']) || 'CNY',
          refundMethod: this.parseField(row, ['退款方式', 'refundMethod', 'refund_method']) || 'original_payment',
          reason: this.parseField(row, ['原因', 'reason']),
          remark: this.parseField(row, ['备注', 'remark']),
        };

        if (!createDto.orderNo || !createDto.amount || isNaN(createDto.amount)) {
          throw new BadRequestException('订单号和金额为必填字段');
        }

        const refund = await this.refundService.create(createDto, userId, username);
        successCount++;
        results.push({
          row: rowNumber,
          orderNo: createDto.orderNo,
          success: true,
          refundId: refund.id,
          refundNo: refund.refundNo,
        });
      } catch (error) {
        failedCount++;
        results.push({
          row: rowNumber,
          orderNo: this.parseField(row, ['订单号', 'orderNo', 'order_no']) || 'unknown',
          success: false,
          error: error.message,
        });
        this.logger.warn(`Import failed for row ${rowNumber}: ${error.message}`);
      }
    }

    await this.auditLogService.create({
      level: LogLevel.INFO,
      actionType: ActionType.IMPORT,
      entityType: 'Refund',
      performedById: userId,
      performedByUsername: username,
      description: `Imported refunds from Excel: ${successCount} success, ${failedCount} failed`,
      details: {
        totalRows: rows.length,
        successCount,
        failedCount,
        format: 'Excel',
      },
    });

    return {
      successCount,
      failedCount,
      results,
    };
  }

  private parseField(row: Record<string, string>, possibleKeys: string[]): string {
    for (const key of possibleKeys) {
      if (row[key] !== undefined && row[key] !== null) {
        return row[key];
      }
    }
    return '';
  }

  private getStatusDescription(status: RefundStatus): string {
    const descriptions: Record<RefundStatus, string> = {
      [RefundStatus.DRAFT]: '草稿',
      [RefundStatus.PENDING]: '待审批',
      [RefundStatus.PROCESSING]: '处理中',
      [RefundStatus.SUCCESS]: '退款成功',
      [RefundStatus.FAILED]: '退款失败',
      [RefundStatus.CANCELLED]: '已取消',
      [RefundStatus.REJECTED]: '已拒绝',
      [RefundStatus.RETRYING]: '重试中',
    };
    return descriptions[status] || status;
  }
}
