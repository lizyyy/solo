import db from '../db/init.js';
import type { Script, ApiCall, RuntimeLog, Permission, RiskScore } from '../types/index.js';

class ScriptRepository {
  create(script: Omit<Script, 'id' | 'created_at' | 'updated_at'>): Script {
    const stmt = db.prepare(
      'INSERT INTO script (name, file_type, content, cloud_platform, existing_policy_json) VALUES (?, ?, ?, ?, ?)'
    );
    const result = stmt.run(
      script.name,
      script.file_type,
      script.content,
      script.cloud_platform,
      script.existing_policy_json
    );
    return this.getById(result.lastInsertRowid as number)!;
  }

  getById(id: number): Script | undefined {
    return db.prepare('SELECT * FROM script WHERE id = ?').get(id) as Script | undefined;
  }

  list(limit = 50, offset = 0): Script[] {
    return db.prepare('SELECT * FROM script ORDER BY created_at DESC LIMIT ? OFFSET ?').all(limit, offset) as Script[];
  }

  update(id: number, updates: Partial<Script>): void {
    const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(updates), id];
    db.prepare(`UPDATE script SET ${fields}, updated_at = datetime('now') WHERE id = ?`).run(...values);
  }

  delete(id: number): void {
    db.prepare('DELETE FROM script WHERE id = ?').run(id);
  }

  count(): number {
    const result = db.prepare('SELECT COUNT(*) as count FROM script').get() as { count: number };
    return result.count;
  }

  addApiCall(call: Omit<ApiCall, 'id'>): ApiCall {
    const stmt = db.prepare(
      'INSERT INTO api_call (script_id, service, action, resource, source, line_number, context) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    const result = stmt.run(
      call.script_id,
      call.service,
      call.action,
      call.resource,
      call.source,
      call.line_number || null,
      call.context || null
    );
    return db.prepare('SELECT * FROM api_call WHERE id = ?').get(result.lastInsertRowid) as ApiCall;
  }

  getApiCalls(scriptId: number): ApiCall[] {
    return db.prepare('SELECT * FROM api_call WHERE script_id = ? ORDER BY id').all(scriptId) as ApiCall[];
  }

  clearApiCalls(scriptId: number): void {
    db.prepare('DELETE FROM api_call WHERE script_id = ?').run(scriptId);
  }

  addRuntimeLog(log: Omit<RuntimeLog, 'id' | 'captured_at'>): RuntimeLog {
    const stmt = db.prepare('INSERT INTO runtime_log (script_id, content) VALUES (?, ?)');
    const result = stmt.run(log.script_id, log.content);
    return db.prepare('SELECT * FROM runtime_log WHERE id = ?').get(result.lastInsertRowid) as RuntimeLog;
  }

  getRuntimeLogs(scriptId: number): RuntimeLog[] {
    return db.prepare('SELECT * FROM runtime_log WHERE script_id = ? ORDER BY captured_at DESC').all(scriptId) as RuntimeLog[];
  }

  addPermission(perm: Omit<Permission, 'id'>): Permission {
    const stmt = db.prepare(
      'INSERT INTO permission (script_id, service, action, type, status, reason) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const result = stmt.run(
      perm.script_id,
      perm.service,
      perm.action,
      perm.type,
      perm.status,
      perm.reason || null
    );
    return db.prepare('SELECT * FROM permission WHERE id = ?').get(result.lastInsertRowid) as Permission;
  }

  getPermissions(scriptId: number): Permission[] {
    return db.prepare('SELECT * FROM permission WHERE script_id = ? ORDER BY service, action').all(scriptId) as Permission[];
  }

  clearPermissions(scriptId: number): void {
    db.prepare('DELETE FROM permission WHERE script_id = ?').run(scriptId);
  }

  updatePermissionStatus(id: number, status: Permission['status'], reason?: string): void {
    db.prepare('UPDATE permission SET status = ?, reason = COALESCE(?, reason) WHERE id = ?').run(status, reason || null, id);
  }

  saveRiskScore(score: Omit<RiskScore, 'id' | 'calculated_at'>): RiskScore {
    const stmt = db.prepare(
      'INSERT INTO risk_score (script_id, dynamic_miss_score, wildcard_score, exception_long_score, total_score, details_json) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const result = stmt.run(
      score.script_id,
      score.dynamic_miss_score,
      score.wildcard_score,
      score.exception_long_score,
      score.total_score,
      score.details_json
    );
    return db.prepare('SELECT * FROM risk_score WHERE id = ?').get(result.lastInsertRowid) as RiskScore;
  }

  getLatestRiskScore(scriptId: number): RiskScore | undefined {
    return db.prepare('SELECT * FROM risk_score WHERE script_id = ? ORDER BY calculated_at DESC LIMIT 1').get(scriptId) as RiskScore | undefined;
  }
}

export default new ScriptRepository();
