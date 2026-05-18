import { RepairQuote, QuoteChangeRecord } from '../types';

export class Database {
  private static instance: Database;
  public quotes: Map<string, RepairQuote> = new Map();
  public changeRecords: Map<string, QuoteChangeRecord> = new Map();

  private constructor() {}

  static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  getQuoteById(id: string): RepairQuote | undefined {
    return this.quotes.get(id);
  }

  getQuoteByNumber(quoteNumber: string): RepairQuote | undefined {
    return Array.from(this.quotes.values()).find(q => q.quoteNumber === quoteNumber);
  }

  getAllQuotes(): RepairQuote[] {
    return Array.from(this.quotes.values());
  }

  addQuote(quote: RepairQuote): void {
    this.quotes.set(quote.id, quote);
  }

  updateQuote(id: string, quote: RepairQuote): void {
    this.quotes.set(id, quote);
  }

  getChangeRecordsByQuoteId(quoteId: string): QuoteChangeRecord[] {
    return Array.from(this.changeRecords.values()).filter(r => r.quoteId === quoteId);
  }

  addChangeRecord(record: QuoteChangeRecord): void {
    this.changeRecords.set(record.id, record);
  }

  updateChangeRecord(id: string, record: QuoteChangeRecord): void {
    this.changeRecords.set(id, record);
  }

  clear(): void {
    this.quotes.clear();
    this.changeRecords.clear();
  }
}

export const db = Database.getInstance();
