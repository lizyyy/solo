import { v4 as uuidv4 } from 'uuid';
import { run, get, all } from './database';
import {
  Application,
  CreateApplicationInput,
  ApplicationStatus,
  BloodType,
  BloodComponentType,
} from '../types';

export function createApplication(input: CreateApplicationInput): Application {
  const now = new Date().toISOString();
  const id = uuidv4();

  const application: Application = {
    id,
    wardId: input.wardId,
    patientName: input.patientName,
    patientId: input.patientId,
    bloodType: input.bloodType,
    componentType: input.componentType,
    quantity: input.quantity,
    urgency: input.urgency,
    clinicalDiagnosis: input.clinicalDiagnosis,
    specialRequirements: input.specialRequirements || null,
    crossMatchRequired: input.crossMatchRequired,
    status: 'PENDING',
    matchedBloodBagIds: [],
    reservedBloodBagIds: [],
    issuedBloodBagIds: [],
    requestedBy: input.requestedBy,
    requestedAt: now,
    matchedAt: null,
    reservedAt: null,
    issuedAt: null,
    cancelledAt: null,
    rejectedReason: null,
    notes: input.notes || null,
  };

  run(`
    INSERT INTO applications (
      id, ward_id, patient_name, patient_id, blood_type, component_type,
      quantity, urgency, clinical_diagnosis, special_requirements,
      cross_match_required, status, matched_blood_bag_ids, reserved_blood_bag_ids,
      issued_blood_bag_ids, requested_by, requested_at, matched_at, reserved_at,
      issued_at, cancelled_at, rejected_reason, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    application.id,
    application.wardId,
    application.patientName,
    application.patientId,
    application.bloodType,
    application.componentType,
    application.quantity,
    application.urgency,
    application.clinicalDiagnosis,
    application.specialRequirements,
    application.crossMatchRequired ? 1 : 0,
    application.status,
    JSON.stringify(application.matchedBloodBagIds),
    JSON.stringify(application.reservedBloodBagIds),
    JSON.stringify(application.issuedBloodBagIds),
    application.requestedBy,
    application.requestedAt,
    application.matchedAt,
    application.reservedAt,
    application.issuedAt,
    application.cancelledAt,
    application.rejectedReason,
    application.notes
  ]);

  return application;
}

export function getApplicationById(id: string): Application | null {
  const row = get('SELECT * FROM applications WHERE id = ?', [id]);
  if (!row) return null;
  return mapRowToApplication(row);
}

export function getApplications(filters?: {
  wardId?: string;
  status?: ApplicationStatus;
  bloodType?: BloodType;
  componentType?: BloodComponentType;
  urgency?: 'ROUTINE' | 'URGENT' | 'EMERGENCY';
}): Application[] {
  let query = 'SELECT * FROM applications WHERE 1=1';
  const params: unknown[] = [];

  if (filters?.wardId) {
    query += ' AND ward_id = ?';
    params.push(filters.wardId);
  }
  if (filters?.status) {
    query += ' AND status = ?';
    params.push(filters.status);
  }
  if (filters?.bloodType) {
    query += ' AND blood_type = ?';
    params.push(filters.bloodType);
  }
  if (filters?.componentType) {
    query += ' AND component_type = ?';
    params.push(filters.componentType);
  }
  if (filters?.urgency) {
    query += ' AND urgency = ?';
    params.push(filters.urgency);
  }

  query += ' ORDER BY CASE urgency WHEN "EMERGENCY" THEN 1 WHEN "URGENT" THEN 2 ELSE 3 END, requested_at DESC';

  const rows = all(query, params);
  return rows.map((row) => mapRowToApplication(row));
}

export function updateApplicationStatus(
  id: string,
  status: ApplicationStatus,
  options?: {
    matchedBloodBagIds?: string[];
    reservedBloodBagIds?: string[];
    issuedBloodBagIds?: string[];
    rejectedReason?: string;
  }
): Application | null {
  const existing = getApplicationById(id);
  if (!existing) return null;

  const now = new Date().toISOString();
  const updates: string[] = ['status = ?'];
  const values: unknown[] = [status];

  if (options?.matchedBloodBagIds !== undefined) {
    updates.push('matched_blood_bag_ids = ?');
    values.push(JSON.stringify(options.matchedBloodBagIds));
    updates.push('matched_at = ?');
    values.push(now);
  }
  if (options?.reservedBloodBagIds !== undefined) {
    updates.push('reserved_blood_bag_ids = ?');
    values.push(JSON.stringify(options.reservedBloodBagIds));
    updates.push('reserved_at = ?');
    values.push(now);
  }
  if (options?.issuedBloodBagIds !== undefined) {
    updates.push('issued_blood_bag_ids = ?');
    values.push(JSON.stringify(options.issuedBloodBagIds));
    updates.push('issued_at = ?');
    values.push(now);
  }
  if (options?.rejectedReason !== undefined) {
    updates.push('rejected_reason = ?');
    values.push(options.rejectedReason);
  }

  if (status === 'CANCELLED') {
    updates.push('cancelled_at = ?');
    values.push(now);
  }

  values.push(id);

  run(`UPDATE applications SET ${updates.join(', ')} WHERE id = ?`, values);

  return getApplicationById(id);
}

function mapRowToApplication(row: Record<string, unknown>): Application {
  return {
    id: row.id as string,
    wardId: row.ward_id as string,
    patientName: row.patient_name as string,
    patientId: row.patient_id as string,
    bloodType: row.blood_type as BloodType,
    componentType: row.component_type as BloodComponentType,
    quantity: row.quantity as number,
    urgency: row.urgency as 'ROUTINE' | 'URGENT' | 'EMERGENCY',
    clinicalDiagnosis: row.clinical_diagnosis as string,
    specialRequirements: row.special_requirements as string | null,
    crossMatchRequired: Boolean(row.cross_match_required),
    status: row.status as ApplicationStatus,
    matchedBloodBagIds: JSON.parse(row.matched_blood_bag_ids as string),
    reservedBloodBagIds: JSON.parse(row.reserved_blood_bag_ids as string),
    issuedBloodBagIds: JSON.parse(row.issued_blood_bag_ids as string),
    requestedBy: row.requested_by as string,
    requestedAt: row.requested_at as string,
    matchedAt: row.matched_at as string | null,
    reservedAt: row.reserved_at as string | null,
    issuedAt: row.issued_at as string | null,
    cancelledAt: row.cancelled_at as string | null,
    rejectedReason: row.rejected_reason as string | null,
    notes: row.notes as string | null,
  };
}
