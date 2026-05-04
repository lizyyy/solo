import { db } from '../database';
import { Employee, EmployeeStatus, EmployeeId } from '../types';
import { generateUUID } from '../utils/idempotency';
import { logger } from '../utils/logger';

export class EmployeeRepository {
  private static instance: EmployeeRepository | null = null;

  private constructor() {}

  public static getInstance(): EmployeeRepository {
    if (!EmployeeRepository.instance) {
      EmployeeRepository.instance = new EmployeeRepository();
    }
    return EmployeeRepository.instance;
  }

  public async create(employeeData: Omit<Employee, 'id' | 'status' | 'createdAt' | 'updatedAt'>): Promise<Employee> {
    const id = generateUUID();
    const now = new Date();
    
    await db.run(
      `
      INSERT INTO employees (
        id, employee_number, name, email, phone, bank_name, 
        bank_account_number, bank_account_name, department, position,
        status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        id,
        employeeData.employeeNumber,
        employeeData.name,
        employeeData.email,
        employeeData.phone,
        employeeData.bankName,
        employeeData.bankAccountNumber,
        employeeData.bankAccountName,
        employeeData.department,
        employeeData.position,
        EmployeeStatus.ACTIVE,
        now.toISOString(),
        now.toISOString()
      ]
    );

    return this.findById(id) as Promise<Employee>;
  }

  public async findById(id: EmployeeId): Promise<Employee | undefined> {
    const row = await db.get(
      'SELECT * FROM employees WHERE id = ?',
      [id]
    );
    return row ? this.mapRowToEmployee(row) : undefined;
  }

  public async findByEmployeeNumber(employeeNumber: string): Promise<Employee | undefined> {
    const row = await db.get(
      'SELECT * FROM employees WHERE employee_number = ?',
      [employeeNumber]
    );
    return row ? this.mapRowToEmployee(row) : undefined;
  }

  public async findByEmail(email: string): Promise<Employee | undefined> {
    const row = await db.get(
      'SELECT * FROM employees WHERE email = ?',
      [email]
    );
    return row ? this.mapRowToEmployee(row) : undefined;
  }

  public async findAll(page: number = 1, pageSize: number = 100): Promise<{ employees: Employee[]; total: number }> {
    const offset = (page - 1) * pageSize;
    
    const [countResult, rows] = await Promise.all([
      db.get<{ count: number }>('SELECT COUNT(*) as count FROM employees'),
      db.all(
        'SELECT * FROM employees ORDER BY created_at DESC LIMIT ? OFFSET ?',
        [pageSize, offset]
      )
    ]);

    return {
      employees: rows.map(row => this.mapRowToEmployee(row)),
      total: countResult?.count || 0
    };
  }

  public async findByStatus(status: EmployeeStatus): Promise<Employee[]> {
    const rows = await db.all(
      'SELECT * FROM employees WHERE status = ? ORDER BY created_at DESC',
      [status]
    );
    return rows.map(row => this.mapRowToEmployee(row));
  }

  public async findByDepartment(department: string): Promise<Employee[]> {
    const rows = await db.all(
      'SELECT * FROM employees WHERE department = ? ORDER BY created_at DESC',
      [department]
    );
    return rows.map(row => this.mapRowToEmployee(row));
  }

  public async update(id: EmployeeId, updates: Partial<Omit<Employee, 'id' | 'createdAt'>>): Promise<Employee | undefined> {
    const now = new Date();
    const fields: string[] = ['updated_at = ?'];
    const values: any[] = [now.toISOString()];

    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    if (updates.email !== undefined) {
      fields.push('email = ?');
      values.push(updates.email);
    }
    if (updates.phone !== undefined) {
      fields.push('phone = ?');
      values.push(updates.phone);
    }
    if (updates.bankName !== undefined) {
      fields.push('bank_name = ?');
      values.push(updates.bankName);
    }
    if (updates.bankAccountNumber !== undefined) {
      fields.push('bank_account_number = ?');
      values.push(updates.bankAccountNumber);
    }
    if (updates.bankAccountName !== undefined) {
      fields.push('bank_account_name = ?');
      values.push(updates.bankAccountName);
    }
    if (updates.department !== undefined) {
      fields.push('department = ?');
      values.push(updates.department);
    }
    if (updates.position !== undefined) {
      fields.push('position = ?');
      values.push(updates.position);
    }
    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(updates.status);
    }

    values.push(id);

    await db.run(
      `UPDATE employees SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    return this.findById(id);
  }

  public async delete(id: EmployeeId): Promise<boolean> {
    const result = await db.run(
      'DELETE FROM employees WHERE id = ?',
      [id]
    );
    return result.changes > 0;
  }

  public async bulkCreate(employeesData: Omit<Employee, 'id' | 'status' | 'createdAt' | 'updatedAt'>[]): Promise<Employee[]> {
    const createdEmployees: Employee[] = [];

    await db.transaction(async () => {
      for (const employeeData of employeesData) {
        const existing = await this.findByEmployeeNumber(employeeData.employeeNumber);
        if (existing) {
          logger.warn('Employee already exists, skipping', { employeeNumber: employeeData.employeeNumber });
          continue;
        }
        const employee = await this.create(employeeData);
        createdEmployees.push(employee);
      }
    });

    return createdEmployees;
  }

  public async count(): Promise<number> {
    const result = await db.get<{ count: number }>('SELECT COUNT(*) as count FROM employees');
    return result?.count || 0;
  }

  private mapRowToEmployee(row: any): Employee {
    return {
      id: row.id,
      employeeNumber: row.employee_number,
      name: row.name,
      email: row.email,
      phone: row.phone,
      bankName: row.bank_name,
      bankAccountNumber: row.bank_account_number,
      bankAccountName: row.bank_account_name,
      department: row.department,
      position: row.position,
      status: row.status as EmployeeStatus,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}

export const employeeRepository = EmployeeRepository.getInstance();
