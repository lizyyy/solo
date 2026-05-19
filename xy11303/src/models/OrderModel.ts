import { getDb, generateId, now, generateNo } from './database';
import { Order } from '../types';

export class OrderModel {
  static create(data: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>): Order {
    const db = getDb();
    const id = generateId();
    const createdAt = now();
    const updatedAt = now();
    
    const stmt = db.prepare(`
      INSERT INTO orders (id, order_no, homestay_id, homestay_name, guest_name, guest_phone,
        check_in_date, check_out_date, room_count, cleaning_fee, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(id, data.orderNo, data.homestayId, data.homestayName, data.guestName, data.guestPhone,
      data.checkInDate, data.checkOutDate, data.roomCount, data.cleaningFee, data.status, createdAt, updatedAt);
    
    return this.getById(id)!;
  }

  static getById(id: string): Order | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as any;
    return row ? this.mapRow(row) : null;
  }

  static getByOrderNo(orderNo: string): Order | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM orders WHERE order_no = ?').get(orderNo) as any;
    return row ? this.mapRow(row) : null;
  }

  static list(filters: { homestayId?: string; startDate?: string; endDate?: string; status?: string } = {}): Order[] {
    const db = getDb();
    let sql = 'SELECT * FROM orders WHERE 1=1';
    const params: any[] = [];
    
    if (filters.homestayId) {
      sql += ' AND homestay_id = ?';
      params.push(filters.homestayId);
    }
    if (filters.startDate) {
      sql += ' AND check_in_date >= ?';
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      sql += ' AND check_in_date <= ?';
      params.push(filters.endDate);
    }
    if (filters.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }
    
    sql += ' ORDER BY created_at DESC';
    
    const rows = db.prepare(sql).all(...params) as any[];
    return rows.map(row => this.mapRow(row));
  }

  static update(id: string, data: Partial<Order>): Order | null {
    const db = getDb();
    const updates: string[] = [];
    const params: any[] = [];
    
    const fieldMap: Record<string, string> = {
      homestayName: 'homestay_name',
      guestName: 'guest_name',
      guestPhone: 'guest_phone',
      checkInDate: 'check_in_date',
      checkOutDate: 'check_out_date',
      roomCount: 'room_count',
      cleaningFee: 'cleaning_fee',
      status: 'status'
    };
    
    for (const [key, value] of Object.entries(data)) {
      const dbField = fieldMap[key] || key;
      if (value !== undefined && dbField !== 'id' && dbField !== 'created_at') {
        updates.push(`${dbField} = ?`);
        params.push(value);
      }
    }
    
    if (updates.length === 0) return this.getById(id);
    
    updates.push('updated_at = ?');
    params.push(now());
    params.push(id);
    
    const sql = `UPDATE orders SET ${updates.join(', ')} WHERE id = ?`;
    db.prepare(sql).run(...params);
    
    return this.getById(id);
  }

  private static mapRow(row: any): Order {
    return {
      id: row.id,
      orderNo: row.order_no,
      homestayId: row.homestay_id,
      homestayName: row.homestay_name,
      guestName: row.guest_name,
      guestPhone: row.guest_phone,
      checkInDate: row.check_in_date,
      checkOutDate: row.check_out_date,
      roomCount: row.room_count,
      cleaningFee: row.cleaning_fee,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}
