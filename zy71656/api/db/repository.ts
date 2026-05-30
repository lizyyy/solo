import { getDb } from './index.js';
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
  AuditLog,
} from '../../shared/types.js';

export class Repository {
  private db = getDb();

  getAuthors(): Author[] {
    return this.db.prepare('SELECT * FROM author').all() as Author[];
  }

  getAuthorById(id: string): Author | undefined {
    return this.db.prepare('SELECT * FROM author WHERE id = ?').get(id) as Author | undefined;
  }

  getBooks(): Book[] {
    return this.db.prepare('SELECT * FROM book').all() as Book[];
  }

  getBookById(id: string): Book | undefined {
    return this.db.prepare('SELECT * FROM book WHERE id = ?').get(id) as Book | undefined;
  }

  getBooksByAuthor(authorId: string): Book[] {
    return this.db.prepare('SELECT * FROM book WHERE author_id = ?').all(authorId) as Book[];
  }

  getContracts(): Contract[] {
    return this.db.prepare('SELECT * FROM contract').all() as Contract[];
  }

  getContractById(id: string): Contract | undefined {
    return this.db.prepare('SELECT * FROM contract WHERE id = ?').get(id) as Contract | undefined;
  }

  getContractsByAuthor(authorId: string): Contract[] {
    return this.db.prepare('SELECT * FROM contract WHERE author_id = ?').all(authorId) as Contract[];
  }

  getRoyaltyLadders(): RoyaltyLadder[] {
    return this.db.prepare('SELECT * FROM royalty_ladder').all() as RoyaltyLadder[];
  }

  getRoyaltyLaddersByContract(contractId: string): RoyaltyLadder[] {
    return this.db.prepare('SELECT * FROM royalty_ladder WHERE contract_id = ?').all(contractId) as RoyaltyLadder[];
  }

  getSalesRecords(period?: string, bookId?: string): SalesRecord[] {
    let sql = 'SELECT * FROM sales_record WHERE 1=1';
    const params: any[] = [];

    if (period) {
      sql += ' AND sale_date LIKE ?';
      params.push(period + '%');
    }
    if (bookId) {
      sql += ' AND book_id = ?';
      params.push(bookId);
    }
    sql += ' ORDER BY sale_date DESC';

    return this.db.prepare(sql).all(...params) as SalesRecord[];
  }

  getReturnRecords(period?: string, bookId?: string): ReturnRecord[] {
    let sql = 'SELECT * FROM return_record WHERE 1=1';
    const params: any[] = [];

    if (period) {
      sql += ' AND settlement_period = ?';
      params.push(period);
    }
    if (bookId) {
      sql += ' AND book_id = ?';
      params.push(bookId);
    }
    sql += ' ORDER BY return_date DESC';

    return this.db.prepare(sql).all(...params) as ReturnRecord[];
  }

  getDiscountActivities(): DiscountActivity[] {
    return this.db.prepare('SELECT * FROM discount_activity ORDER BY start_date DESC').all() as DiscountActivity[];
  }

  getSettlements(): Settlement[] {
    return this.db.prepare('SELECT * FROM settlement ORDER BY created_at DESC').all() as Settlement[];
  }

  getSettlementById(id: string): Settlement | undefined {
    return this.db.prepare('SELECT * FROM settlement WHERE id = ?').get(id) as Settlement | undefined;
  }

  getSettlementByPeriodAndAuthor(period: string, authorId: string): Settlement | undefined {
    return this.db.prepare('SELECT * FROM settlement WHERE period = ? AND author_id = ?').get(period, authorId) as Settlement | undefined;
  }

  getSettlementItems(settlementId: string): SettlementItem[] {
    const items = this.db.prepare(`
      SELECT si.*, b.title as bookName, a.name as authorName
      FROM settlement_item si
      JOIN book b ON si.book_id = b.id
      JOIN author a ON b.author_id = a.id
      WHERE si.settlement_id = ?
    `).all(settlementId) as any[];

    return items.map((item) => {
      const trail = this.db.prepare('SELECT * FROM calculation_trail WHERE settlement_item_id = ?').get(item.id) as any;
      return {
        ...item,
        calculationTrail: trail ? {
          steps: JSON.parse(trail.steps),
          formula: trail.formula,
          inputs: JSON.parse(trail.inputs),
          timestamp: trail.timestamp,
        } : undefined,
      };
    }) as SettlementItem[];
  }

  getSettlementExceptions(settlementId: string): SettlementException[] {
    const exceptions = this.db.prepare(`
      SELECT * FROM settlement_exception WHERE settlement_id = ?
    `).all(settlementId) as any[];

    return exceptions.map((e) => ({
      ...e,
      isConfirmed: e.is_confirmed === 1,
      autoOverridable: e.auto_overridable === 1,
      rawData: e.raw_data ? JSON.parse(e.raw_data) : {},
    })) as SettlementException[];
  }

  saveCalculationResult(
    settlement: Settlement,
    items: SettlementItem[],
    exceptions: SettlementException[]
  ): void {
    const tx = this.db.transaction(() => {
      const insertSettlement = this.db.prepare(`
        INSERT OR REPLACE INTO settlement (id, period, author_id, created_at, locked_at, status, total_amount, created_by, locked_by, calculation_log_id)
        VALUES (@id, @period, @authorId, @createdAt, @lockedAt, @status, @totalAmount, @createdBy, @lockedBy, @calculationLogId)
      `);
      insertSettlement.run({
        ...settlement,
        authorId: settlement.authorId,
        createdAt: settlement.createdAt,
        lockedAt: settlement.lockedAt,
        totalAmount: settlement.totalAmount,
        createdBy: settlement.createdBy,
        lockedBy: settlement.lockedBy,
        calculationLogId: settlement.calculationLogId,
      });

      const insertItem = this.db.prepare(`
        INSERT OR REPLACE INTO settlement_item (id, settlement_id, book_id, product_type, channel, sales_volume, sales_amount, return_volume, return_amount, net_sales_volume, ladder_tier, ladder_range, royalty_rate, royalty_amount, calculation_trail_id)
        VALUES (@id, @settlementId, @bookId, @productType, @channel, @salesVolume, @salesAmount, @returnVolume, @returnAmount, @netSalesVolume, @ladderTier, @ladderRange, @royaltyRate, @royaltyAmount, @calculationTrailId)
      `);

      const insertTrail = this.db.prepare(`
        INSERT OR REPLACE INTO calculation_trail (id, settlement_item_id, formula, steps, inputs, timestamp)
        VALUES (@id, @settlementItemId, @formula, @steps, @inputs, @timestamp)
      `);

      const insertException = this.db.prepare(`
        INSERT OR REPLACE INTO settlement_exception (id, settlement_id, settlement_item_id, type, severity, message, raw_data, is_confirmed, confirmed_by, confirmed_at, confirmation_note, auto_overridable, created_at)
        VALUES (@id, @settlementId, @settlementItemId, @type, @severity, @message, @rawData, @isConfirmed, @confirmedBy, @confirmedAt, @confirmationNote, @autoOverridable, @createdAt)
      `);

      for (const item of items) {
        const trailId = 'trail-' + item.id;
        insertItem.run({
          ...item,
          settlementId: item.settlementId,
          bookId: item.bookId,
          productType: item.productType,
          salesVolume: item.salesVolume,
          salesAmount: item.salesAmount,
          returnVolume: item.returnVolume,
          returnAmount: item.returnAmount,
          netSalesVolume: item.netSalesVolume,
          ladderTier: item.ladderTier,
          ladderRange: item.ladderRange,
          royaltyRate: item.royaltyRate,
          royaltyAmount: item.royaltyAmount,
          calculationTrailId: trailId,
        });

        if (item.calculationTrail) {
          insertTrail.run({
            id: trailId,
            settlementItemId: item.id,
            formula: item.calculationTrail.formula,
            steps: JSON.stringify(item.calculationTrail.steps),
            inputs: JSON.stringify(item.calculationTrail.inputs),
            timestamp: item.calculationTrail.timestamp,
          });
        }
      }

      for (const exception of exceptions) {
        insertException.run({
          ...exception,
          settlementId: exception.settlementId,
          settlementItemId: exception.settlementItemId,
          rawData: JSON.stringify(exception.rawData),
          isConfirmed: exception.isConfirmed ? 1 : 0,
          confirmedBy: exception.confirmedBy,
          confirmedAt: exception.confirmedAt,
          confirmationNote: exception.confirmationNote,
          autoOverridable: exception.autoOverridable ? 1 : 0,
          createdAt: exception.createdAt,
        });
      }
    });

    tx();
  }

  confirmException(exceptionId: string, operator: string, note?: string): void {
    this.db.prepare(`
      UPDATE settlement_exception
      SET is_confirmed = 1, confirmed_by = ?, confirmed_at = ?, confirmation_note = ?
      WHERE id = ?
    `).run(operator, new Date().toISOString(), note || null, exceptionId);

    const exception = this.db.prepare('SELECT * FROM settlement_exception WHERE id = ?').get(exceptionId) as any;
    if (exception) {
      this.logAudit({
        id: 'audit-' + Date.now(),
        settlementId: exception.settlement_id,
        action: 'CONFIRM_EXCEPTION',
        operator,
        timestamp: new Date().toISOString(),
        oldValue: JSON.stringify({ isConfirmed: false }),
        newValue: JSON.stringify({ isConfirmed: true, note }),
        note: `确认异常: ${exception.id}`,
      });
    }
  }

  lockSettlement(settlementId: string, operator: string): void {
    const now = new Date().toISOString();
    const old = this.getSettlementById(settlementId);

    this.db.prepare(`
      UPDATE settlement SET status = 'LOCKED', locked_at = ?, locked_by = ? WHERE id = ?
    `).run(now, operator, settlementId);

    this.logAudit({
      id: 'audit-' + Date.now(),
      settlementId,
      action: 'LOCK_SETTLEMENT',
      operator,
      timestamp: now,
      oldValue: old ? JSON.stringify({ status: old.status, lockedAt: old.lockedAt }) : null,
      newValue: JSON.stringify({ status: 'LOCKED', lockedAt: now, lockedBy: operator }),
      note: '锁定结算数据',
    });
  }

  logAudit(log: AuditLog): void {
    this.db.prepare(`
      INSERT INTO audit_log (id, settlement_id, action, operator, timestamp, old_value, new_value, note)
      VALUES (@id, @settlementId, @action, @operator, @timestamp, @oldValue, @newValue, @note)
    `).run({
      ...log,
      settlementId: log.settlementId,
      oldValue: log.oldValue,
      newValue: log.newValue,
    });
  }

  getAuditLogs(settlementId?: string): AuditLog[] {
    let sql = 'SELECT * FROM audit_log';
    const params: any[] = [];

    if (settlementId) {
      sql += ' WHERE settlement_id = ?';
      params.push(settlementId);
    }
    sql += ' ORDER BY timestamp DESC';

    return this.db.prepare(sql).all(...params) as AuditLog[];
  }
}

export const repository = new Repository();
