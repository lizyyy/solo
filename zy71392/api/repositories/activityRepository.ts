import db from '../db/init.js';
import type { Activity } from '../types/index.js';

class ActivityRepository {
  create(type: string, description: string, metadata?: Record<string, unknown>): Activity {
    const stmt = db.prepare('INSERT INTO activity (type, description, metadata_json) VALUES (?, ?, ?)');
    const result = stmt.run(type, description, metadata ? JSON.stringify(metadata) : null);
    return db.prepare('SELECT * FROM activity WHERE id = ?').get(result.lastInsertRowid) as Activity;
  }

  list(limit = 20): Activity[] {
    return db.prepare('SELECT * FROM activity ORDER BY created_at DESC LIMIT ?').all(limit) as Activity[];
  }
}

export default new ActivityRepository();
