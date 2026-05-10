const { v4: uuidv4 } = require('uuid');
const { format, parseISO, isWithinInterval, parse } = require('date-fns');

function generateId() {
  return uuidv4();
}

function generateOrderNo() {
  const date = format(new Date(), 'yyyyMMddHHmmss');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `HD${date}${random}`;
}

function generateTransactionNo() {
  const date = format(new Date(), 'yyyyMMddHHmmss');
  const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
  return `TXN${date}${random}`;
}

function isTimeOverlap(start1, end1, start2, end2) {
  const s1 = new Date(start1);
  const e1 = new Date(end1);
  const s2 = new Date(start2);
  const e2 = new Date(end2);
  return s1 < e2 && s2 < e1;
}

function isScheduleOverlap(date, startTime, endTime, schedules) {
  return schedules.some(s => {
    if (s.date !== date) return false;
    const s1 = `${date} ${startTime}`;
    const e1 = `${date} ${endTime}`;
    const s2 = `${s.date} ${s.start_time}`;
    const e2 = `${s.date} ${s.end_time}`;
    return isTimeOverlap(s1, e1, s2, e2);
  });
}

function buildOperationKey(orderId, operation, dataHash) {
  return `${orderId}:${operation}:${dataHash}`;
}

function dataHash(data) {
  const str = JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString();
}

module.exports = {
  generateId,
  generateOrderNo,
  generateTransactionNo,
  isTimeOverlap,
  isScheduleOverlap,
  buildOperationKey,
  dataHash
};
