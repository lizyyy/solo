const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'store.json');

function readData() {
  const raw = fs.readFileSync(DATA_FILE, 'utf-8');
  return JSON.parse(raw);
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function getOrders() {
  return readData().orders;
}

function getOrderById(orderId) {
  return getOrders().find(o => o.orderId === orderId);
}

function getAgents() {
  return readData().agents;
}

function getAgentById(agentId) {
  return getAgents().find(a => a.agentId === agentId);
}

function getComplaints() {
  return readData().complaints;
}

function getComplaintById(complaintId) {
  return getComplaints().find(c => c.complaintId === complaintId);
}

function addComplaint(complaint) {
  const data = readData();
  data.complaints.push(complaint);
  writeData(data);
  return complaint;
}

function updateComplaint(complaintId, updates) {
  const data = readData();
  const idx = data.complaints.findIndex(c => c.complaintId === complaintId);
  if (idx === -1) return null;
  data.complaints[idx] = { ...data.complaints[idx], ...updates };
  writeData(data);
  return data.complaints[idx];
}

function getCompensations() {
  return readData().compensations;
}

function addCompensation(compensation) {
  const data = readData();
  data.compensations.push(compensation);
  writeData(data);
  return compensation;
}

function getCompensationsByOrderId(orderId) {
  const data = readData();
  return data.compensations.filter(
    c => c.orderId === orderId && (c.status === 'approved' || c.status === 'paid')
  );
}

function getIdempotencyRecord(key) {
  const data = readData();
  if (!data.idempotency) {
    data.idempotency = {};
    writeData(data);
  }
  return data.idempotency[key] || null;
}

function setIdempotencyRecord(key, response) {
  const data = readData();
  if (!data.idempotency) {
    data.idempotency = {};
  }
  data.idempotency[key] = response;
  writeData(data);
}

function updateCompensation(complaintId, updates) {
  const data = readData();
  const idx = data.compensations.findIndex(c => c.complaintId === complaintId);
  if (idx === -1) return null;
  data.compensations[idx] = { ...data.compensations[idx], ...updates };
  writeData(data);
  return data.compensations[idx];
}

function getStatistics() {
  const data = readData();
  return {
    complaints: data.complaints,
    compensations: data.compensations,
    agents: data.agents
  };
}

module.exports = {
  getOrderById,
  getAgentById,
  getComplaintById,
  addComplaint,
  updateComplaint,
  addCompensation,
  updateCompensation,
  getCompensationsByOrderId,
  getIdempotencyRecord,
  setIdempotencyRecord,
  getStatistics
};
