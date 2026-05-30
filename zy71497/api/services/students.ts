import db from "../db/index.js";
import type { Student } from "../../shared/types.js";

const getAll = (): Student[] => {
  const students = db
    .prepare(
      `
    SELECT s.*, 
      COALESCE((SELECT SUM(amount) FROM star_transactions WHERE student_id = s.id), 0) as total_stars
    FROM students s
    ORDER BY s.created_at DESC
  `
    )
    .all() as Student[];
  return students;
};

const getById = (id: number): Student | undefined => {
  const student = db
    .prepare(
      `
    SELECT s.*, 
      COALESCE((SELECT SUM(amount) FROM star_transactions WHERE student_id = s.id), 0) as total_stars
    FROM students s
    WHERE s.id = ?
  `
    )
    .get(id) as Student | undefined;
  return student;
};

const create = (data: {
  name: string;
  enroll_date: string;
  note?: string;
}): Student => {
  const stmt = db.prepare(`
    INSERT INTO students (name, enroll_date, note)
    VALUES (?, ?, ?)
  `);
  const result = stmt.run(data.name, data.enroll_date, data.note || "");
  return getById(Number(result.lastInsertRowid))!;
};

const update = (
  id: number,
  data: {
    name?: string;
    enroll_date?: string;
    status?: "active" | "archived";
    note?: string;
  }
): Student | undefined => {
  const fields: string[] = [];
  const values: any[] = [];

  if (data.name !== undefined) {
    fields.push("name = ?");
    values.push(data.name);
  }
  if (data.enroll_date !== undefined) {
    fields.push("enroll_date = ?");
    values.push(data.enroll_date);
  }
  if (data.status !== undefined) {
    fields.push("status = ?");
    values.push(data.status);
  }
  if (data.note !== undefined) {
    fields.push("note = ?");
    values.push(data.note);
  }

  if (fields.length === 0) return getById(id);

  fields.push("updated_at = datetime('now', 'localtime')");
  values.push(id);

  const stmt = db.prepare(`
    UPDATE students SET ${fields.join(", ")} WHERE id = ?
  `);
  stmt.run(...values);
  return getById(id);
};

export default {
  getAll,
  getById,
  create,
  update,
};
