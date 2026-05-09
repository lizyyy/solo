const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

function generateId() {
  return uuidv4();
}

function nowIso() {
  return new Date().toISOString();
}

function generateOrderNo() {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `ORD-${y}${m}${d}-${random}`;
}

function generateComplaintNo() {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `CMP-${y}${m}${d}-${random}`;
}

function hashRequest(obj) {
  const str = JSON.stringify(obj, Object.keys(obj).sort());
  return crypto.createHash('sha256').update(str).digest('hex');
}

function isValidIso(str) {
  if (typeof str !== 'string') return false;
  const d = new Date(str);
  return !isNaN(d.getTime()) && d.toISOString() === str;
}

function parseTimeSlot(timeStr) {
  if (!timeStr) return null;
  const parts = timeStr.split(':');
  if (parts.length < 2) return null;
  return { hour: parseInt(parts[0], 10), minute: parseInt(parts[1], 10) };
}

function isInTimeSlot(dateIso, startStr, endStr) {
  const d = new Date(dateIso);
  const hour = d.getHours();
  const minute = d.getMinutes();
  const current = hour * 60 + minute;

  if (!startStr || !endStr) return true;

  const start = parseTimeSlot(startStr);
  const end = parseTimeSlot(endStr);
  if (!start || !end) return true;

  const startMin = start.hour * 60 + start.minute;
  const endMin = end.hour * 60 + end.minute;

  if (startMin <= endMin) {
    return current >= startMin && current < endMin;
  } else {
    return current >= startMin || current < endMin;
  }
}

const STATUS_FLOW = {
  pending: ['investigating', 'withdrawn'],
  investigating: ['verifying', 'withdrawn', 'rejected'],
  verifying: ['approved', 'pending_review', 'rejected', 'withdrawn'],
  pending_review: ['approved', 'rejected', 'verifying'],
  approved: ['completed'],
  completed: [],
  rejected: [],
  withdrawn: []
};

function canTransition(fromStatus, toStatus) {
  const allowed = STATUS_FLOW[fromStatus];
  return allowed ? allowed.includes(toStatus) : false;
}

module.exports = {
  generateId,
  nowIso,
  generateOrderNo,
  generateComplaintNo,
  hashRequest,
  isValidIso,
  isInTimeSlot,
  canTransition
};
