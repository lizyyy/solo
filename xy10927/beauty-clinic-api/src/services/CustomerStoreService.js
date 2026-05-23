const { v4: uuidv4 } = require('uuid');
const { run, get, all } = require('../db');

class CustomerStoreService {
  async createCustomer(data) {
    const id = uuidv4();
    const now = new Date().toISOString();

    await run(`
      INSERT INTO customers (id, name, phone, gender, birthday, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [id, data.name, data.phone, data.gender, data.birthday, now, now]);

    return this.getCustomerById(id);
  }

  async getCustomerById(id) {
    return get('SELECT * FROM customers WHERE id = ?', [id]);
  }

  async getCustomerByPhone(phone) {
    return get('SELECT * FROM customers WHERE phone = ?', [phone]);
  }

  async getAllCustomers() {
    return all('SELECT * FROM customers ORDER BY created_at DESC');
  }

  async updateCustomer(id, data) {
    const now = new Date().toISOString();
    const fields = [];
    const values = [];

    if (data.name) { fields.push('name = ?'); values.push(data.name); }
    if (data.phone) { fields.push('phone = ?'); values.push(data.phone); }
    if (data.gender) { fields.push('gender = ?'); values.push(data.gender); }
    if (data.birthday) { fields.push('birthday = ?'); values.push(data.birthday); }
    
    fields.push('updated_at = ?');
    values.push(now);
    values.push(id);

    await run(`UPDATE customers SET ${fields.join(', ')} WHERE id = ?`, values);
    return this.getCustomerById(id);
  }

  async createStore(data) {
    const id = uuidv4();
    const now = new Date().toISOString();

    await run(`
      INSERT INTO stores (id, name, address, phone, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [id, data.name, data.address, data.phone, 'active', now, now]);

    return this.getStoreById(id);
  }

  async getStoreById(id) {
    return get('SELECT * FROM stores WHERE id = ?', [id]);
  }

  async getAllStores() {
    return all('SELECT * FROM stores ORDER BY created_at DESC');
  }

  async updateStore(id, data) {
    const now = new Date().toISOString();
    const fields = [];
    const values = [];

    if (data.name) { fields.push('name = ?'); values.push(data.name); }
    if (data.address) { fields.push('address = ?'); values.push(data.address); }
    if (data.phone) { fields.push('phone = ?'); values.push(data.phone); }
    if (data.status) { fields.push('status = ?'); values.push(data.status); }
    
    fields.push('updated_at = ?');
    values.push(now);
    values.push(id);

    await run(`UPDATE stores SET ${fields.join(', ')} WHERE id = ?`, values);
    return this.getStoreById(id);
  }
}

module.exports = new CustomerStoreService();
