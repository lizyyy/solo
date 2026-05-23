import { run, get, all } from '../database/db';
import { Customer } from '../types';

export const createCustomer = async (customer: Customer): Promise<number> => {
  const sql = `INSERT INTO customers (name, phone, address) VALUES (?, ?, ?)`;
  return run(sql, [customer.name, customer.phone || null, customer.address || null]);
};

export const getCustomerById = async (id: number): Promise<Customer | undefined> => {
  const sql = `SELECT * FROM customers WHERE id = ?`;
  return get<Customer>(sql, [id]);
};

export const getAllCustomers = async (): Promise<Customer[]> => {
  const sql = `SELECT * FROM customers ORDER BY created_at DESC`;
  return all<Customer>(sql);
};

export const updateCustomer = async (id: number, customer: Partial<Customer>): Promise<void> => {
  const sql = `UPDATE customers SET name = ?, phone = ?, address = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
  await run(sql, [customer.name, customer.phone || null, customer.address || null, id]);
};
