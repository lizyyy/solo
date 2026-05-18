import { v4 as uuidv4 } from 'uuid';
import { run, get, all } from '../database/db';
import { Employee } from '../types';

export async function createEmployee(data: Omit<Employee, 'id'>): Promise<Employee> {
  const id = uuidv4();
  await run(
    `INSERT INTO employees (id, employee_no, name, department, is_remote, location)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, data.employeeNo, data.name, data.department, data.isRemote ? 1 : 0, data.location]
  );
  return getEmployeeById(id) as Promise<Employee>;
}

export async function getEmployeeById(id: string): Promise<Employee | undefined> {
  const row = await get(
    'SELECT id, employee_no as employeeNo, name, department, is_remote as isRemote, location FROM employees WHERE id = ?',
    [id]
  );
  if (row) {
    return { ...row, isRemote: row.isRemote === 1 };
  }
  return undefined;
}

export async function getEmployeeByNo(employeeNo: string): Promise<Employee | undefined> {
  const row = await get(
    'SELECT id, employee_no as employeeNo, name, department, is_remote as isRemote, location FROM employees WHERE employee_no = ?',
    [employeeNo]
  );
  if (row) {
    return { ...row, isRemote: row.isRemote === 1 };
  }
  return undefined;
}

export async function getAllEmployees(): Promise<Employee[]> {
  const rows = await all(
    'SELECT id, employee_no as employeeNo, name, department, is_remote as isRemote, location FROM employees'
  );
  return rows.map(row => ({ ...row, isRemote: row.isRemote === 1 }));
}
