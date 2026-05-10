import { v4 as uuidv4 } from 'uuid';
import { db } from '../database';
import { Store, Room, Customer, Booking, StatusLog, RevenueRecord, Statistics } from '../types';
import dayjs from 'dayjs';

export function getAllStores(): Promise<Store[]> {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM stores', (err: Error | null, rows: any[]) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

export function getAllRooms(storeId?: string): Promise<Room[]> {
  return new Promise((resolve, reject) => {
    let query = 'SELECT * FROM rooms';
    const params: any[] = [];
    if (storeId) {
      query += ' WHERE storeId = ?';
      params.push(storeId);
    }
    db.all(query, params, (err: Error | null, rows: any[]) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

export function getAllCustomers(): Promise<Customer[]> {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM customers ORDER BY createdAt DESC', (err: Error | null, rows: any[]) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

export function getBookings(params?: {
  storeId?: string;
  roomId?: string;
  status?: string[];
  startDate?: string;
  endDate?: string;
  customerName?: string;
  customerPhone?: string;
}): Promise<Booking[]> {
  return new Promise((resolve, reject) => {
    let query = 'SELECT * FROM bookings WHERE 1=1';
    const queryParams: any[] = [];
    
    if (params?.storeId) {
      query += ' AND storeId = ?';
      queryParams.push(params.storeId);
    }
    
    if (params?.roomId) {
      query += ' AND roomId = ?';
      queryParams.push(params.roomId);
    }
    
    if (params?.status && params.status.length > 0) {
      query += ` AND status IN (${params.status.map(() => '?').join(',')})`;
      queryParams.push(...params.status);
    }
    
    if (params?.startDate) {
      query += ' AND startTime >= ?';
      queryParams.push(params.startDate);
    }
    
    if (params?.endDate) {
      query += ' AND startTime <= ?';
      queryParams.push(params.endDate);
    }
    
    if (params?.customerName) {
      query += ' AND customerName LIKE ?';
      queryParams.push(`%${params.customerName}%`);
    }
    
    if (params?.customerPhone) {
      query += ' AND customerPhone LIKE ?';
      queryParams.push(`%${params.customerPhone}%`);
    }
    
    query += ' ORDER BY startTime DESC';
    
    db.all(query, queryParams, (err: Error | null, rows: any[]) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

export function getBookingById(id: string): Promise<Booking | null> {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM bookings WHERE id = ?', [id], (err: Error | null, row: any) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

export function getStatusLogs(bookingId: string): Promise<StatusLog[]> {
  return new Promise((resolve, reject) => {
    db.all(
      'SELECT * FROM status_logs WHERE bookingId = ? ORDER BY createdAt DESC',
      [bookingId],
      (err: Error | null, rows: any[]) => {
        if (err) return reject(err);
        resolve(rows);
      }
    );
  });
}

export function getStatistics(dateRange?: { start: string; end: string }): Promise<Statistics> {
  return new Promise(async (resolve, reject) => {
    let baseQuery = 'SELECT * FROM bookings WHERE 1=1';
    const params: any[] = [];
    
    if (dateRange) {
      baseQuery += ' AND startTime >= ? AND startTime <= ?';
      params.push(dateRange.start, dateRange.end);
    }
    
    const bookings = await new Promise<Booking[]>((res, rej) => {
      db.all(baseQuery, params, (err: Error | null, rows: any[]) => {
        if (err) return rej(err);
        res(rows);
      });
    });
    
    const totalBookings = bookings.length;
    const completedBookings = bookings.filter(b => b.status === 'completed').length;
    const cancelledBookings = bookings.filter(b => b.status === 'cancelled').length;
    const lateReleasedBookings = bookings.filter(b => b.status === 'late_released').length;
    const roomChangedBookings = bookings.filter(b => b.status === 'room_changed').length;
    
    const revenueBookings = bookings.filter(b => ['completed', 'in_use', 'confirmed'].includes(b.status));
    const totalRevenue = revenueBookings.reduce((sum, b) => sum + b.totalPrice, 0);
    const averageRevenue = revenueBookings.length > 0 ? totalRevenue / revenueBookings.length : 0;
    
    const customerCounts: Record<string, { customerId: string; customerName: string; bookingCount: number }> = {};
    bookings.forEach(b => {
      if (!customerCounts[b.customerId]) {
        customerCounts[b.customerId] = {
          customerId: b.customerId,
          customerName: b.customerName,
          bookingCount: 0
        };
      }
      customerCounts[b.customerId].bookingCount++;
    });
    
    const topCustomers = Object.values(customerCounts)
      .sort((a, b) => b.bookingCount - a.bookingCount)
      .slice(0, 10);
    
    const rooms = await getAllRooms();
    const roomUtilization = rooms.map(room => {
      const roomBookings = bookings.filter(b => 
        b.roomId === room.id && 
        ['completed', 'in_use', 'confirmed'].includes(b.status)
      );
      const totalMinutes = roomBookings.reduce((sum, b) => {
        return sum + dayjs(b.endTime).diff(dayjs(b.startTime), 'minute');
      }, 0);
      const utilizationRate = dateRange 
        ? Math.min(100, totalMinutes / (12 * 60 * 30)) * 100 
        : Math.min(100, totalMinutes / (12 * 60 * 30)) * 100;
      
      return {
        roomId: room.id,
        roomName: room.name,
        utilizationRate: Math.round(utilizationRate, 2)
      };
    });
    
    resolve({
      totalBookings,
      completedBookings,
      cancelledBookings,
      lateReleasedBookings,
      roomChangedBookings,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      averageRevenue: Math.round(averageRevenue * 100) / 100,
      topCustomers,
      roomUtilization
    });
  });
}

export function addRevenueRecord(record: Omit<RevenueRecord, 'id' | 'createdAt'>): Promise<RevenueRecord> {
  return new Promise((resolve, reject) => {
    const newRecord: RevenueRecord = {
      ...record,
      id: uuidv4(),
      createdAt: new Date().toISOString()
    };
    
    db.run(
      'INSERT INTO revenue_records (id, bookingId, storeId, customerId, amount, paymentMethod, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [newRecord.id, newRecord.bookingId, newRecord.storeId, newRecord.customerId, 
        newRecord.amount, newRecord.paymentMethod, newRecord.createdAt],
      (err: Error | null) => {
        if (err) return reject(err);
        resolve(newRecord);
      }
    );
  });
}
