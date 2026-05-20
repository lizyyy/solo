import { v4 as uuidv4 } from 'uuid';
import { FEVER_THRESHOLD, MEDICATION_EXPIRY_WARNING_DAYS } from '../constants';

export const generateId = (): string => {
  return uuidv4();
};

export const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

export const parseDate = (dateStr: string): Date => {
  return new Date(dateStr);
};

export const isDateValid = (dateStr: string): boolean => {
  const date = parseDate(dateStr);
  return !isNaN(date.getTime());
};

export const daysBetween = (date1: string, date2: string): number => {
  const d1 = parseDate(date1);
  const d2 = parseDate(date2);
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

export const isFever = (temperature: number): boolean => {
  return temperature >= FEVER_THRESHOLD;
};

export const isMedicationExpiringSoon = (expiryDate: string, checkDate: string): boolean => {
  const days = daysBetween(expiryDate, checkDate);
  return days <= MEDICATION_EXPIRY_WARNING_DAYS;
};

export const isMedicationExpired = (expiryDate: string, checkDate: string): boolean => {
  const expiry = parseDate(expiryDate);
  const check = parseDate(checkDate);
  return check > expiry;
};