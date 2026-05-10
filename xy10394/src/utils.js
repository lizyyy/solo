import { existsSync, mkdirSync } from 'fs';
import { parse, format, isValid, differenceInDays, isBefore, isAfter } from 'date-fns';
import { DATE_FORMAT, WARNING_DAYS, DATA_DIR } from './config.js';

export function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function parseDate(dateStr) {
  if (!dateStr) return null;
  const parsed = parse(dateStr, DATE_FORMAT, new Date());
  return isValid(parsed) ? parsed : null;
}

export function formatDate(date) {
  if (!date) return null;
  return format(date, DATE_FORMAT);
}

export function isValidDate(dateStr) {
  return parseDate(dateStr) !== null;
}

export function calculateExpiryStatus(expiryDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (!expiryDate) return { status: 'unknown', daysLeft: null };
  
  const expiry = parseDate(expiryDate);
  if (!expiry) return { status: 'invalid', daysLeft: null };
  
  const daysLeft = differenceInDays(expiry, today);
  
  if (isBefore(expiry, today)) {
    return { status: 'expired', daysLeft };
  } else if (daysLeft <= WARNING_DAYS) {
    return { status: 'warning', daysLeft };
  } else {
    return { status: 'valid', daysLeft };
  }
}

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export function getCurrentDate() {
  return formatDate(new Date());
}
