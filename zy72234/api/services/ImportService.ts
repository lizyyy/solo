import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { z } from 'zod';
import { AdjustmentRepo } from '../db/repositories/AdjustmentRepo.js';
import { isZeroReversed } from '../../shared/types.js';
import type { TailAdjustment, ImportResult, AdjustmentStatus } from '../../shared/types.js';

const ImportRowSchema = z.object({
  tradeDate: z.string().min(1, '交易日期不能为空'),
  adjustmentNo: z.string().min(1, '调整单号不能为空'),
  amount: z.union([z.number(), z.string().transform(Number)]),
  remark: z.string().default(''),
});

export const ImportService = {
  parseCsv(content: string): Array<z.infer<typeof ImportRowSchema>> {
    const result = Papa.parse<Record<string, string>>(content, {
      header: true,
      skipEmptyLines: true,
    }) as { data: Record<string, string>[]; errors: Array<{ message: string }> };

    if (result.errors.length > 0) {
      throw new Error(`CSV解析错误: ${result.errors.map(e => e.message).join(', ')}`);
    }

    return result.data.map((row, index) => {
      const normalizedRow: Record<string, string> = {};
      for (const key of Object.keys(row)) {
        normalizedRow[key.trim()] = row[key].trim();
      }

      const validated = ImportRowSchema.safeParse(normalizedRow);
      if (!validated.success) {
        throw new Error(`第${index + 2}行数据错误: ${validated.error.errors.map(e => e.message).join(', ')}`);
      }
      return validated.data;
    });
  },

  parseExcel(buffer: Buffer): Array<z.infer<typeof ImportRowSchema>> {
    const workbook = XLSX.read(buffer);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' });

    return data.map((row, index) => {
      const validated = ImportRowSchema.safeParse(row);
      if (!validated.success) {
        throw new Error(`第${index + 2}行数据错误: ${validated.error.errors.map(e => e.message).join(', ')}`);
      }
      return validated.data;
    });
  },

  processImport(
    rows: Array<z.infer<typeof ImportRowSchema>>,
    operator: string = '小周'
  ): ImportResult {
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const importedItems: TailAdjustment[] = [];
    let flaggedCount = 0;

    for (const row of rows) {
      const hasZeroAmountButReversed = isZeroReversed(row.amount, row.remark);
      
      let status: AdjustmentStatus = 'imported';
      let action = '导入正常调整记录';

      if (hasZeroAmountButReversed) {
        flaggedCount++;
        status = 'pending_custody';
        action = '导入尾差调整条，系统检测金额为0且备注已冲正，待补托管确认页';
      }

      const adjustment = AdjustmentRepo.create({
        tradeDate: row.tradeDate,
        adjustmentNo: row.adjustmentNo,
        amount: row.amount,
        remark: row.remark,
        hasZeroAmountButReversed,
        status,
        importTime: now,
        importOperator: operator,
      });

      importedItems.push(adjustment);
    }

    return {
      total: importedItems.length,
      flagged: flaggedCount,
      items: importedItems,
    };
  },

  importFromCsv(content: string, operator?: string): ImportResult {
    const rows = this.parseCsv(content);
    return this.processImport(rows, operator);
  },

  importFromExcel(buffer: Buffer, operator?: string): ImportResult {
    const rows = this.parseExcel(buffer);
    return this.processImport(rows, operator);
  },
};
