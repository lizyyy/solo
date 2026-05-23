"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
exports.initDatabase = initDatabase;
exports.generateId = generateId;
exports.generateOrderNo = generateOrderNo;
exports.getCurrentTime = getCurrentTime;
const sqlite3_1 = __importDefault(require("sqlite3"));
const uuid_1 = require("uuid");
exports.db = new sqlite3_1.default.Database('./equipment_rental.db');
function initDatabase() {
    return new Promise((resolve, reject) => {
        exports.db.serialize(() => {
            exports.db.run(`PRAGMA foreign_keys = ON`);
            exports.db.run(`
        CREATE TABLE IF NOT EXISTS equipment (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          category TEXT NOT NULL,
          model TEXT,
          serial_number TEXT UNIQUE,
          status TEXT NOT NULL DEFAULT 'available',
          deposit_amount REAL NOT NULL,
          daily_rate REAL NOT NULL,
          description TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);
            exports.db.run(`
        CREATE TABLE IF NOT EXISTS accessories (
          id TEXT PRIMARY KEY,
          equipment_id TEXT NOT NULL,
          name TEXT NOT NULL,
          quantity INTEGER NOT NULL DEFAULT 1,
          status TEXT NOT NULL DEFAULT 'good',
          FOREIGN KEY (equipment_id) REFERENCES equipment(id)
        )
      `);
            exports.db.run(`
        CREATE TABLE IF NOT EXISTS rental_orders (
          id TEXT PRIMARY KEY,
          order_no TEXT UNIQUE NOT NULL,
          equipment_id TEXT NOT NULL,
          borrower_name TEXT NOT NULL,
          borrower_phone TEXT,
          borrower_id TEXT,
          expected_start_date TEXT NOT NULL,
          expected_end_date TEXT NOT NULL,
          actual_start_date TEXT,
          actual_end_date TEXT,
          deposit_paid REAL NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'pending',
          notes TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (equipment_id) REFERENCES equipment(id)
        )
      `);
            exports.db.run(`
        CREATE TABLE IF NOT EXISTS rental_accessories (
          id TEXT PRIMARY KEY,
          rental_order_id TEXT NOT NULL,
          accessory_id TEXT NOT NULL,
          expected_quantity INTEGER NOT NULL,
          returned_quantity INTEGER DEFAULT 0,
          status TEXT DEFAULT 'pending',
          FOREIGN KEY (rental_order_id) REFERENCES rental_orders(id),
          FOREIGN KEY (accessory_id) REFERENCES accessories(id)
        )
      `);
            exports.db.run(`
        CREATE TABLE IF NOT EXISTS return_inspections (
          id TEXT PRIMARY KEY,
          rental_order_id TEXT NOT NULL,
          inspector_name TEXT NOT NULL,
          inspection_date TEXT NOT NULL,
          has_scratches BOOLEAN DEFAULT false,
          scratches_description TEXT,
          has_damage BOOLEAN DEFAULT false,
          damage_description TEXT,
          accessories_complete BOOLEAN DEFAULT false,
          accessories_notes TEXT,
          overall_condition TEXT NOT NULL,
          conclusion TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          created_at TEXT NOT NULL,
          FOREIGN KEY (rental_order_id) REFERENCES rental_orders(id)
        )
      `);
            exports.db.run(`
        CREATE TABLE IF NOT EXISTS deposit_deductions (
          id TEXT PRIMARY KEY,
          rental_order_id TEXT NOT NULL,
          inspection_id TEXT,
          amount REAL NOT NULL,
          reason TEXT NOT NULL,
          requested_by TEXT NOT NULL,
          requested_at TEXT NOT NULL,
          approved_by TEXT,
          approved_at TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          notes TEXT,
          FOREIGN KEY (rental_order_id) REFERENCES rental_orders(id),
          FOREIGN KEY (inspection_id) REFERENCES return_inspections(id)
        )
      `);
            exports.db.run(`
        CREATE TABLE IF NOT EXISTS exception_logs (
          id TEXT PRIMARY KEY,
          operation_type TEXT NOT NULL,
          original_input TEXT NOT NULL,
          error_message TEXT,
          processing_conclusion TEXT,
          handled_by TEXT,
          handled_at TEXT,
          created_at TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending'
        )
      `);
            exports.db.run(`
        CREATE TABLE IF NOT EXISTS manual_corrections (
          id TEXT PRIMARY KEY,
          rental_order_id TEXT,
          correction_type TEXT NOT NULL,
          field_name TEXT,
          old_value TEXT,
          new_value TEXT,
          reason TEXT NOT NULL,
          corrected_by TEXT NOT NULL,
          corrected_at TEXT NOT NULL
        )
      `);
            resolve();
        });
    });
}
function generateId() {
    return (0, uuid_1.v4)();
}
function generateOrderNo() {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `RENT${dateStr}${random}`;
}
function getCurrentTime() {
    return new Date().toISOString();
}
