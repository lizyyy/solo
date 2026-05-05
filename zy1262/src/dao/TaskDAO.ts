import { db } from '../database';
import { ReplayTask } from '../types';
import { v4 as uuidv4 } from 'uuid';

export class TaskDAO {
  static create(task: Omit<ReplayTask, 'id' | 'createdAt'>): ReplayTask {
    const id = uuidv4();
    const createdAt = Date.now();
    
    const stmt = db.prepare(`
      INSERT INTO replay_tasks (
        id, name, status, progress, policy_version, 
        upstream_count, request_count, health_event_count,
        created_at, started_at, completed_at, error
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id,
      task.name,
      task.status,
      task.progress,
      task.policyVersion,
      task.upstreamCount,
      task.requestCount,
      task.healthEventCount,
      createdAt,
      task.startedAt,
      task.completedAt,
      task.error
    );
    
    return {
      ...task,
      id,
      createdAt
    };
  }

  static getById(id: string): ReplayTask | null {
    const row = db.prepare('SELECT * FROM replay_tasks WHERE id = ?').get(id);
    if (!row) return null;
    return this.mapRowToTask(row as any);
  }

  static getAll(): ReplayTask[] {
    const rows = db.prepare('SELECT * FROM replay_tasks ORDER BY created_at DESC').all();
    return rows.map(row => this.mapRowToTask(row as any));
  }

  static update(id: string, updates: Partial<ReplayTask>): void {
    const allowedFields = [
      'name', 'status', 'progress', 'policy_version',
      'upstream_count', 'request_count', 'health_event_count',
      'started_at', 'completed_at', 'error'
    ];
    
    const fieldMap: Record<string, string> = {
      policyVersion: 'policy_version',
      upstreamCount: 'upstream_count',
      requestCount: 'request_count',
      healthEventCount: 'health_event_count',
      startedAt: 'started_at',
      completedAt: 'completed_at'
    };
    
    const setClauses: string[] = [];
    const values: any[] = [];
    
    for (const [key, value] of Object.entries(updates)) {
      const dbField = fieldMap[key] || key;
      if (allowedFields.includes(dbField)) {
        setClauses.push(`${dbField} = ?`);
        values.push(value);
      }
    }
    
    if (setClauses.length === 0) return;
    
    values.push(id);
    const stmt = db.prepare(`UPDATE replay_tasks SET ${setClauses.join(', ')} WHERE id = ?`);
    stmt.run(...values);
  }

  static delete(id: string): void {
    db.prepare('DELETE FROM replay_tasks WHERE id = ?').run(id);
  }

  private static mapRowToTask(row: any): ReplayTask {
    return {
      id: row.id,
      name: row.name,
      status: row.status as ReplayTask['status'],
      progress: row.progress,
      policyVersion: row.policy_version,
      upstreamCount: row.upstream_count,
      requestCount: row.request_count,
      healthEventCount: row.health_event_count,
      createdAt: row.created_at,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      error: row.error
    };
  }
}
