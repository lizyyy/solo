import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import type {
  Author,
  Book,
  Contract,
  RoyaltyLadder,
  SalesRecord,
  ReturnRecord,
  DiscountActivity,
  Settlement,
  SettlementItem,
  SettlementException,
  CalculationTrail,
  CalculateRoyaltyResponse,
  ProductType,
} from '../../shared/types.js';
import { normalizeChannel } from './channelMerge.js';
import { calculateReturnRollback } from './returnRollback.js';
import {
  getLadderForProductType,
  calculateRoyaltyWithLadder,
  formatLadderFormula,
} from './ladderResolver.js';
import { detectAllExceptions, detectLadderCrossing } from './exceptionDetector.js';

export interface CalculationInput {
  period: string;
  author?: Author;
  authorId?: string;
  bookId?: string;
  books: Book[];
  authors: Author[];
  contracts: Contract[];
  ladders: RoyaltyLadder[];
  sales: SalesRecord[];
  returns: ReturnRecord[];
  discounts: DiscountActivity[];
}

export interface CalculationResult {
  settlement: Settlement;
  items: SettlementItem[];
  exceptions: SettlementException[];
}

function getProductTypeLabel(type: ProductType): string {
  const labels: Record<ProductType, string> = {
    PHYSICAL: '纸书',
    EBOOK: '电书',
    DISCOUNT: '活动折扣',
  };
  return labels[type];
}

function isInDiscountActivity(
  saleDate: string,
  productType: ProductType,
  discounts: DiscountActivity[]
): DiscountActivity | null {
  const saleDt = dayjs(saleDate);
  for (const discount of discounts) {
    if (discount.productType && discount.productType !== productType) continue;
    if (saleDt.isAfter(dayjs(discount.startDate).subtract(1, 'day')) &&
        saleDt.isBefore(dayjs(discount.endDate).add(1, 'day'))) {
      return discount;
    }
  }
  return null;
}

export function groupSalesByBookAndChannel(
  sales: SalesRecord[],
  returns: ReturnRecord[],
  discounts: DiscountActivity[]
): Map<string, {
  sales: SalesRecord[];
  returns: ReturnRecord[];
  productType: ProductType;
  bookId: string;
  channel: string;
}> {
  const groups = new Map<string, {
    sales: SalesRecord[];
    returns: ReturnRecord[];
    productType: ProductType;
    bookId: string;
    channel: string;
  }>();

  for (const sale of sales) {
    const normalizedChannel = normalizeChannel(sale.channel);
    const key = `${sale.bookId}-${normalizedChannel}`;
    const bookInfo = groups.get(key) || {
      sales: [],
      returns: [],
      productType: sale.bookId.includes('002') || sale.bookId.includes('004') || sale.bookId.includes('006') ? 'EBOOK' : 'PHYSICAL',
      bookId: sale.bookId,
      channel: normalizedChannel,
    };
    bookInfo.sales.push(sale);
    groups.set(key, bookInfo);
  }

  for (const ret of returns) {
    const relatedSale = sales.find((s) => s.id === ret.originalSaleId);
    const bookId = ret.bookId;
    const channel = relatedSale ? normalizeChannel(relatedSale.channel) : '其他';
    const key = `${bookId}-${channel}`;
    const group = groups.get(key);
    if (group) {
      group.returns.push(ret);
    }
  }

  return groups;
}

export function calculateRoyaltiesForGroup(
  group: {
    sales: SalesRecord[];
    returns: ReturnRecord[];
    productType: ProductType;
    bookId: string;
    channel: string;
  },
  book: Book,
  author: Author,
  contract: Contract,
  ladders: RoyaltyLadder[],
  discounts: DiscountActivity[],
  settlementId: string,
  period: string
): { item: SettlementItem; trail: CalculationTrail; exception?: SettlementException } {
  const firstSale = group.sales[0];
  const hasDiscountActivity = group.sales.some((s) =>
    isInDiscountActivity(s.saleDate, group.productType, discounts)
  );
  const discount = hasDiscountActivity ? group.sales
    .map((s) => isInDiscountActivity(s.saleDate, group.productType, discounts))
    .find(Boolean) : null;

  const rollbackResult = calculateReturnRollback(group.sales, group.returns, period);

  let royaltyLadders = getLadderForProductType(ladders, group.productType, 'STANDARD');
  let isDiscount = false;
  let adjustedRate: number | undefined;

  if (discount && discount.adjustedRate) {
    isDiscount = true;
    adjustedRate = discount.adjustedRate;
    royaltyLadders = getLadderForProductType(ladders, group.productType, 'DISCOUNT');
  }

  const ladderResult = calculateRoyaltyWithLadder(
    rollbackResult.netSalesVolume,
    rollbackResult.netSalesAmount,
    royaltyLadders,
    isDiscount,
    adjustedRate
  );

  const itemId = uuidv4();
  const trailId = uuidv4();
  const now = new Date().toISOString();

  const allSteps = [...rollbackResult.steps, ...ladderResult.steps];
  const formula = formatLadderFormula(
    group.productType,
    isDiscount ? 'DISCOUNT' : 'STANDARD',
    ladderResult.crossLadder
  );

  const inputs: Record<string, number> = {
    salesVolume: group.sales.reduce((sum, s) => sum + s.quantity, 0),
    salesAmount: group.sales.reduce((sum, s) => sum + s.totalAmount, 0),
    returnVolume: rollbackResult.returnVolume,
    returnAmount: rollbackResult.returnAmount,
    netSalesVolume: rollbackResult.netSalesVolume,
    netSalesAmount: rollbackResult.netSalesAmount,
    royaltyRate: ladderResult.rate,
    royaltyAmount: ladderResult.royaltyAmount,
  };

  const trail: CalculationTrail = {
    steps: allSteps,
    formula,
    inputs,
    timestamp: now,
  };

  const item: SettlementItem = {
    id: itemId,
    settlementId,
    bookId: group.bookId,
    bookName: book.title,
    authorId: author.id,
    authorName: author.name,
    productType: group.productType,
    channel: group.channel,
    salesVolume: group.sales.reduce((sum, s) => sum + s.quantity, 0),
    salesAmount: group.sales.reduce((sum, s) => sum + s.totalAmount, 0),
    returnVolume: rollbackResult.returnVolume,
    returnAmount: rollbackResult.returnAmount,
    netSalesVolume: rollbackResult.netSalesVolume,
    ladderTier: ladderResult.tier,
    ladderRange: ladderResult.range,
    royaltyRate: ladderResult.rate,
    royaltyAmount: ladderResult.royaltyAmount,
    calculationTrail: trail,
    hasExceptions: rollbackResult.isLate || ladderResult.crossLadder,
  };

  let exception: SettlementException | undefined;
  if (ladderResult.crossLadder) {
    exception = detectLadderCrossing(
      rollbackResult.netSalesVolume,
      group.bookId,
      settlementId,
      itemId,
      royaltyLadders
    ) || undefined;
  }

  return { item, trail, exception };
}

export function calculateRoyalties(input: CalculationInput): CalculationResult {
  const {
    period,
    authorId,
    bookId,
    books,
    authors,
    contracts,
    ladders,
    sales,
    returns,
    discounts,
  } = input;

  const settlementId = uuidv4();
  const calculationLogId = uuidv4();
  const now = new Date().toISOString();

  const { exceptions: preExceptions, cleanSales, cleanReturns } = detectAllExceptions(
    sales,
    returns,
    settlementId,
    books,
    contracts
  );

  const items: SettlementItem[] = [];
  const trails: CalculationTrail[] = [];
  const allExceptions: SettlementException[] = [...preExceptions];

  const activeContracts = contracts.filter((c) =>
    c.status === 'ACTIVE' &&
    (!authorId || c.authorId === authorId) &&
    (!bookId || c.bookId === bookId)
  );

  const authorsToProcess = authorId
    ? authors.filter((a) => a.id === authorId)
    : authors;

  let totalAmount = 0;

  for (const author of authorsToProcess) {
    const authorContracts = activeContracts.filter((c) => c.authorId === author.id);
    const authorBookIds = new Set(authorContracts.map((c) => c.bookId));

    let authorSales = cleanSales.filter((s) =>
      authorBookIds.has(s.bookId) &&
      s.saleDate.startsWith(period) &&
      (!bookId || s.bookId === bookId)
    );

    let authorReturns = cleanReturns.filter((r) =>
      authorBookIds.has(r.bookId) &&
      r.settlementPeriod === period
    );

    const authorBooks = books.filter((b) =>
      authorBookIds.has(b.id) && (!bookId || b.id === bookId)
    );

    const groups = groupSalesByBookAndChannel(authorSales, authorReturns, discounts);

    for (const [key, group] of groups) {
      const book = authorBooks.find((b) => b.id === group.bookId);
      const contract = authorContracts.find((c) => c.bookId === group.bookId);

      if (!book || !contract) {
        continue;
      }

      if (book.productType === 'EBOOK') {
        group.productType = 'EBOOK';
      } else if (book.productType === 'PHYSICAL') {
        group.productType = 'PHYSICAL';
      }

      const result = calculateRoyaltiesForGroup(
        group,
        book,
        author,
        contract,
        ladders,
        discounts,
        settlementId,
        period
      );

      items.push(result.item);
      trails.push(result.trail);
      totalAmount += result.item.royaltyAmount;

      if (result.exception) {
        allExceptions.push(result.exception);
      }
    }
  }

  const settlement: Settlement = {
    id: settlementId,
    period,
    authorId: authorId || authors[0]?.id || '',
    createdAt: now,
    status: 'DRAFT',
    totalAmount: Math.round(totalAmount * 100) / 100,
    createdBy: 'system',
    calculationLogId,
  };

  for (const item of items) {
    if (allExceptions.some((e) => e.settlementItemId === item.id)) {
      item.hasExceptions = true;
    }
  }

  return {
    settlement,
    items,
    exceptions: allExceptions,
  };
}

export function formatCalculationResponse(
  result: CalculationResult
): CalculateRoyaltyResponse {
  return {
    settlementId: result.settlement.id,
    totalAmount: result.settlement.totalAmount,
    itemCount: result.items.length,
    exceptionCount: result.exceptions.length,
    calculationLogId: result.settlement.calculationLogId || '',
    items: result.items,
    exceptions: result.exceptions,
  };
}
