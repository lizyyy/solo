import db from '../db';
import { v4 as uuidv4 } from 'uuid';
import { logChange } from './changeLogService';

export interface Student {
  id: string;
  name: string;
  studentNo: string;
  grade?: string;
  class?: string;
  parentName?: string;
  parentPhone?: string;
  defaultRouteId?: string;
  defaultStopId?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export function getStudents(params?: { search?: string; status?: string; grade?: string }) {
  let query = 'SELECT * FROM students WHERE 1=1';
  const queryParams: any[] = [];

  if (params?.search) {
    query += ' AND (name LIKE ? OR studentNo LIKE ? OR parentName LIKE ?)';
    const searchTerm = `%${params.search}%`;
    queryParams.push(searchTerm, searchTerm, searchTerm);
  }

  if (params?.status) {
    query += ' AND status = ?';
    queryParams.push(params.status);
  }

  if (params?.grade) {
    query += ' AND grade = ?';
    queryParams.push(params.grade);
  }

  query += ' ORDER BY createdAt DESC';

  const stmt = db.prepare(query);
  return stmt.all(...queryParams) as Student[];
}

export function getStudentById(id: string) {
  const stmt = db.prepare('SELECT * FROM students WHERE id = ?');
  return stmt.get(id) as Student | undefined;
}

export function createStudent(data: Omit<Student, 'id' | 'createdAt' | 'updatedAt'>, operator?: string) {
  const id = uuidv4();
  const stmt = db.prepare(`
    INSERT INTO students (id, name, studentNo, grade, class, parentName, parentPhone, defaultRouteId, defaultStopId, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    id,
    data.name,
    data.studentNo,
    data.grade,
    data.class,
    data.parentName,
    data.parentPhone,
    data.defaultRouteId,
    data.defaultStopId,
    data.status || 'active'
  );
  return getStudentById(id);
}

export function updateStudent(id: string, data: Partial<Student>, operator?: string) {
  const student = getStudentById(id);
  if (!student) throw new Error('Student not found');

  const fields = Object.keys(data).filter(k => k !== 'id' && k !== 'createdAt' && k !== 'updatedAt');
  if (fields.length === 0) return student;

  fields.forEach(field => {
    const oldValue = (student as any)[field];
    const newValue = (data as any)[field];
    if (oldValue !== newValue) {
      logChange('student', id, field, oldValue, newValue, operator, '更新学生信息');
    }
  });

  const setClause = fields.map(f => `${f} = ?`).join(', ');
  const params = fields.map(f => (data as any)[f]);
  params.push(id);

  const stmt = db.prepare(`UPDATE students SET ${setClause}, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`);
  stmt.run(...params);

  return getStudentById(id);
}

export function deleteStudent(id: string, operator?: string) {
  const student = getStudentById(id);
  if (!student) throw new Error('Student not found');

  logChange('student', id, 'status', student.status, 'deleted', operator, '删除学生');

  const stmt = db.prepare('UPDATE students SET status = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?');
  stmt.run('inactive', id);
  return true;
}
