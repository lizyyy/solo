import { v4 as uuidv4 } from 'uuid';
import { runAsync, getAsync, allAsync } from '../database/connection';
import { ProductionLine, Skill } from '../types';
import { recordHistory } from './historyService';

export const getLines = async (): Promise<ProductionLine[]> => {
  const rows = await allAsync(
    `SELECT 
      id, line_no as lineNo, name, required_skill_id as requiredSkillId,
      status, created_at as createdAt, updated_at as updatedAt
     FROM production_lines`
  );
  return rows;
};

export const getLineById = async (id: string): Promise<ProductionLine | undefined> => {
  return getAsync(
    `SELECT 
      id, line_no as lineNo, name, required_skill_id as requiredSkillId,
      status, created_at as createdAt, updated_at as updatedAt
     FROM production_lines WHERE id = ?`,
    [id]
  );
};

export const getLineByNo = async (lineNo: string): Promise<ProductionLine | undefined> => {
  return getAsync(
    `SELECT 
      id, line_no as lineNo, name, required_skill_id as requiredSkillId,
      status, created_at as createdAt, updated_at as updatedAt
     FROM production_lines WHERE line_no = ?`,
    [lineNo]
  );
};

export const getSkills = async (): Promise<Skill[]> => {
  return allAsync(
    'SELECT id, name, code, description, created_at as createdAt FROM skills'
  );
};

export const getSkillById = async (id: string): Promise<Skill | undefined> => {
  return getAsync(
    'SELECT id, name, code, description, created_at as createdAt FROM skills WHERE id = ?',
    [id]
  );
};

export const createLine = async (
  data: { lineNo: string; name: string; requiredSkillId: string },
  operatorId: string,
  operatorName: string
): Promise<ProductionLine> => {
  const now = new Date().toISOString();
  const id = uuidv4();

  await runAsync(
    `INSERT INTO production_lines (id, line_no, name, required_skill_id, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'active', ?, ?)`,
    [id, data.lineNo, data.name, data.requiredSkillId, now, now]
  );

  const line = await getLineById(id);
  await recordHistory('CREATE', 'line', id, operatorId, operatorName, null, line, '创建产线');

  return line!;
};
