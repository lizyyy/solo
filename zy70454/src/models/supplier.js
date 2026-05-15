import { v4 as uuidv4 } from 'uuid';
import { runAsync, getAsync, allAsync } from './database.js';

export async function createSupplier(data) {
  const now = Date.now();
  const id = uuidv4();
  
  await runAsync(
    `INSERT INTO suppliers (id, code, name, tax_id, contact_person, phone, email, address, status, created_at, updated_at, raw_input)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.code,
      data.name,
      data.tax_id || null,
      data.contact_person || null,
      data.phone || null,
      data.email || null,
      data.address || null,
      'pending',
      now,
      now,
      JSON.stringify(data)
    ]
  );
  
  return getSupplierById(id);
}

export async function getSupplierById(id) {
  return getAsync('SELECT * FROM suppliers WHERE id = ?', [id]);
}

export async function getSupplierByCode(code) {
  return getAsync('SELECT * FROM suppliers WHERE code = ?', [code]);
}

export async function getAllSuppliers() {
  return allAsync('SELECT * FROM suppliers ORDER BY created_at DESC');
}

export async function updateSupplierStatus(id, status) {
  const now = Date.now();
  await runAsync('UPDATE suppliers SET status = ?, updated_at = ? WHERE id = ?', [status, now, id]);
  return getSupplierById(id);
}

export async function getSupplierRawInput(id) {
  const supplier = await getSupplierById(id);
  return supplier ? JSON.parse(supplier.raw_input) : null;
}
