import * as XLSX from 'xlsx';
import type { SettlementItem, SettlementException, ExportRequest, ExportResponse } from '../../shared/types.js';
import { EXPORT_FIELD_MAPPING, PROCESSING_NOTE_TEMPLATE, DEFAULT_LADDER_PHYSICAL, DEFAULT_LADDER_EBOOK, DEFAULT_LADDER_DISCOUNT, CHANNEL_MAPPING } from '../../shared/constants.js';
import { PRODUCT_TYPE_LABELS, EXCEPTION_TYPE_LABELS } from '../../shared/types.js';
import { repository } from '../db/repository.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dayjs from 'dayjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EXPORT_DIR = path.join(__dirname, '../../exports');

function ensureExportDir(): void {
  if (!fs.existsSync(EXPORT_DIR)) {
    fs.mkdirSync(EXPORT_DIR, { recursive: true });
  }
}

function formatLadderDescription(ladders: { minVolume: number; maxVolume?: number; rate: number }[]): string {
  return ladders.map((l) => `${l.minVolume}${l.maxVolume ? `-${l.maxVolume}` : '+'}册 ${(l.rate * 100).toFixed(1)}%`).join('、');
}

function generateProcessingNote(
  settlementId: string,
  period: string,
  items: SettlementItem[],
  exceptions: SettlementException[],
  includeRawData: boolean
): string {
  const confirmedCount = exceptions.filter((e) => e.isConfirmed).length;
  const pendingCount = exceptions.length - confirmedCount;
  const exceptionTypes = [...new Set(exceptions.map((e) => EXCEPTION_TYPE_LABELS[e.type]))].join('、');

  const channelMappingNote = Object.entries(CHANNEL_MAPPING)
    .filter(([key]) => key !== '其他' && key !== 'OTHER')
    .map(([original, normalized]) => `${original}→${normalized}`)
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .join('、');

  const salesDateRange = items.length > 0
    ? dayjs(items[0].calculationTrail.timestamp).format('YYYY-MM-DD')
    : '无数据';

  const specialNotes: string[] = [];
  if (items.some((i) => i.ladderTier > 1)) {
    specialNotes.push('- 部分销量跨阶梯计算，已按分段规则处理');
  }
  if (exceptions.some((e) => e.type === 'LATE_RETURN')) {
    specialNotes.push('- 存在逾期退货，已标记异常并纳入计算');
  }
  if (exceptions.some((e) => e.type === 'DUPLICATE_CHANNEL')) {
    specialNotes.push('- 渠道名称不统一，已自动归并处理');
  }
  if (exceptions.some((e) => e.type === 'DIRTY_DATA')) {
    specialNotes.push('- 存在脏数据记录，已标记待人工确认');
  }
  if (includeRawData) {
    specialNotes.push('- 本次导出包含原始数据字段');
  }

  return PROCESSING_NOTE_TEMPLATE
    .replace('{physicalLadders}', formatLadderDescription(DEFAULT_LADDER_PHYSICAL))
    .replace('{ebookLadders}', formatLadderDescription(DEFAULT_LADDER_EBOOK))
    .replace('{discountRate}', (DEFAULT_LADDER_DISCOUNT[0].rate * 100).toFixed(1))
    .replace('{channelMappingNote}', channelMappingNote)
    .replace('{period}', period)
    .replace('{salesDateRange}', `${period}-01 至 ${period}-${dayjs(period + '-01').daysInMonth()}`)
    .replace('{returnDateRange}', `${period}-01 至 ${period}-${dayjs(period + '-01').daysInMonth()}`)
    .replace('{exceptionCount}', String(exceptions.length))
    .replace('{confirmedCount}', String(confirmedCount))
    .replace('{pendingCount}', String(pendingCount))
    .replace('{exceptionTypes}', exceptionTypes || '无')
    .replace('{specialNotes}', specialNotes.length > 0 ? specialNotes.join('\n') : '- 无特殊说明')
    .replace('{generatedAt}', dayjs().format('YYYY-MM-DD HH:mm:ss'));
}

function flattenItems(items: SettlementItem[], includeTrail: boolean, includeRawData: boolean): any[] {
  return items.map((item) => {
    const base: any = {
      bookName: item.bookName,
      authorName: item.authorName,
      productType: PRODUCT_TYPE_LABELS[item.productType],
      channel: item.channel,
      salesVolume: item.salesVolume,
      salesAmount: item.salesAmount,
      returnVolume: item.returnVolume,
      returnAmount: item.returnAmount,
      netSalesVolume: item.netSalesVolume,
      ladderTier: `第${item.ladderTier}档`,
      ladderRange: item.ladderRange,
      royaltyRate: `${(item.royaltyRate * 100).toFixed(2)}%`,
      royaltyAmount: item.royaltyAmount,
    };

    if (includeTrail && item.calculationTrail) {
      base.calculationFormula = item.calculationTrail.formula;
      base.calculationSteps = item.calculationTrail.steps
        .map((s) => `${s.order}. ${s.description}: ${s.rule}`)
        .join(' | ');
      base.calculationInputs = JSON.stringify(item.calculationTrail.inputs);
    }

    if (includeRawData && item.calculationTrail) {
      base.rawInputs = JSON.stringify(item.calculationTrail.inputs);
      base.rawSteps = JSON.stringify(item.calculationTrail.steps);
    }

    return base;
  });
}

export class ExportService {
  exportSettlement(request: ExportRequest): ExportResponse {
    const { settlementId, format, includeTrail, includeRawData, customFields } = request;
    ensureExportDir();

    const settlement = repository.getSettlementById(settlementId);
    if (!settlement) {
      throw new Error(`Settlement ${settlementId} not found`);
    }

    const items = repository.getSettlementItems(settlementId);
    const exceptions = repository.getSettlementExceptions(settlementId);
    const author = repository.getAuthorById(settlement.authorId);

    const processingNote = generateProcessingNote(
      settlementId,
      settlement.period,
      items,
      exceptions,
      includeRawData
    );

    const flattenedItems = flattenItems(items, includeTrail, includeRawData);

    let exportData: any;
    let filename: string;
    let buffer: Buffer;

    const timestamp = dayjs().format('YYYYMMDD_HHmmss');
    const authorName = author?.name || 'unknown';

    if (format === 'EXCEL') {
      filename = `版税结算_${settlement.period}_${authorName}_${timestamp}.xlsx`;

      const wb = XLSX.utils.book_new();

      const noteSheetData = processingNote.split('\n').map((line) => ({ 说明: line }));
      const noteSheet = XLSX.utils.json_to_sheet(noteSheetData);
      XLSX.utils.book_append_sheet(wb, noteSheet, '处理口径说明');

      const renamedItems = flattenedItems.map((item) => {
        const renamed: any = {};
        for (const [key, value] of Object.entries(item)) {
          renamed[EXPORT_FIELD_MAPPING[key] || key] = value;
        }
        return renamed;
      });
      const dataSheet = XLSX.utils.json_to_sheet(renamedItems);
      XLSX.utils.book_append_sheet(wb, dataSheet, '结算明细');

      const exceptionsData = exceptions.map((e) => ({
        异常类型: EXCEPTION_TYPE_LABELS[e.type],
        严重程度: e.severity,
        异常描述: e.message,
        是否已确认: e.isConfirmed ? '是' : '否',
        确认人: e.confirmedBy || '',
        确认时间: e.confirmedAt || '',
        确认备注: e.confirmationNote || '',
        原始数据: JSON.stringify(e.rawData),
      }));
      if (exceptionsData.length > 0) {
        const exSheet = XLSX.utils.json_to_sheet(exceptionsData);
        XLSX.utils.book_append_sheet(wb, exSheet, '异常记录');
      }

      if (includeTrail) {
        const trailData = items.flatMap((item) =>
          item.calculationTrail?.steps.map((s) => ({
            图书: item.bookName,
            渠道: item.channel,
            步骤: s.order,
            操作: s.description,
            计算公式: s.rule,
            输入值: s.input,
            输出值: s.output,
          })) || []
        );
        if (trailData.length > 0) {
          const trailSheet = XLSX.utils.json_to_sheet(trailData);
          XLSX.utils.book_append_sheet(wb, trailSheet, '计算轨迹');
        }
      }

      buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    } else {
      filename = `版税结算_${settlement.period}_${authorName}_${timestamp}.csv`;

      let csvContent = '\ufeff';
      csvContent += '=== 处理口径说明 ===\n';
      csvContent += processingNote + '\n\n';
      csvContent += '=== 结算明细 ===\n';

      const headers = Object.keys(EXPORT_FIELD_MAPPING).map((k) => EXPORT_FIELD_MAPPING[k]);
      csvContent += headers.join(',') + '\n';

      for (const item of flattenedItems) {
        const row = Object.keys(EXPORT_FIELD_MAPPING).map((k) => {
          const value = item[k];
          return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
        });
        csvContent += row.join(',') + '\n';
      }

      if (exceptions.length > 0) {
        csvContent += '\n=== 异常记录 ===\n';
        csvContent += '异常类型,严重程度,异常描述,是否确认,确认人,确认时间,确认备注\n';
        for (const e of exceptions) {
          csvContent += `${EXCEPTION_TYPE_LABELS[e.type]},${e.severity},"${e.message}",${e.isConfirmed ? '是' : '否'},${e.confirmedBy || ''},${e.confirmedAt || ''},"${e.confirmationNote || ''}"\n`;
        }
      }

      buffer = Buffer.from(csvContent, 'utf-8');
    }

    const filepath = path.join(EXPORT_DIR, filename);
    fs.writeFileSync(filepath, buffer);

    return {
      downloadUrl: `/api/exports/${filename}`,
      filename,
      fileSize: buffer.length,
      processingNote,
    };
  }

  getExportFilePath(filename: string): string {
    const filepath = path.join(EXPORT_DIR, filename);
    if (!fs.existsSync(filepath)) {
      throw new Error(`File ${filename} not found`);
    }
    return filepath;
  }
}

export const exportService = new ExportService();
