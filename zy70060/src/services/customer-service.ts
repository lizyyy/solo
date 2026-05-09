import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { runQuery, getOne, getAll } from '../utils/db-helpers';
import { Customer } from '../types';

interface CustomerRow {
  id: string;
  name: string;
  id_card_no: string;
  created_at: string;
  updated_at: string;
}

export const customerService = {
  async createCustomer(name: string, idCardNo: string): Promise<Customer> {
    const existingCustomer = await getOne<CustomerRow>(
      'SELECT * FROM customers WHERE id_card_no = ?',
      [idCardNo]
    );

    if (existingCustomer) {
      return this.rowToCustomer(existingCustomer);
    }

    const id = uuidv4();
    const now = dayjs().toISOString();

    await runQuery(
      `INSERT INTO customers (
        id, name, id_card_no, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?)`,
      [id, name, idCardNo, now, now]
    );

    return {
      id,
      name,
      idCardNo,
      createdAt: now,
      updatedAt: now
    };
  },

  async getCustomerById(id: string): Promise<Customer | undefined> {
    const row = await getOne<CustomerRow>(
      'SELECT * FROM customers WHERE id = ?',
      [id]
    );

    return row ? this.rowToCustomer(row) : undefined;
  },

  async getCustomerByIdCardNo(idCardNo: string): Promise<Customer | undefined> {
    const row = await getOne<CustomerRow>(
      'SELECT * FROM customers WHERE id_card_no = ?',
      [idCardNo]
    );

    return row ? this.rowToCustomer(row) : undefined;
  },

  async getAllCustomers(limit: number = 100): Promise<Customer[]> {
    const rows = await getAll<CustomerRow>(
      'SELECT * FROM customers ORDER BY created_at DESC LIMIT ?',
      [limit]
    );

    return rows.map(this.rowToCustomer);
  },

  rowToCustomer(row: CustomerRow): Customer {
    return {
      id: row.id,
      name: row.name,
      idCardNo: row.id_card_no,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
};