import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import crypto from 'crypto';
import fs from 'fs';

export function generateId(): string {
  return uuidv4();
}

export function now(): string {
  return dayjs().format('YYYY-MM-DD HH:mm:ss');
}

export function formatDate(date: Date | string): string {
  return dayjs(date).format('YYYY-MM-DD HH:mm:ss');
}

export function parseDate(dateStr: string): dayjs.Dayjs {
  return dayjs(dateStr);
}

export function isSameDay(date1: string, date2: string): boolean {
  return dayjs(date1).isSame(dayjs(date2), 'day');
}

export function isAfter(date1: string, date2: string): boolean {
  return dayjs(date1).isAfter(dayjs(date2));
}

export function isBefore(date1: string, date2: string): boolean {
  return dayjs(date1).isBefore(dayjs(date2));
}

export function addDays(date: string, days: number): string {
  return dayjs(date).add(days, 'day').format('YYYY-MM-DD HH:mm:ss');
}

export function fileHash(filePath: string): string {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
}

export function stringHash(str: string): string {
  return crypto.createHash('sha256').update(str).digest('hex');
}

export function validatePhone(phone: string): boolean {
  return /^1[3-9]\d{9}$/.test(phone);
}

export function validateIdCard(idCard: string): boolean {
  const reg = /(^\d{15}$)|(^\d{18}$)|(^\d{17}(\d|X|x)$)/;
  return reg.test(idCard);
}

export function validatePlateNumber(plate: string): boolean {
  const reg = /^[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼使领][A-HJ-NP-Z][A-HJ-NP-Z0-9]{4,5}[A-HJ-NP-Z0-9挂学警港澳]$/;
  return reg.test(plate);
}

export function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength) + '...';
}

export function safeJsonParse<T = any>(str: string, defaultValue: T | null = null): T | null {
  try {
    return JSON.parse(str) as T;
  } catch {
    return defaultValue;
  }
}

export function safeJsonStringify(obj: any): string {
  try {
    return JSON.stringify(obj);
  } catch {
    return '{}';
  }
}
