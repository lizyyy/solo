import type {
  SalesRecord,
  ReturnRecord,
  SettlementException,
  ExceptionType,
  ExceptionSeverity,
  Book,
  Contract,
} from '../../shared/types.js';
import { v4 as uuidv4 } from 'uuid';
import { checkIsLateReturn } from './returnRollback.js';
import { normalizeChannel, detectDuplicateChannels } from './channelMerge.js';

export interface DetectionResult {
  exceptions: SettlementException[];
  cleanSales: SalesRecord[];
  cleanReturns: ReturnRecord[];
}

function createException(
  settlementId: string,
  type: ExceptionType,
  severity: ExceptionSeverity,
  message: string,
  rawData: Record<string, any>,
  settlementItemId?: string,
  autoOverridable: boolean = true
): SettlementException {
  return {
    id: uuidv4(),
    settlementId,
    settlementItemId,
    type,
    severity,
    message,
    rawData,
    isConfirmed: false,
    autoOverridable,
    createdAt: new Date().toISOString(),
  };
}

export function detectDirtyData(
  sales: SalesRecord[],
  settlementId: string,
  books: Book[],
  contracts: Contract[]
): SettlementException[] {
  const exceptions: SettlementException[] = [];
  const bookIds = new Set(books.map((b) => b.id));
  const contractBookIds = new Set(contracts.map((c) => c.bookId));

  for (const sale of sales) {
    if (sale.isDirty) {
      exceptions.push(
        createException(
          settlementId,
          'DIRTY_DATA',
          'WARNING',
          `销售记录 ${sale.id} 被标记为脏数据：${sale.rawData || '原因未注明'}`,
          {
            saleId: sale.id,
            bookId: sale.bookId,
            quantity: sale.quantity,
            unitPrice: sale.unitPrice,
            totalAmount: sale.totalAmount,
            rawData: sale.rawData,
            channel: sale.channel,
            saleDate: sale.saleDate,
          },
          undefined,
          false
        )
      );
    }

    if (!bookIds.has(sale.bookId)) {
      exceptions.push(
        createException(
          settlementId,
          'DIRTY_DATA',
          'ERROR',
          `销售记录 ${sale.id} 关联的图书 ${sale.bookId} 不存在`,
          {
            saleId: sale.id,
            bookId: sale.bookId,
            quantity: sale.quantity,
            channel: sale.channel,
          },
          undefined,
          false
        )
      );
    }

    if (bookIds.has(sale.bookId) && !contractBookIds.has(sale.bookId)) {
      exceptions.push(
        createException(
          settlementId,
          'MISSING_CONTRACT',
          'ERROR',
          `图书 ${sale.bookId} 没有对应的有效合同`,
          {
            saleId: sale.id,
            bookId: sale.bookId,
            quantity: sale.quantity,
            channel: sale.channel,
          },
          undefined,
          false
        )
      );
    }

    if (sale.quantity < 0) {
      exceptions.push(
        createException(
          settlementId,
          'NEGATIVE_SALES',
          'ERROR',
          `销售记录 ${sale.id} 销量为负数：${sale.quantity}`,
          {
            saleId: sale.id,
            bookId: sale.bookId,
            quantity: sale.quantity,
            rawData: sale.rawData,
          },
          undefined,
          false
        )
      );
    }

    if (sale.totalAmount !== sale.quantity * sale.unitPrice) {
      exceptions.push(
        createException(
          settlementId,
          'DIRTY_DATA',
          'WARNING',
          `销售记录 ${sale.id} 金额不一致：${sale.quantity} × ${sale.unitPrice} = ${sale.quantity * sale.unitPrice} ≠ ${sale.totalAmount}`,
          {
            saleId: sale.id,
            bookId: sale.bookId,
            quantity: sale.quantity,
            unitPrice: sale.unitPrice,
            expectedAmount: sale.quantity * sale.unitPrice,
            actualAmount: sale.totalAmount,
            diff: sale.totalAmount - sale.quantity * sale.unitPrice,
          },
          undefined,
          true
        )
      );
    }
  }

  return exceptions;
}

export function detectLateReturns(
  returns: ReturnRecord[],
  sales: SalesRecord[],
  settlementId: string
): SettlementException[] {
  const exceptions: SettlementException[] = [];
  const salesMap = new Map(sales.map((s) => [s.id, s]));

  for (const ret of returns) {
    if (ret.isLate) {
      const sale = ret.originalSaleId ? salesMap.get(ret.originalSaleId) : undefined;
      exceptions.push(
        createException(
          settlementId,
          'LATE_RETURN',
          'WARNING',
          `退货 ${ret.id} 为逾期退货${sale ? `，对应销售单 ${ret.originalSaleId}（${sale.saleDate}）` : '，无法追溯原销售单'}`,
          {
            returnId: ret.id,
            originalSaleId: ret.originalSaleId,
            bookId: ret.bookId,
            returnDate: ret.returnDate,
            saleDate: sale?.saleDate,
            quantity: ret.quantity,
            amount: ret.amount,
            reason: ret.reason,
          },
          undefined,
          true
        )
      );
    } else if (ret.originalSaleId) {
      const sale = salesMap.get(ret.originalSaleId);
      if (sale && checkIsLateReturn(ret.returnDate, sale.saleDate)) {
        exceptions.push(
          createException(
            settlementId,
            'LATE_RETURN',
            'WARNING',
            `退货 ${ret.id} 逾期：销售日期 ${sale.saleDate}，退货日期 ${ret.returnDate}，间隔超过90天`,
            {
              returnId: ret.id,
              originalSaleId: ret.originalSaleId,
              bookId: ret.bookId,
              returnDate: ret.returnDate,
              saleDate: sale.saleDate,
              daysBetween: Math.floor(
                (new Date(ret.returnDate).getTime() - new Date(sale.saleDate).getTime()) / (1000 * 60 * 60 * 24)
              ),
              quantity: ret.quantity,
              amount: ret.amount,
            },
            undefined,
            true
          )
        );
      }
    }
  }

  return exceptions;
}

export function detectDuplicateChannelRecords(
  sales: SalesRecord[],
  settlementId: string
): SettlementException[] {
  const exceptions: SettlementException[] = [];
  const channels = sales.map((s) => s.channel);
  const duplicates = detectDuplicateChannels(channels);

  const seenGroups = new Set<string>();

  for (const dup of duplicates) {
    const normalized = dup.normalized;
    if (!seenGroups.has(normalized)) {
      seenGroups.add(normalized);

      const relatedSales = sales.filter((s) => normalizeChannel(s.channel) === normalized);
      const originalChannels = [...new Set(relatedSales.map((s => s.channel)))];

      if (originalChannels.length > 1) {
        exceptions.push(
          createException(
            settlementId,
            'DUPLICATE_CHANNEL',
            'INFO',
            `渠道名称不统一：${originalChannels.join('、')}，已自动归并为"${normalized}"`,
            {
              normalizedChannel: normalized,
              originalChannels,
              relatedSaleIds: relatedSales.map((s) => s.id),
              totalQuantity: relatedSales.reduce((sum, s) => sum + s.quantity, 0),
              totalAmount: relatedSales.reduce((sum, s) => sum + s.totalAmount, 0),
            },
            undefined,
            true
          )
        );
      }
    }
  }

  return exceptions;
}

export function detectLadderCrossing(
  netSalesVolume: number,
  bookId: string,
  settlementId: string,
  settlementItemId: string,
  ladders: { minVolume: number; maxVolume?: number; rate: number }[]
): SettlementException | null {
  let tierCount = 0;
  for (const ladder of ladders) {
    if (netSalesVolume >= ladder.minVolume) {
      tierCount++;
    }
  }

  if (tierCount > 1) {
    const crossedTiers = ladders.filter((l) => netSalesVolume >= l.minVolume);
    return createException(
      settlementId,
      'LADDER_CROSSING',
      'INFO',
      `销量 ${netSalesVolume} 册跨 ${tierCount} 档阶梯，已按分段规则计算`,
      {
        bookId,
        netSalesVolume,
        tierCount,
        crossedTiers: crossedTiers.map((l, i) => ({
          tier: i + 1,
          range: `${l.minVolume}${l.maxVolume ? `-${l.maxVolume}` : '+'}`,
          rate: l.rate,
        })),
      },
      settlementItemId,
      true
    );
  }

  return null;
}

export function detectAllExceptions(
  sales: SalesRecord[],
  returns: ReturnRecord[],
  settlementId: string,
  books: Book[],
  contracts: Contract[]
): DetectionResult {
  const exceptions: SettlementException[] = [];

  exceptions.push(...detectDirtyData(sales, settlementId, books, contracts));
  exceptions.push(...detectLateReturns(returns, sales, settlementId));
  exceptions.push(...detectDuplicateChannelRecords(sales, settlementId));

  const cleanSales = sales.filter((s) => !s.isDirty && s.quantity >= 0);
  const cleanReturns = returns;

  return {
    exceptions,
    cleanSales,
    cleanReturns,
  };
}
