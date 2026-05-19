"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorRepo = exports.sessionRepo = exports.bookRepo = exports.closeDb = exports.getDb = void 0;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path_1 = __importDefault(require("path"));
const schema_1 = require("./schema");
const DB_PATH = path_1.default.join(process.cwd(), 'book-library.db');
let db = null;
const getDb = () => {
    if (!db) {
        db = new better_sqlite3_1.default(DB_PATH);
        (0, schema_1.initSchema)(db);
    }
    return db;
};
exports.getDb = getDb;
const closeDb = () => {
    if (db) {
        db.close();
        db = null;
    }
};
exports.closeDb = closeDb;
exports.bookRepo = {
    insert: (book) => {
        const db = (0, exports.getDb)();
        const stmt = db.prepare(`
      INSERT INTO books (session_id, isbn, title, condition, grade, donor, volunteer, scanned_at, status, notes)
      VALUES (@session_id, @isbn, @title, @condition, @grade, @donor, @volunteer, @scanned_at, @status, @notes)
    `);
        const result = stmt.run(book);
        return Number(result.lastInsertRowid);
    },
    updateStatus: (id, status, notes) => {
        const db = (0, exports.getDb)();
        const stmt = db.prepare(`
      UPDATE books 
      SET status = ?, notes = COALESCE(?, notes), updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
        stmt.run(status, notes, id);
    },
    findById: (id) => {
        const db = (0, exports.getDb)();
        return db.prepare('SELECT * FROM books WHERE id = ?').get(id);
    },
    findAll: (filters) => {
        const db = (0, exports.getDb)();
        let query = 'SELECT * FROM books WHERE 1=1';
        const params = [];
        if (filters?.volunteer) {
            query += ' AND volunteer = ?';
            params.push(filters.volunteer);
        }
        if (filters?.status) {
            query += ' AND status = ?';
            params.push(filters.status);
        }
        if (filters?.startDate) {
            query += ' AND created_at >= ?';
            params.push(filters.startDate);
        }
        if (filters?.endDate) {
            query += ' AND created_at <= ?';
            params.push(filters.endDate);
        }
        query += ' ORDER BY created_at DESC';
        return db.prepare(query).all(...params);
    },
    existsByIsbn: (isbn) => {
        const db = (0, exports.getDb)();
        const result = db.prepare('SELECT 1 FROM books WHERE isbn = ? LIMIT 1').get(isbn);
        return !!result;
    }
};
exports.sessionRepo = {
    insert: (session) => {
        const db = (0, exports.getDb)();
        const stmt = db.prepare(`
      INSERT INTO import_sessions (source_type, source_file, volunteer, total_records, success_count, error_count)
      VALUES (@source_type, @source_file, @volunteer, @total_records, @success_count, @error_count)
    `);
        const result = stmt.run(session);
        return Number(result.lastInsertRowid);
    },
    updateCounts: (id, successCount, errorCount) => {
        const db = (0, exports.getDb)();
        const stmt = db.prepare(`
      UPDATE import_sessions 
      SET success_count = ?, error_count = ?
      WHERE id = ?
    `);
        stmt.run(successCount, errorCount, id);
    },
    findAll: () => {
        const db = (0, exports.getDb)();
        return db.prepare('SELECT * FROM import_sessions ORDER BY imported_at DESC').all();
    }
};
exports.errorRepo = {
    insert: (error) => {
        const db = (0, exports.getDb)();
        const stmt = db.prepare(`
      INSERT INTO error_records (session_id, source_file, row_number, raw_data, error_type, error_message, suggestion, volunteer)
      VALUES (@session_id, @source_file, @row_number, @raw_data, @error_type, @error_message, @suggestion, @volunteer)
    `);
        const result = stmt.run(error);
        return Number(result.lastInsertRowid);
    },
    markResolved: (id) => {
        const db = (0, exports.getDb)();
        const stmt = db.prepare(`
      UPDATE error_records 
      SET resolved = 1, resolved_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
        stmt.run(id);
    },
    findAll: (filters) => {
        const db = (0, exports.getDb)();
        let query = 'SELECT * FROM error_records WHERE 1=1';
        const params = [];
        if (filters?.type) {
            query += ' AND error_type = ?';
            params.push(filters.type);
        }
        if (filters?.resolved !== undefined) {
            query += ' AND resolved = ?';
            params.push(filters.resolved ? 1 : 0);
        }
        if (filters?.volunteer) {
            query += ' AND volunteer = ?';
            params.push(filters.volunteer);
        }
        query += ' ORDER BY created_at DESC';
        return db.prepare(query).all(...params);
    }
};
