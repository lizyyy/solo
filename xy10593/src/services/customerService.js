const { prepare } = require('../database');
const { now, uuid, addStatusHistory, addManualCorrection } = require('../utils');

const createChannel = (data) => {
  const id = uuid();
  prepare(`
    INSERT INTO channels (id, channel_code, channel_name, contact_person, phone, commission_rate, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run([id, data.channel_code, data.channel_name, data.contact_person, data.phone, data.commission_rate || 0.03, now(), now()]);
  return getChannel(id);
};

const getChannel = (id) => {
  return prepare('SELECT * FROM channels WHERE id = ?').get([id]);
};

const getChannelByCode = (code) => {
  return prepare('SELECT * FROM channels WHERE channel_code = ?').get([code]);
};

const listChannels = () => {
  return prepare('SELECT * FROM channels ORDER BY created_at DESC').all([]);
};

const createCustomer = (data) => {
  const id = uuid();
  prepare(`
    INSERT INTO customers (id, customer_code, name, phone, id_card_no, channel_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run([
    id, data.customer_code, data.name, data.phone, data.id_card_no, data.channel_id, now(), now()
  ]);
  addStatusHistory('customer', id, null, 'active', '创建客户', data.created_by || 'system');
  return getCustomer(id);
};

const getCustomer = (id) => {
  return prepare(`
    SELECT c.*, ch.channel_name, ch.commission_rate
    FROM customers c
    LEFT JOIN channels ch ON c.channel_id = ch.id
    WHERE c.id = ?
  `).get([id]);
};

const getCustomerByCode = (code) => {
  return prepare(`
    SELECT c.*, ch.channel_name, ch.commission_rate
    FROM customers c
    LEFT JOIN channels ch ON c.channel_id = ch.id
    WHERE c.customer_code = ?
  `).get([code]);
};

const listCustomers = (channelId = null) => {
  let sql = `
    SELECT c.*, ch.channel_name
    FROM customers c
    LEFT JOIN channels ch ON c.channel_id = ch.id
    WHERE 1=1
  `;
  const params = [];
  if (channelId) {
    sql += ' AND c.channel_id = ?';
    params.push(channelId);
  }
  sql += ' ORDER BY c.created_at DESC';
  return prepare(sql).all(params);
};

const getCustomerBookings = (customerId) => {
  return prepare(`
    SELECT b.*, p.property_code, pr.project_name, ch.channel_name
    FROM bookings b
    LEFT JOIN properties p ON b.property_id = p.id
    LEFT JOIN projects pr ON p.project_id = pr.id
    LEFT JOIN channels ch ON b.channel_id = ch.id
    WHERE b.customer_id = ?
    ORDER BY b.created_at DESC
  `).all([customerId]);
};

const correctCustomer = (customerId, fieldName, newValue, reason, operator) => {
  const customer = getCustomer(customerId);
  if (!customer) throw new Error('客户不存在');
  
  const oldValue = customer[fieldName];
  if (oldValue === undefined) throw new Error('字段不存在');
  
  prepare(`UPDATE customers SET ${fieldName} = ?, updated_at = ? WHERE id = ?`).run([newValue, now(), customerId]);
  
  addManualCorrection('customer', customerId, fieldName, oldValue, newValue, reason, operator);
  
  return getCustomer(customerId);
};

module.exports = {
  createChannel,
  getChannel,
  getChannelByCode,
  listChannels,
  createCustomer,
  getCustomer,
  getCustomerByCode,
  listCustomers,
  getCustomerBookings,
  correctCustomer
};
