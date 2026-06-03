import { v4 as uuidv4 } from 'uuid';

export function generateId(prefix = ''): string {
  return `${prefix}${uuidv4()}`;
}

export function generateObstructionId(): string {
  return generateId('obs_');
}

export function generateHistoryId(): string {
  return generateId('hist_');
}

export function generateRouteId(): string {
  return generateId('route_');
}

export function generateRangefinderId(): string {
  return generateId('rf_');
}
