import { createObjectCsvWriter } from 'csv-writer';
import csv from 'csv-parser';
import fs from 'fs';
import path from 'path';
import { PassThrough } from 'stream';
import prisma from '../config/prisma';
import logger from '../config/logger';
import { CreateRefundInput, ImportResult, RefundFilter } from '../types';
import { refundService } from './refund-service';
import { BadRequestError } from '../utils/errors';
import { RefundReason, RefundStatus } from '@prisma/client';

export class ImportExportService {
  private readonly exportFields = [
    { id: 'refundNo', title: '退款单号' },
    { id: 'orderNo', title: '订单号' },
    { id: 'customerName', title: '客户姓名' },
    { id: 'customerPhone', title: '客户电话' },
    { id: 'amount', title: '退款金额' },
    { id: 'currency', title: '币种' },
    { id: 'reason', title: '退款原因' },
    { id: 'reasonDetail', title: '原因详情' },
    { id: 'status', title: '状态' },
    { id: 'paymentMethod', title: '支付方式' },
    { id: 'bankAccount', title: '银行账号' },
    { id: 'bankName', title: '银行名称' },
    { id: 'bankBranch', title: '开户行' },
    { id: 'createdAt', title: '创建时间' },
    { id: 'completedAt', title: '完成时间' }
  ];

  async exportToCSV(filter: RefundFilter, userId: string): Promise<string> {
    const { data } = await refundService.getRefundList({
      ...filter,
      limit: 10000
    });

    const fileName = `refunds_${Date.now()}.csv`;
    const filePath = path.join(this.getUploadsDir(), fileName);

    const records = data.map(refund => ({
      refundNo: refund.refundNo,
      orderNo: refund.orderNo,
      customerName: refund.customerName,
      customerPhone: refund.customerPhone || '',
      amount: Number(refund.amount),
      currency: refund.currency,
      reason: this.translateReason(refund.reason),
      reasonDetail: refund.reasonDetail || '',
      status: this.translateStatus(refund.status),
      paymentMethod: refund.paymentMethod || '',
      bankAccount: refund.bankAccount || '',
      bankName: refund.bankName || '',
      bankBranch: refund.bankBranch || '',
      createdAt: refund.createdAt.toISOString(),
      completedAt: refund.completedAt?.toISOString() || ''
    }));

    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: this.exportFields
    });

    await csvWriter.writeRecords(records);

    await prisma.importExportLog.create({
      data: {
        type: 'EXPORT',
        fileName,
        recordCount: records.length,
        successCount: records.length,
        failedCount: 0,
        userId
      }
    });

    logger.info(`导出CSV成功: ${fileName}, 记录数: ${records.length}, 用户: ${userId}`);

    return filePath;
  }

  async importFromCSV(filePath: string, userId: string): Promise<ImportResult> {
    return new Promise((resolve, reject) => {
      const results: ImportResult = {
        total: 0,
        success: 0,
        failed: 0,
        errors: []
      };

      const validReasons = Object.values(RefundReason);
      let rowNumber = 0;

      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', async (row) => {
          rowNumber++;
          results.total++;

          try {
            const input = this.parseRow(row, validReasons);
            await refundService.createRefund(input, userId);
            results.success++;
          } catch (error: any) {
            results.failed++;
            results.errors.push({
              row: rowNumber,
              message: error.message
            });
            logger.error(`导入失败 - 行${rowNumber}: ${error.message}`);
          }
        })
        .on('end', async () => {
          await prisma.importExportLog.create({
            data: {
              type: 'IMPORT',
              fileName: path.basename(filePath),
              recordCount: results.total,
              successCount: results.success,
              failedCount: results.failed,
              userId
            }
          });

          logger.info(`导入完成: 总数 ${results.total}, 成功 ${results.success}, 失败 ${results.failed}`);
          resolve(results);
        })
        .on('error', (error) => {
          reject(error);
        });
    });
  }

  private parseRow(row: any, validReasons: string[]): CreateRefundInput {
    const requiredFields = ['orderNo', 'customerName', 'amount', 'reason'];
    const missingFields = requiredFields.filter(f => !row[f] && !row[this.getChineseFieldName(f)]);

    if (missingFields.length > 0) {
      throw new BadRequestError(`缺少必填字段: ${missingFields.join(', ')}`);
    }

    const amount = parseFloat(row.amount || row['退款金额']);
    if (isNaN(amount) || amount <= 0) {
      throw new BadRequestError('退款金额必须是大于0的数字');
    }

    const reason = this.parseReason(row.reason || row['退款原因'], validReasons);

    return {
      orderNo: row.orderNo || row['订单号'],
      customerName: row.customerName || row['客户姓名'],
      customerPhone: row.customerPhone || row['客户电话'],
      amount,
      currency: row.currency || row['币种'] || 'CNY',
      reason,
      reasonDetail: row.reasonDetail || row['原因详情'],
      paymentMethod: row.paymentMethod || row['支付方式'],
      bankAccount: row.bankAccount || row['银行账号'],
      bankName: row.bankName || row['银行名称'],
      bankBranch: row.bankBranch || row['开户行']
    };
  }

  private parseReason(rawReason: string, validReasons: string[]): RefundReason {
    const reasonMap: Record<string, RefundReason> = {
      '质量问题': 'QUALITY_ISSUE',
      '发错商品': 'WRONG_ITEM',
      '商品损坏': 'DAMAGED',
      '与描述不符': 'NOT_AS_DESCRIBED',
      '顾客改变主意': 'CUSTOMER_CHANGED_MIND',
      '其他': 'OTHER'
    };

    const mapped = reasonMap[rawReason.trim()];
    if (mapped) return mapped;

    if (validReasons.includes(rawReason)) {
      return rawReason as RefundReason;
    }

    return 'OTHER';
  }

  private translateReason(reason: RefundReason): string {
    const translations: Record<RefundReason, string> = {
      QUALITY_ISSUE: '质量问题',
      WRONG_ITEM: '发错商品',
      DAMAGED: '商品损坏',
      NOT_AS_DESCRIBED: '与描述不符',
      CUSTOMER_CHANGED_MIND: '顾客改变主意',
      OTHER: '其他'
    };
    return translations[reason] || reason;
  }

  private translateStatus(status: RefundStatus): string {
    const translations: Record<RefundStatus, string> = {
      DRAFT: '草稿',
      PENDING_REVIEW: '待审核',
      APPROVED: '已通过',
      PROCESSING: '处理中',
      SUCCESS: '成功',
      FAILED: '失败',
      CANCELLED: '已取消',
      REJECTED: '已拒绝'
    };
    return translations[status] || status;
  }

  private getChineseFieldName(field: string): string {
    const map: Record<string, string> = {
      orderNo: '订单号',
      customerName: '客户姓名',
      amount: '退款金额',
      reason: '退款原因'
    };
    return map[field] || field;
  }

  private getUploadsDir(): string {
    const dir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  async getImportExportLogs(
    userId: string,
    page = 1,
    limit = 20
  ): Promise<any> {
    const skip = (page - 1) * limit;

    const [total, logs] = await Promise.all([
      prisma.importExportLog.count(),
      prisma.importExportLog.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { user: true }
      })
    ]);

    return {
      data: logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }
}

export const importExportService = new ImportExportService();
