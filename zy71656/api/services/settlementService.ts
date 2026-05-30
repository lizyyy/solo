import { repository } from '../db/repository.js';
import { calculateRoyalties, formatCalculationResponse } from '../engine/royaltyCalculator.js';
import type { CalculateRoyaltyRequest, CalculateRoyaltyResponse } from '../../shared/types.js';
import { initAndSeed } from '../db/seed.js';
import { getDb, initDb } from '../db/index.js';

let dbInitialized = false;

function ensureDbInitialized(): void {
  if (!dbInitialized) {
    initDb();
    const db = getDb();
    const count = db.prepare('SELECT COUNT(*) as count FROM author').get() as { count: number };
    if (count.count === 0) {
      initAndSeed();
    }
    dbInitialized = true;
  }
}

export class SettlementService {
  constructor() {
    ensureDbInitialized();
  }

  calculateRoyalties(request: CalculateRoyaltyRequest): CalculateRoyaltyResponse {
    const { period, authorId, bookId, forceRecalculate } = request;

    if (authorId) {
      const existing = repository.getSettlementByPeriodAndAuthor(period, authorId);
      if (existing && !forceRecalculate) {
        const items = repository.getSettlementItems(existing.id);
        const exceptions = repository.getSettlementExceptions(existing.id);
        return {
          settlementId: existing.id,
          totalAmount: existing.totalAmount,
          itemCount: items.length,
          exceptionCount: exceptions.length,
          calculationLogId: existing.calculationLogId || '',
          items,
          exceptions,
        };
      }
    }

    const authors = repository.getAuthors();
    const books = repository.getBooks();
    const contracts = repository.getContracts();
    const ladders = repository.getRoyaltyLadders();
    const sales = repository.getSalesRecords(period);
    const returns = repository.getReturnRecords(period);
    const discounts = repository.getDiscountActivities();

    const result = calculateRoyalties({
      period,
      authorId,
      bookId,
      authors,
      books,
      contracts,
      ladders,
      sales,
      returns,
      discounts,
    });

    repository.saveCalculationResult(result.settlement, result.items, result.exceptions);

    return formatCalculationResponse(result);
  }

  getSettlement(settlementId: string) {
    const settlement = repository.getSettlementById(settlementId);
    if (!settlement) {
      return null;
    }
    const items = repository.getSettlementItems(settlementId);
    const exceptions = repository.getSettlementExceptions(settlementId);
    const auditLogs = repository.getAuditLogs(settlementId);

    return {
      settlement,
      items,
      exceptions,
      auditLogs,
    };
  }

  getSettlements() {
    return repository.getSettlements();
  }

  confirmException(exceptionId: string, operator: string, note?: string): void {
    repository.confirmException(exceptionId, operator, note);
  }

  lockSettlement(settlementId: string, operator: string): void {
    repository.lockSettlement(settlementId, operator);
  }

  getDashboardData() {
    const settlements = repository.getSettlements();
    const authors = repository.getAuthors();
    const books = repository.getBooks();
    const sales = repository.getSalesRecords();
    const returns = repository.getReturnRecords();

    const pendingExceptions = settlements.flatMap((s) =>
      repository.getSettlementExceptions(s.id).filter((e) => !e.isConfirmed)
    );

    const totalSettledAmount = settlements
      .filter((s) => s.status === 'LOCKED' || s.status === 'COMPLETED')
      .reduce((sum, s) => sum + s.totalAmount, 0);

    return {
      totalAuthors: authors.length,
      totalBooks: books.length,
      totalSalesRecords: sales.length,
      totalReturnRecords: returns.length,
      totalSettlements: settlements.length,
      totalSettledAmount: Math.round(totalSettledAmount * 100) / 100,
      pendingExceptions: pendingExceptions.length,
      settlements,
    };
  }

  getAuthors() {
    return repository.getAuthors();
  }

  getBooks() {
    return repository.getBooks();
  }

  getSales(period?: string) {
    return repository.getSalesRecords(period);
  }

  getReturns(period?: string) {
    return repository.getReturnRecords(period);
  }

  getContracts() {
    return repository.getContracts();
  }

  getLadders() {
    return repository.getRoyaltyLadders();
  }

  getDiscounts() {
    return repository.getDiscountActivities();
  }

  getAuditLogs(settlementId?: string) {
    return repository.getAuditLogs(settlementId);
  }
}

export const settlementService = new SettlementService();
