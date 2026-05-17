import { getDB } from '../db';
import { logHistory } from './historyService';

export type MilestoneStatus = 'in_progress' | 'extension_requested' | 'confirmed' | 'closed';

export interface Milestone {
  id?: number;
  project_id: number;
  parent_id?: number;
  name: string;
  description?: string;
  planned_date: string;
  actual_date?: string;
  status?: MilestoneStatus;
  created_by: string;
  created_at?: string;
  updated_at?: string;
}

export async function createMilestone(milestone: Milestone): Promise<number> {
  const db = await getDB();
  const result = await db.run(
    `INSERT INTO milestones (project_id, parent_id, name, description, planned_date, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    milestone.project_id, milestone.parent_id, milestone.name, milestone.description,
    milestone.planned_date, milestone.status || 'in_progress', milestone.created_by
  );
  await logHistory({
    entity_type: 'milestone',
    entity_id: result.lastID!,
    action: 'create',
    performed_by: milestone.created_by,
    comment: '创建里程碑'
  });
  return result.lastID!;
}

export async function getMilestoneById(id: number): Promise<Milestone | undefined> {
  const db = await getDB();
  return db.get<Milestone>('SELECT * FROM milestones WHERE id = ?', id);
}

export async function getMilestonesByProject(projectId: number): Promise<Milestone[]> {
  const db = await getDB();
  return db.all<Milestone[]>('SELECT * FROM milestones WHERE project_id = ? ORDER BY planned_date', projectId);
}

export async function getChildMilestones(parentId: number): Promise<Milestone[]> {
  const db = await getDB();
  return db.all<Milestone[]>('SELECT * FROM milestones WHERE parent_id = ? ORDER BY planned_date', parentId);
}

export async function updateMilestoneStatus(id: number, status: MilestoneStatus, operator: string, comment?: string): Promise<void> {
  const db = await getDB();
  const oldMilestone = await getMilestoneById(id);
  await db.run(
    'UPDATE milestones SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    status, id
  );
  await logHistory({
    entity_type: 'milestone',
    entity_id: id,
    action: 'status_change',
    field_name: 'status',
    old_value: oldMilestone?.status,
    new_value: status,
    performed_by: operator,
    comment
  });
}

export async function updateMilestoneDate(id: number, newDate: string, operator: string, comment?: string): Promise<void> {
  const db = await getDB();
  const oldMilestone = await getMilestoneById(id);
  await db.run(
    'UPDATE milestones SET planned_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    newDate, id
  );
  await logHistory({
    entity_type: 'milestone',
    entity_id: id,
    action: 'date_update',
    field_name: 'planned_date',
    old_value: oldMilestone?.planned_date,
    new_value: newDate,
    performed_by: operator,
    comment
  });
}
