import { getDB } from '../db';
import { logHistory } from './historyService';

export interface Project {
  id?: number;
  name: string;
  code: string;
  description?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

export async function createProject(project: Project, operator: string): Promise<number> {
  const db = await getDB();
  const result = await db.run(
    'INSERT INTO projects (name, code, description, status) VALUES (?, ?, ?, ?)',
    project.name, project.code, project.description, project.status || 'active'
  );
  await logHistory({
    entity_type: 'project',
    entity_id: result.lastID!,
    action: 'create',
    performed_by: operator,
    comment: '创建项目'
  });
  return result.lastID!;
}

export async function getProjectById(id: number): Promise<Project | undefined> {
  const db = await getDB();
  return db.get<Project>('SELECT * FROM projects WHERE id = ?', id);
}

export async function getAllProjects(): Promise<Project[]> {
  const db = await getDB();
  return db.all<Project[]>('SELECT * FROM projects ORDER BY created_at DESC');
}
