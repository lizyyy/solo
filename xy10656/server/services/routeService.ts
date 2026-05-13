import db from '../db';
import { v4 as uuidv4 } from 'uuid';
import { logChange } from './changeLogService';

export interface Route {
  id: string;
  name: string;
  routeNo: string;
  driverName?: string;
  driverPhone?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface Stop {
  id: string;
  routeId: string;
  name: string;
  address?: string;
  orderIndex: number;
  morningTime?: string;
  eveningTime?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export function getRoutes(params?: { search?: string; status?: string }) {
  let query = 'SELECT * FROM routes WHERE 1=1';
  const queryParams: any[] = [];

  if (params?.search) {
    query += ' AND (name LIKE ? OR routeNo LIKE ? OR driverName LIKE ?)';
    const searchTerm = `%${params.search}%`;
    queryParams.push(searchTerm, searchTerm, searchTerm);
  }

  if (params?.status) {
    query += ' AND status = ?';
    queryParams.push(params.status);
  }

  query += ' ORDER BY createdAt DESC';

  const stmt = db.prepare(query);
  return stmt.all(...queryParams) as Route[];
}

export function getRouteById(id: string) {
  const stmt = db.prepare('SELECT * FROM routes WHERE id = ?');
  return stmt.get(id) as Route | undefined;
}

export function createRoute(data: Omit<Route, 'id' | 'createdAt' | 'updatedAt'>, operator?: string) {
  const id = uuidv4();
  const stmt = db.prepare(`
    INSERT INTO routes (id, name, routeNo, driverName, driverPhone, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    id,
    data.name,
    data.routeNo,
    data.driverName,
    data.driverPhone,
    data.status || 'active'
  );
  return getRouteById(id);
}

export function updateRoute(id: string, data: Partial<Route>, operator?: string) {
  const route = getRouteById(id);
  if (!route) throw new Error('Route not found');

  const fields = Object.keys(data).filter(k => k !== 'id' && k !== 'createdAt' && k !== 'updatedAt');
  if (fields.length === 0) return route;

  fields.forEach(field => {
    const oldValue = (route as any)[field];
    const newValue = (data as any)[field];
    if (oldValue !== newValue) {
      logChange('route', id, field, oldValue, newValue, operator, '更新线路信息');
    }
  });

  const setClause = fields.map(f => `${f} = ?`).join(', ');
  const params = fields.map(f => (data as any)[f]);
  params.push(id);

  const stmt = db.prepare(`UPDATE routes SET ${setClause}, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`);
  stmt.run(...params);

  return getRouteById(id);
}

export function getStops(routeId?: string) {
  let query = 'SELECT * FROM stops WHERE 1=1';
  const params: any[] = [];

  if (routeId) {
    query += ' AND routeId = ?';
    params.push(routeId);
  }

  query += ' ORDER BY routeId, orderIndex';

  const stmt = db.prepare(query);
  return stmt.all(...params) as Stop[];
}

export function getStopById(id: string) {
  const stmt = db.prepare('SELECT * FROM stops WHERE id = ?');
  return stmt.get(id) as Stop | undefined;
}

export function createStop(data: Omit<Stop, 'id' | 'createdAt' | 'updatedAt'>, operator?: string) {
  const id = uuidv4();
  const stmt = db.prepare(`
    INSERT INTO stops (id, routeId, name, address, orderIndex, morningTime, eveningTime, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    id,
    data.routeId,
    data.name,
    data.address,
    data.orderIndex,
    data.morningTime,
    data.eveningTime,
    data.status || 'active'
  );
  return getStopById(id);
}

export function updateStop(id: string, data: Partial<Stop>, operator?: string) {
  const stop = getStopById(id);
  if (!stop) throw new Error('Stop not found');

  const fields = Object.keys(data).filter(k => k !== 'id' && k !== 'createdAt' && k !== 'updatedAt');
  if (fields.length === 0) return stop;

  fields.forEach(field => {
    const oldValue = (stop as any)[field];
    const newValue = (data as any)[field];
    if (oldValue !== newValue) {
      logChange('stop', id, field, oldValue, newValue, operator, '更新站点信息');
    }
  });

  const setClause = fields.map(f => `${f} = ?`).join(', ');
  const params = fields.map(f => (data as any)[f]);
  params.push(id);

  const stmt = db.prepare(`UPDATE stops SET ${setClause}, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`);
  stmt.run(...params);

  return getStopById(id);
}
