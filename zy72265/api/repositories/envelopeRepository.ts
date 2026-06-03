import { getDatabase } from '../database/init';
import type { EnvelopeRecord, CoordinatePoint, AuditLog, BoundaryRule, SafetyRadiusTable, ProcessingStatus, WorkflowStep } from '../../shared/types';
import { v4 as uuidv4 } from 'uuid';

function mapToEnvelopeRecord(row: any): EnvelopeRecord {
  return {
    id: row.id,
    robotArmId: row.robot_arm_id,
    calculationDate: row.calculation_date,
    safetyRadiusVersion: row.safety_radius_version,
    status: row.status as ProcessingStatus,
    totalPoints: row.total_points,
    mixedPoints: row.mixed_points,
    currentStep: row.current_step as WorkflowStep,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
  };
}

function mapToCoordinatePoint(row: any): CoordinatePoint {
  return {
    id: row.id,
    envelopeId: row.envelope_id,
    originalLineNumber: row.original_line_number,
    rawValue: row.raw_value,
    xValue: row.x_value,
    yValue: row.y_value,
    coordinateType: row.coordinate_type,
    isMixed: row.is_mixed === 1,
    status: row.status as ProcessingStatus,
    safetyRadius: row.safety_radius,
    radiusSource: row.radius_source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapToAuditLog(row: any): AuditLog {
  return {
    id: row.id,
    envelopeId: row.envelope_id,
    pointId: row.point_id,
    actionType: row.action_type,
    originalValue: row.original_value,
    newValue: row.new_value,
    operator: row.operator,
    remark: row.remark,
    timestamp: row.timestamp,
    originalLineNumber: row.original_line_number,
  };
}

function mapToBoundaryRule(row: any): BoundaryRule {
  return {
    id: row.id,
    ruleType: row.rule_type,
    ruleName: row.rule_name,
    condition: row.condition,
    action: row.action,
    isActive: row.is_active === 1,
    codeReference: row.code_reference,
    description: row.description,
  };
}

function mapToSafetyRadius(row: any): SafetyRadiusTable {
  return {
    id: row.id,
    version: row.version,
    armModel: row.arm_model,
    distance: row.distance,
    radius: row.radius,
    effectiveDate: row.effective_date,
  };
}

export const envelopeRepository = {
  findAllEnvelopes(status?: ProcessingStatus, robotArmId?: string): EnvelopeRecord[] {
    const db = getDatabase();
    let sql = 'SELECT * FROM envelope_records WHERE 1=1';
    const params: any[] = [];
    
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    if (robotArmId) {
      sql += ' AND robot_arm_id LIKE ?';
      params.push(`%${robotArmId}%`);
    }
    
    sql += ' ORDER BY created_at DESC';
    const rows = db.prepare(sql).all(...params);
    return rows.map(mapToEnvelopeRecord);
  },
  
  findEnvelopeById(id: string): EnvelopeRecord | undefined {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM envelope_records WHERE id = ?').get(id);
    return row ? mapToEnvelopeRecord(row) : undefined;
  },
  
  createEnvelope(data: Omit<EnvelopeRecord, 'id' | 'createdAt' | 'updatedAt'>): EnvelopeRecord {
    const db = getDatabase();
    const now = new Date().toISOString();
    const id = uuidv4();
    
    db.prepare(`
      INSERT INTO envelope_records (
        id, robot_arm_id, calculation_date, safety_radius_version, status,
        total_points, mixed_points, current_step, created_at, updated_at, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.robotArmId,
      data.calculationDate,
      data.safetyRadiusVersion,
      data.status,
      data.totalPoints,
      data.mixedPoints,
      data.currentStep,
      now,
      now,
      data.createdBy,
    );
    
    return this.findEnvelopeById(id)!;
  },
  
  updateEnvelopeStep(id: string, step: WorkflowStep, status: ProcessingStatus): EnvelopeRecord | undefined {
    const db = getDatabase();
    const now = new Date().toISOString();
    
    db.prepare(`
      UPDATE envelope_records
      SET current_step = ?, status = ?, updated_at = ?
      WHERE id = ?
    `).run(step, status, now, id);
    
    return this.findEnvelopeById(id);
  },
  
  updateEnvelopeStatus(id: string, status: ProcessingStatus): EnvelopeRecord | undefined {
    const db = getDatabase();
    const now = new Date().toISOString();
    
    db.prepare(`
      UPDATE envelope_records
      SET status = ?, updated_at = ?
      WHERE id = ?
    `).run(status, now, id);
    
    return this.findEnvelopeById(id);
  },
  
  findPointsByEnvelopeId(envelopeId: string): CoordinatePoint[] {
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT * FROM coordinate_points
      WHERE envelope_id = ?
      ORDER BY original_line_number ASC
    `).all(envelopeId);
    return rows.map(mapToCoordinatePoint);
  },
  
  findPointById(id: string): CoordinatePoint | undefined {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM coordinate_points WHERE id = ?').get(id);
    return row ? mapToCoordinatePoint(row) : undefined;
  },
  
  createPoint(data: Omit<CoordinatePoint, 'id' | 'createdAt' | 'updatedAt'>): CoordinatePoint {
    const db = getDatabase();
    const now = new Date().toISOString();
    const id = uuidv4();
    
    db.prepare(`
      INSERT INTO coordinate_points (
        id, envelope_id, original_line_number, raw_value, x_value, y_value,
        coordinate_type, is_mixed, status, safety_radius, radius_source,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.envelopeId,
      data.originalLineNumber,
      data.rawValue,
      data.xValue,
      data.yValue,
      data.coordinateType,
      data.isMixed ? 1 : 0,
      data.status,
      data.safetyRadius,
      data.radiusSource,
      now,
      now,
    );
    
    return this.findPointById(id)!;
  },
  
  updatePoint(id: string, updates: Partial<Pick<CoordinatePoint, 'xValue' | 'yValue' | 'coordinateType' | 'isMixed' | 'status' | 'safetyRadius' | 'radiusSource'>>): CoordinatePoint | undefined {
    const db = getDatabase();
    const now = new Date().toISOString();
    
    const fields: string[] = [];
    const values: any[] = [];
    
    if (updates.xValue !== undefined) { fields.push('x_value = ?'); values.push(updates.xValue); }
    if (updates.yValue !== undefined) { fields.push('y_value = ?'); values.push(updates.yValue); }
    if (updates.coordinateType !== undefined) { fields.push('coordinate_type = ?'); values.push(updates.coordinateType); }
    if (updates.isMixed !== undefined) { fields.push('is_mixed = ?'); values.push(updates.isMixed ? 1 : 0); }
    if (updates.status !== undefined) { fields.push('status = ?'); values.push(updates.status); }
    if (updates.safetyRadius !== undefined) { fields.push('safety_radius = ?'); values.push(updates.safetyRadius); }
    if (updates.radiusSource !== undefined) { fields.push('radius_source = ?'); values.push(updates.radiusSource); }
    
    fields.push('updated_at = ?');
    values.push(now);
    values.push(id);
    
    db.prepare(`
      UPDATE coordinate_points
      SET ${fields.join(', ')}
      WHERE id = ?
    `).run(...values);
    
    return this.findPointById(id);
  },
  
  countMixedPoints(envelopeId: string): number {
    const db = getDatabase();
    const result = db.prepare(`
      SELECT COUNT(*) as count FROM coordinate_points
      WHERE envelope_id = ? AND is_mixed = 1
    `).get(envelopeId) as { count: number };
    return result.count;
  },
  
  findAuditLogsByEnvelopeId(envelopeId: string): AuditLog[] {
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT * FROM audit_logs
      WHERE envelope_id = ?
      ORDER BY timestamp DESC
    `).all(envelopeId);
    return rows.map(mapToAuditLog);
  },
  
  createAuditLog(data: Omit<AuditLog, 'id' | 'timestamp'>): AuditLog {
    const db = getDatabase();
    const now = new Date().toISOString();
    const id = uuidv4();
    
    db.prepare(`
      INSERT INTO audit_logs (
        id, envelope_id, point_id, action_type, original_value,
        new_value, operator, remark, timestamp, original_line_number
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.envelopeId,
      data.pointId,
      data.actionType,
      data.originalValue,
      data.newValue,
      data.operator,
      data.remark,
      now,
      data.originalLineNumber,
    );
    
    const row = db.prepare('SELECT * FROM audit_logs WHERE id = ?').get(id);
    return mapToAuditLog(row);
  },
  
  findAllBoundaryRules(): BoundaryRule[] {
    const db = getDatabase();
    const rows = db.prepare('SELECT * FROM boundary_rules ORDER BY id ASC').all();
    return rows.map(mapToBoundaryRule);
  },
  
  updateBoundaryRule(id: string, updates: Partial<Pick<BoundaryRule, 'condition' | 'action' | 'isActive' | 'description'>>): BoundaryRule | undefined {
    const db = getDatabase();
    
    const fields: string[] = [];
    const values: any[] = [];
    
    if (updates.condition !== undefined) { fields.push('condition = ?'); values.push(updates.condition); }
    if (updates.action !== undefined) { fields.push('action = ?'); values.push(updates.action); }
    if (updates.isActive !== undefined) { fields.push('is_active = ?'); values.push(updates.isActive ? 1 : 0); }
    if (updates.description !== undefined) { fields.push('description = ?'); values.push(updates.description); }
    
    values.push(id);
    
    db.prepare(`
      UPDATE boundary_rules
      SET ${fields.join(', ')}
      WHERE id = ?
    `).run(...values);
    
    const row = db.prepare('SELECT * FROM boundary_rules WHERE id = ?').get(id);
    return row ? mapToBoundaryRule(row) : undefined;
  },
  
  findSafetyRadiusTable(version?: string, armModel?: string): SafetyRadiusTable[] {
    const db = getDatabase();
    let sql = 'SELECT * FROM safety_radius WHERE 1=1';
    const params: any[] = [];
    
    if (version) {
      sql += ' AND version = ?';
      params.push(version);
    }
    if (armModel) {
      sql += ' AND arm_model = ?';
      params.push(armModel);
    }
    
    sql += ' ORDER BY distance ASC';
    const rows = db.prepare(sql).all(...params);
    return rows.map(mapToSafetyRadius);
  },
};
