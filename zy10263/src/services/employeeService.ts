import { v4 as uuidv4 } from 'uuid';
import { runAsync, getAsync, allAsync } from '../database/connection';
import { Employee, EmployeeSkill } from '../types';
import { recordHistory } from './historyService';

export const getEmployees = async (): Promise<Employee[]> => {
  const rows = await allAsync(
    `SELECT 
      id, employee_no as employeeNo, name, department, 
      current_line_id as currentLineId, status, 
      created_at as createdAt, updated_at as updatedAt
     FROM employees`
  );
  return rows;
};

export const getEmployeeById = async (id: string): Promise<Employee | undefined> => {
  return getAsync(
    `SELECT 
      id, employee_no as employeeNo, name, department, 
      current_line_id as currentLineId, status, 
      created_at as createdAt, updated_at as updatedAt
     FROM employees WHERE id = ?`,
    [id]
  );
};

export const getEmployeeByNo = async (employeeNo: string): Promise<Employee | undefined> => {
  return getAsync(
    `SELECT 
      id, employee_no as employeeNo, name, department, 
      current_line_id as currentLineId, status, 
      created_at as createdAt, updated_at as updatedAt
     FROM employees WHERE employee_no = ?`,
    [employeeNo]
  );
};

export const createEmployee = async (
  data: { employeeNo: string; name: string; department: string },
  operatorId: string,
  operatorName: string
): Promise<Employee> => {
  const now = new Date().toISOString();
  const id = uuidv4();

  await runAsync(
    `INSERT INTO employees (id, employee_no, name, department, current_line_id, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, NULL, 'active', ?, ?)`,
    [id, data.employeeNo, data.name, data.department, now, now]
  );

  const employee = await getEmployeeById(id);
  await recordHistory('CREATE', 'employee', id, operatorId, operatorName, null, employee, '创建员工');

  return employee!;
};

export const updateEmployeeLine = async (
  employeeId: string,
  lineId: string | null,
  operatorId: string,
  operatorName: string
): Promise<Employee> => {
  const before = await getEmployeeById(employeeId);
  if (!before) {
    throw new Error('员工不存在');
  }

  const now = new Date().toISOString();
  await runAsync(
    'UPDATE employees SET current_line_id = ?, updated_at = ? WHERE id = ?',
    [lineId, now, employeeId]
  );

  const after = await getEmployeeById(employeeId);
  await recordHistory('UPDATE_LINE', 'employee', employeeId, operatorId, operatorName, before, after, '更新员工所在产线');

  return after!;
};

export const getEmployeeSkills = async (employeeId: string): Promise<EmployeeSkill[]> => {
  return allAsync(
    `SELECT 
      es.id, es.employee_id as employeeId, es.skill_id as skillId, 
      s.name as skillName, s.code as skillCode, es.level, es.created_at as createdAt
     FROM employee_skills es
     JOIN skills s ON es.skill_id = s.id
     WHERE es.employee_id = ?`,
    [employeeId]
  );
};

export const addEmployeeSkill = async (
  employeeId: string,
  skillId: string,
  level: number,
  operatorId: string,
  operatorName: string
): Promise<EmployeeSkill> => {
  const id = uuidv4();
  const now = new Date().toISOString();

  await runAsync(
    'INSERT INTO employee_skills (id, employee_id, skill_id, level, created_at) VALUES (?, ?, ?, ?, ?)',
    [id, employeeId, skillId, level, now]
  );

  const skill = await getAsync(
    `SELECT 
      id, employee_id as employeeId, skill_id as skillId, level, created_at as createdAt
     FROM employee_skills WHERE id = ?`,
    [id]
  );

  await recordHistory('ADD_SKILL', 'employee', employeeId, operatorId, operatorName, null, skill, '添加员工技能');

  return skill!;
};
