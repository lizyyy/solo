import db from '../db/init.js';

class ConfigRepository {
  get(key: string): Record<string, unknown> | undefined {
    const row = db.prepare('SELECT value_json FROM config WHERE key = ?').get(key) as { value_json: string } | undefined;
    return row ? JSON.parse(row.value_json) : undefined;
  }

  set(key: string, value: Record<string, unknown>): void {
    const valueJson = JSON.stringify(value);
    const existing = db.prepare('SELECT id FROM config WHERE key = ?').get(key);
    if (existing) {
      db.prepare("UPDATE config SET value_json = ?, updated_at = datetime('now') WHERE key = ?").run(valueJson, key);
    } else {
      db.prepare('INSERT INTO config (key, value_json) VALUES (?, ?)').run(key, valueJson);
    }
  }

  list(): { key: string; value: Record<string, unknown> }[] {
    const rows = db.prepare('SELECT key, value_json FROM config').all() as { key: string; value_json: string }[];
    return rows.map(r => ({ key: r.key, value: JSON.parse(r.value_json) }));
  }
}

export default new ConfigRepository();
