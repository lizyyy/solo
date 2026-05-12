const { prepare } = require('../database');
const { generateCode, now, uuid, addStatusHistory } = require('../utils');

const STATUS = {
  AVAILABLE: 'available',
  LOCKED: 'locked',
  DEPOSITED: 'deposited',
  SOLD: 'sold',
  REFUNDED: 'refunded'
};

const createProject = (data) => {
  const id = uuid();
  prepare(`
    INSERT INTO projects (id, project_code, project_name, city, developer, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run([id, data.project_code, data.project_name, data.city, data.developer, now(), now()]);
  return getProject(id);
};

const getProject = (id) => {
  return prepare('SELECT * FROM projects WHERE id = ?').get([id]);
};

const getProjectByCode = (code) => {
  return prepare('SELECT * FROM projects WHERE project_code = ?').get([code]);
};

const listProjects = () => {
  return prepare('SELECT * FROM projects ORDER BY created_at DESC').all([]);
};

const createProperty = (data) => {
  const id = uuid();
  prepare(`
    INSERT INTO properties (id, project_id, property_code, building_no, unit_no, room_no, floor, area, total_price, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run([
    id, data.project_id, data.property_code,
    data.building_no, data.unit_no, data.room_no,
    data.floor, data.area, data.total_price,
    STATUS.AVAILABLE, now(), now()
  ]);
  addStatusHistory('property', id, null, STATUS.AVAILABLE, '创建房源', data.created_by || 'system');
  return getProperty(id);
};

const getProperty = (id) => {
  return prepare(`
    SELECT p.*, pr.project_name, pr.project_code
    FROM properties p
    LEFT JOIN projects pr ON p.project_id = pr.id
    WHERE p.id = ?
  `).get([id]);
};

const getPropertyByCode = (code) => {
  return prepare(`
    SELECT p.*, pr.project_name, pr.project_code
    FROM properties p
    LEFT JOIN projects pr ON p.project_id = pr.id
    WHERE p.property_code = ?
  `).get([code]);
};

const listProperties = (projectId = null, status = null) => {
  let sql = `
    SELECT p.*, pr.project_name, pr.project_code
    FROM properties p
    LEFT JOIN projects pr ON p.project_id = pr.id
    WHERE 1=1
  `;
  const params = [];
  if (projectId) {
    sql += ' AND p.project_id = ?';
    params.push(projectId);
  }
  if (status) {
    sql += ' AND p.status = ?';
    params.push(status);
  }
  sql += ' ORDER BY pr.project_code, p.building_no, p.unit_no, p.room_no';
  return prepare(sql).all(params);
};

const updatePropertyStatus = (propertyId, newStatus, action, operator, details = null, bookingId = null) => {
  const property = getProperty(propertyId);
  if (!property) throw new Error('房源不存在');

  const oldStatus = property.status;
  
  prepare(`
    UPDATE properties 
    SET status = ?, current_booking_id = ?, updated_at = ? 
    WHERE id = ?
  `).run([newStatus, bookingId, now(), propertyId]);
  
  addStatusHistory('property', propertyId, oldStatus, newStatus, action, operator, details);
  return getProperty(propertyId);
};

const getPropertyTimeline = (propertyId) => {
  const property = getProperty(propertyId);
  if (!property) return null;
  
  const history = prepare(`
    SELECT * FROM status_history 
    WHERE entity_type = 'property' AND entity_id = ? 
    ORDER BY created_at ASC
  `).all([propertyId]);
  
  const corrections = prepare(`
    SELECT * FROM manual_corrections 
    WHERE entity_type = 'property' AND entity_id = ? 
    ORDER BY created_at ASC
  `).all([propertyId]);
  
  const booking = property.current_booking_id 
    ? prepare(`
        SELECT b.*, c.name as customer_name, c.phone as customer_phone,
               ch.channel_name
        FROM bookings b
        LEFT JOIN customers c ON b.customer_id = c.id
        LEFT JOIN channels ch ON b.channel_id = ch.id
        WHERE b.id = ?
      `).get([property.current_booking_id])
    : null;
  
  return {
    property,
    current_booking: booking,
    status_history: history.map(h => ({
      ...h,
      details: h.details ? JSON.parse(h.details) : null
    })),
    manual_corrections: corrections
  };
};

module.exports = {
  STATUS,
  createProject,
  getProject,
  getProjectByCode,
  listProjects,
  createProperty,
  getProperty,
  getPropertyByCode,
  listProperties,
  updatePropertyStatus,
  getPropertyTimeline
};
