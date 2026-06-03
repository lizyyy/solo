import db from '../utils/database';
import { AuditLog, AuditAction, OperatorRole } from '../models';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';

class AuditRepository {
  findByRecordId(recordId: string): AuditLog[] {
    const stmt = db.prepare(`
      SELECT 
        id, record_id as recordId, action, field_name as fieldName,
        old_value as oldValue, new_value as newValue, reason, operator,
        operator_role as operatorRole, timestamp, affected_results as affectedResults
      FROM audit_logs
      WHERE record_id = ?
      ORDER BY timestamp DESC
    `);
    return stmt.all(recordId) as AuditLog[];
  }

  findAll(): AuditLog[] {
    const stmt = db.prepare(`
      SELECT 
        id, record_id as recordId, action, field_name as fieldName,
        old_value as oldValue, new_value as newValue, reason, operator,
        operator_role as operatorRole, timestamp, affected_results as affectedResults
      FROM audit_logs
      ORDER BY timestamp DESC
      LIMIT 100
    `);
    return stmt.all() as AuditLog[];
  }

  create(data: {
    recordId: string;
    action: AuditAction;
    fieldName?: string;
    oldValue?: string;
    newValue?: string;
    reason: string;
    operator: string;
    operatorRole: OperatorRole;
    affectedResults: string;
  }): AuditLog {
    const id = uuidv4();
    const now = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
    const stmt = db.prepare(`
      INSERT INTO audit_logs (
        id, record_id, action, field_name, old_value, new_value, reason,
        operator, operator_role, timestamp, affected_results
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id, data.recordId, data.action, data.fieldName || null,
      data.oldValue || null, data.newValue || null, data.reason,
      data.operator, data.operatorRole, now, data.affectedResults
    );
    
    const getStmt = db.prepare(`
      SELECT 
        id, record_id as recordId, action, field_name as fieldName,
        old_value as oldValue, new_value as newValue, reason, operator,
        operator_role as operatorRole, timestamp, affected_results as affectedResults
      FROM audit_logs WHERE id = ?
    `);
    return getStmt.get(id) as AuditLog;
  }

  deleteAllDemoData(): void {
    db.prepare('DELETE FROM audit_logs WHERE id LIKE "audit-%"').run();
  }
}

export default new AuditRepository();
