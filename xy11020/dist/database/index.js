"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = exports.Database = void 0;
class Database {
    constructor() {
        this.quotes = new Map();
        this.changeRecords = new Map();
    }
    static getInstance() {
        if (!Database.instance) {
            Database.instance = new Database();
        }
        return Database.instance;
    }
    getQuoteById(id) {
        return this.quotes.get(id);
    }
    getQuoteByNumber(quoteNumber) {
        return Array.from(this.quotes.values()).find(q => q.quoteNumber === quoteNumber);
    }
    getAllQuotes() {
        return Array.from(this.quotes.values());
    }
    addQuote(quote) {
        this.quotes.set(quote.id, quote);
    }
    updateQuote(id, quote) {
        this.quotes.set(id, quote);
    }
    getChangeRecordsByQuoteId(quoteId) {
        return Array.from(this.changeRecords.values()).filter(r => r.quoteId === quoteId);
    }
    addChangeRecord(record) {
        this.changeRecords.set(record.id, record);
    }
    updateChangeRecord(id, record) {
        this.changeRecords.set(id, record);
    }
    clear() {
        this.quotes.clear();
        this.changeRecords.clear();
    }
}
exports.Database = Database;
exports.db = Database.getInstance();
