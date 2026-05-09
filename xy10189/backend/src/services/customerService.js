const getDB = require('../config/database');
const moment = require('moment');
const { v4: uuidv4 } = require('uuid');
const { calculateRiskLevel } = require('./creditService');

async function createCustomer(data) {
  const db = getDB();
  const { name, code, industry, contact_person, contact_phone, address, total_credit_limit } = data;

  const existing = await db.prepare('SELECT * FROM customers WHERE code = ?').get(code);
  if (existing) {
    return { success: false, message: '客户编码已存在' };
  }

  const customer = {
    id: uuidv4(),
    name: name,
    code: code,
    industry: industry || '',
    contact_person: contact_person || '',
    contact_phone: contact_phone || '',
    address: address || '',
    total_credit_limit: total_credit_limit || 0,
    available_credit: total_credit_limit || 0,
    used_credit: 0,
    credit_status: 'normal',
    risk_level: 'low',
    created_at: moment().format('YYYY-MM-DD HH:mm:ss'),
    updated_at: moment().format('YYYY-MM-DD HH:mm:ss')
  };

  const insert = db.prepare(`
    INSERT INTO customers (id, name, code, industry, contact_person, contact_phone, address, total_credit_limit, available_credit, used_credit, credit_status, risk_level, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  await insert.run(
    customer.id, customer.name, customer.code, customer.industry,
    customer.contact_person, customer.contact_phone, customer.address,
    customer.total_credit_limit, customer.available_credit, customer.used_credit,
    customer.credit_status, customer.risk_level, customer.created_at, customer.updated_at
  );

  return {
    success: true,
    message: '客户创建成功',
    data: customer
  };
}

async function updateCustomer(id, data) {
  const db = getDB();
  const customer = await db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
  if (!customer) {
    return { success: false, message: '客户不存在' };
  }

  if (data.code && data.code !== customer.code) {
    const existing = await db.prepare('SELECT * FROM customers WHERE code = ? AND id != ?').get(data.code, id);
    if (existing) {
      return { success: false, message: '客户编码已存在' };
    }
  }

  const updateFields = [];
  const params = [];
  let newAvailable = customer.available_credit;
  let newRisk = customer.risk_level;

  if (data.name !== undefined) { updateFields.push('name = ?'); params.push(data.name); }
  if (data.code !== undefined) { updateFields.push('code = ?'); params.push(data.code); }
  if (data.industry !== undefined) { updateFields.push('industry = ?'); params.push(data.industry); }
  if (data.contact_person !== undefined) { updateFields.push('contact_person = ?'); params.push(data.contact_person); }
  if (data.contact_phone !== undefined) { updateFields.push('contact_phone = ?'); params.push(data.contact_phone); }
  if (data.address !== undefined) { updateFields.push('address = ?'); params.push(data.address); }
  if (data.total_credit_limit !== undefined) {
    const newLimit = data.total_credit_limit;
    if (newLimit < customer.used_credit) {
      return { success: false, message: '总额度不能小于已用额度' };
    }
    updateFields.push('total_credit_limit = ?');
    params.push(newLimit);
    
    const delta = newLimit - customer.total_credit_limit;
    newAvailable = customer.available_credit + delta;
    updateFields.push('available_credit = ?');
    params.push(newAvailable);
    
    newRisk = calculateRiskLevel(customer.used_credit, newLimit);
    updateFields.push('risk_level = ?');
    params.push(newRisk);
  }

  updateFields.push('updated_at = ?');
  params.push(moment().format('YYYY-MM-DD HH:mm:ss'));
  params.push(id);

  const update = db.prepare(`UPDATE customers SET ${updateFields.join(', ')} WHERE id = ?`);
  await update.run(...params);

  const updated = await db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
  return {
    success: true,
    message: '客户更新成功',
    data: updated
  };
}

async function getCustomerById(id) {
  const db = getDB();
  const customer = await db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
  if (!customer) {
    return { success: false, message: '客户不存在' };
  }

  const usageRatio = customer.total_credit_limit > 0 ? (customer.used_credit / customer.total_credit_limit) * 100 : 0;

  return {
    success: true,
    data: {
      ...customer,
      usage_ratio: usageRatio
    }
  };
}

async function getCustomers(params = {}) {
  const db = getDB();
  const { keyword, industry, risk_level, credit_status } = params;
  
  let query = 'SELECT * FROM customers WHERE 1=1';
  const queryParams = [];

  if (keyword) {
    query += ' AND (name LIKE ? OR code LIKE ?)';
    queryParams.push(`%${keyword}%`, `%${keyword}%`);
  }
  if (industry) {
    query += ' AND industry = ?';
    queryParams.push(industry);
  }
  if (risk_level) {
    query += ' AND risk_level = ?';
    queryParams.push(risk_level);
  }
  if (credit_status) {
    query += ' AND credit_status = ?';
    queryParams.push(credit_status);
  }

  query += ' ORDER BY updated_at DESC';

  const customers = await db.prepare(query).all(...queryParams);

  const customersWithRatio = customers.map(c => ({
    ...c,
    usage_ratio: c.total_credit_limit > 0 ? (c.used_credit / c.total_credit_limit) * 100 : 0
  }));

  return {
    success: true,
    data: customersWithRatio,
    total: customersWithRatio.length
  };
}

async function deleteCustomer(id) {
  const db = getDB();
  const customer = await db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
  if (!customer) {
    return { success: false, message: '客户不存在' };
  }

  const orderCount = await db.prepare('SELECT COUNT(*) as count FROM orders WHERE customer_id = ?').get(id);
  if (orderCount.count > 0) {
    return { success: false, message: '该客户存在订单记录，无法删除' };
  }

  await db.prepare('DELETE FROM credit_history WHERE customer_id = ?').run(id);
  await db.prepare('DELETE FROM risk_alerts WHERE customer_id = ?').run(id);
  await db.prepare('DELETE FROM credit_adjustments WHERE customer_id = ?').run(id);
  await db.prepare('DELETE FROM customers WHERE id = ?').run(id);

  return {
    success: true,
    message: '客户删除成功'
  };
}

async function getCustomerOrders(customerId) {
  const db = getDB();
  const orders = await db.prepare('SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC').all(customerId);
  return {
    success: true,
    data: orders
  };
}

async function getCustomerReturns(customerId) {
  const db = getDB();
  const returns = await db.prepare('SELECT * FROM returns WHERE customer_id = ? ORDER BY created_at DESC').all(customerId);
  return {
    success: true,
    data: returns
  };
}

async function getCustomerAdjustments(customerId) {
  const db = getDB();
  const adjustments = await db.prepare('SELECT * FROM credit_adjustments WHERE customer_id = ? ORDER BY created_at DESC').all(customerId);
  return {
    success: true,
    data: adjustments
  };
}

module.exports = {
  createCustomer,
  updateCustomer,
  getCustomerById,
  getCustomers,
  deleteCustomer,
  getCustomerOrders,
  getCustomerReturns,
  getCustomerAdjustments
};
