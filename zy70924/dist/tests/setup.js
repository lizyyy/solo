"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sqlite3_1 = __importDefault(require("sqlite3"));
beforeAll(async () => {
    const db = new sqlite3_1.default.Database(':memory:');
    await new Promise((resolve) => {
        db.serialize(() => {
            db.run(`
        CREATE TABLE IF NOT EXISTS batches (
          id TEXT PRIMARY KEY,
          course_name TEXT NOT NULL,
          course_code TEXT NOT NULL,
          batch_number TEXT NOT NULL,
          start_date TEXT NOT NULL,
          end_date TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          total_students INTEGER DEFAULT 0,
          created_by TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);
        });
        resolve();
    });
    db.close();
});
