import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { db } from '../database';
import { Booking, BookingStatus, StatusLog, Customer, Room } from '../types';

const LATE_THRESHOLD_MINUTES = 15;

interface CreateBookingRequest {
  storeId: string;
  roomId: string;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  startTime: string;
  endTime: string;
  notes?: string;
}

export function checkRoomAvailability(
  roomId: string,
  startTime: string,
  endTime: string,
  excludeBookingId?: string
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    let query = `
      SELECT COUNT(*) as count FROM bookings 
      WHERE roomId = ? 
      AND status NOT IN ('cancelled', 'late_released', 'completed', 'room_changed')
      AND (
        (startTime < ? AND endTime > ?)
      )
    `;
    const params = [roomId, endTime, startTime];
    
    if (excludeBookingId) {
      query += ' AND id != ?';
      params.push(excludeBookingId);
    }
    
    db.get(query, params, (err: Error | null, row: any) => {
      if (err) return reject(err);
      resolve(row.count === 0);
    });
  });
}

export function getBookingsInTimeRange(roomId: string, startTime: string, endTime: string): Promise<Booking[]> {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM bookings 
       WHERE roomId = ? 
       AND status NOT IN ('cancelled', 'late_released', 'room_changed')
       AND (startTime < ? AND endTime > ?)
       ORDER BY startTime ASC`,
      [roomId, endTime, startTime],
      (err: Error | null, rows: any[]) => {
        if (err) return reject(err);
        resolve(rows);
      }
    );
  });
}

export function createBooking(request: CreateBookingRequest): Promise<Booking> {
  return new Promise(async (resolve, reject) => {
    try {
      const isAvailable = await checkRoomAvailability(
        request.roomId,
        request.startTime,
        request.endTime
      );
      
      if (!isAvailable) {
        return reject(new Error('该时段琴房已被预约'));
      }
      
      const room = await getRoomById(request.roomId);
      const start = dayjs(request.startTime);
      const end = dayjs(request.endTime);
      const hours = end.diff(start, 'hour', true);
      const totalPrice = Math.round(hours * room.pricePerHour * 100) / 100;
      
      const booking: Booking = {
        id: uuidv4(),
        ...request,
        status: 'confirmed',
        totalPrice,
        paidAmount: 0,
        isExtended: false,
        extendCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      if (!request.customerId) {
        booking.customerId = await getOrCreateCustomer(request.customerName, request.customerPhone);
      }
      
      db.run(
        `INSERT INTO bookings (id, storeId, roomId, customerId, customerName, customerPhone, 
          startTime, endTime, status, totalPrice, paidAmount, isExtended, extendCount, notes, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [booking.id, booking.storeId, booking.roomId, booking.customerId, booking.customerName, booking.customerPhone,
          booking.startTime, booking.endTime, booking.status, booking.totalPrice, booking.paidAmount,
          booking.isExtended ? 1 : 0, booking.extendCount, booking.notes, booking.createdAt, booking.updatedAt],
        async (err: Error | null) => {
          if (err) return reject(err);
          await addStatusLog(booking.id, undefined, 'confirmed', '前台', '新建预约');
          resolve(booking);
        }
      );
    } catch (err) {
      reject(err);
    }
  });
}

export function checkInBooking(bookingId: string): Promise<Booking> {
  return new Promise(async (resolve, reject) => {
    try {
      const booking = await getBookingById(bookingId);
      if (!booking) return reject(new Error('预约不存在'));
      
      if (booking.status !== 'confirmed') {
        return reject(new Error(`当前状态无法办理签到`));
      }
      
      const now = dayjs();
      const scheduledStart = dayjs(booking.startTime);
      const lateMinutes = now.diff(scheduledStart, 'minute');
      
      if (lateMinutes > LATE_THRESHOLD_MINUTES) {
        return reject(new Error(`已超过迟到限制（${LATE_THRESHOLD_MINUTES}分钟），请重新预约`));
      }
      
      const updatedBooking: Booking = {
        ...booking,
        status: 'in_use',
        checkInTime: now.toISOString(),
        lateMinutes: Math.max(0, lateMinutes),
        updatedAt: now.toISOString()
      };
      
      db.run(
        `UPDATE bookings SET status = ?, checkInTime = ?, lateMinutes = ?, updatedAt = ? WHERE id = ?`,
        ['in_use', updatedBooking.checkInTime, updatedBooking.lateMinutes, updatedBooking.updatedAt, bookingId],
        async (err: Error | null) => {
          if (err) return reject(err);
          await addStatusLog(bookingId, booking.status, 'in_use', '前台', `办理签到${lateMinutes > 0 ? `（迟到${lateMinutes}分钟）` : ''}`);
          resolve(updatedBooking);
        }
      );
    } catch (err) {
      reject(err);
    }
  });
}

export function releaseLateBooking(bookingId: string): Promise<Booking> {
  return new Promise(async (resolve, reject) => {
    try {
      const booking = await getBookingById(bookingId);
      if (!booking) return reject(new Error('预约不存在'));
      
      if (booking.status !== 'confirmed') {
        return reject(new Error('当前状态无法释放'));
      }
      
      const now = dayjs();
      const scheduledStart = dayjs(booking.startTime);
      const lateMinutes = now.diff(scheduledStart, 'minute');
      
      const updatedBooking: Booking = {
        ...booking,
        status: 'late_released',
        lateMinutes,
        updatedAt: now.toISOString()
      };
      
      db.run(
        `UPDATE bookings SET status = ?, lateMinutes = ?, updatedAt = ? WHERE id = ?`,
        ['late_released', lateMinutes, updatedBooking.updatedAt, bookingId],
        async (err: Error | null) => {
          if (err) return reject(err);
          await addStatusLog(bookingId, booking.status, 'late_released', '系统', `迟到${lateMinutes}分钟未签到，自动释放`);
          resolve(updatedBooking);
        }
      );
    } catch (err) {
      reject(err);
    }
  });
}

export async function extendBooking(bookingId: string, extendMinutes: number): Promise<Booking> {
  return new Promise(async (resolve, reject) => {
    try {
      const booking = await getBookingById(bookingId);
      if (!booking) return reject(new Error('预约不存在'));
      
      if (!['in_use', 'checked_in'].includes(booking.status)) {
        return reject(new Error('当前状态无法续时'));
      }
      
      const currentEnd = dayjs(booking.endTime);
      const newEnd = currentEnd.add(extendMinutes, 'minute');
      
      const conflictingBookings = await getBookingsInTimeRange(
        booking.roomId,
        currentEnd.toISOString(),
        newEnd.toISOString()
      );
      
      const realConflicts = conflictingBookings.filter(b => b.id !== bookingId);
      if (realConflicts.length > 0) {
        return reject(new Error('续时段已被其他预约占用，无法续时'));
      }
      
      const room = await getRoomById(booking.roomId);
      const extendHours = extendMinutes / 60;
      const additionalPrice = Math.round(extendHours * room.pricePerHour * 100) / 100;
      
      const newTotalPrice = booking.totalPrice + additionalPrice;
      
      const updatedBooking: Booking = {
        ...booking,
        endTime: newEnd.toISOString(),
        totalPrice: newTotalPrice,
        isExtended: true,
        extendCount: booking.extendCount + 1,
        updatedAt: new Date().toISOString()
      };
      
      if (!updatedBooking.originalEndTime) {
        updatedBooking.originalEndTime = booking.endTime;
      }
      
      db.run(
        `UPDATE bookings SET 
          endTime = ?, totalPrice = ?, isExtended = 1, extendCount = ?, updatedAt = ?, 
          originalEndTime = COALESCE(originalEndTime, ?)
         WHERE id = ?`,
        [updatedBooking.endTime, updatedBooking.totalPrice, updatedBooking.extendCount, 
          updatedBooking.updatedAt, booking.endTime, bookingId],
        async (err: Error | null) => {
          if (err) return reject(err);
          await addStatusLog(bookingId, booking.status, booking.status, '前台', `续时${extendMinutes}分钟，增加费用¥${additionalPrice}`);
          resolve(updatedBooking);
        }
      );
    } catch (err) {
      reject(err);
    }
  });
}

export function changeRoom(bookingId: string, newRoomId: string): Promise<Booking> {
  return new Promise(async (resolve, reject) => {
    try {
      const booking = await getBookingById(bookingId);
      if (!booking) return reject(new Error('预约不存在'));
      
      if (!['confirmed', 'in_use', 'checked_in'].includes(booking.status)) {
        return reject(new Error('当前状态无法换房'));
      }
      
      if (booking.roomId === newRoomId) {
        return reject(new Error('不能换至同一琴房'));
      }
      
      const isAvailable = await checkRoomAvailability(
        newRoomId,
        booking.startTime,
        booking.endTime
      );
      
      if (!isAvailable) {
        return reject(new Error('目标琴房该时段已被占用'));
      }
      
      const newRoom = await getRoomById(newRoomId);
      
      const oldBooking: Booking = {
        ...booking,
        originalRoomId: booking.roomId,
        roomId: newRoomId,
        status: 'room_changed',
        updatedAt: new Date().toISOString()
      };
      
      const newBooking: Booking = {
        ...booking,
        id: uuidv4(),
        roomId: newRoomId,
        originalRoomId: booking.roomId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      db.serialize(() => {
        db.run(
          `UPDATE bookings SET status = 'room_changed', updatedAt = ? WHERE id = ?`,
          [oldBooking.updatedAt, bookingId],
          async (err: Error | null) => {
            if (err) return reject(err);
            
            db.run(
              `INSERT INTO bookings (id, storeId, roomId, customerId, customerName, customerPhone, 
                startTime, endTime, originalRoomId, status, checkInTime, checkOutTime, 
                totalPrice, paidAmount, lateMinutes, isExtended, extendCount, notes, createdAt, updatedAt)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [newBooking.id, newBooking.storeId, newBooking.roomId, newBooking.customerId, 
                newBooking.customerName, newBooking.customerPhone, newBooking.startTime, newBooking.endTime,
                newBooking.originalRoomId, booking.status, booking.checkInTime, booking.checkOutTime,
                newBooking.totalPrice, newBooking.paidAmount, newBooking.lateMinutes,
                newBooking.isExtended ? 1 : 0, newBooking.extendCount, newBooking.notes,
                newBooking.createdAt, newBooking.updatedAt],
              async (err: Error | null) => {
                if (err) return reject(err);
                await addStatusLog(bookingId, booking.status, 'room_changed', '前台', `换房至${newRoom.name}`);
                await addStatusLog(newBooking.id, undefined, booking.status, '前台', `从${booking.roomId}换入`);
                resolve(newBooking);
              }
            );
          }
        );
      });
    } catch (err) {
      reject(err);
    }
  });
}

export function completeBooking(bookingId: string): Promise<Booking> {
  return new Promise(async (resolve, reject) => {
    try {
      const booking = await getBookingById(bookingId);
      if (!booking) return reject(new Error('预约不存在'));
      
      if (booking.status !== 'in_use') {
        return reject(new Error('当前状态无法完成'));
      }
      
      const updatedBooking: Booking = {
        ...booking,
        status: 'completed',
        checkOutTime: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      db.run(
        `UPDATE bookings SET status = ?, checkOutTime = ?, updatedAt = ? WHERE id = ?`,
        ['completed', updatedBooking.checkOutTime, updatedBooking.updatedAt, bookingId],
        async (err: Error | null) => {
          if (err) return reject(err);
          await addStatusLog(bookingId, booking.status, 'completed', '前台', '退房完成');
          resolve(updatedBooking);
        }
      );
    } catch (err) {
      reject(err);
    }
  });
}

export function cancelBooking(bookingId: string, reason: string): Promise<Booking> {
  return new Promise(async (resolve, reject) => {
    try {
      const booking = await getBookingById(bookingId);
      if (!booking) return reject(new Error('预约不存在'));
      
      if (!['confirmed', 'pending'].includes(booking.status)) {
        return reject(new Error('当前状态无法取消'));
      }
      
      const updatedBooking: Booking = {
        ...booking,
        status: 'cancelled',
        updatedAt: new Date().toISOString()
      };
      
      db.run(
        `UPDATE bookings SET status = ?, updatedAt = ? WHERE id = ?`,
        ['cancelled', updatedBooking.updatedAt, bookingId],
        async (err: Error | null) => {
          if (err) return reject(err);
          await addStatusLog(bookingId, booking.status, 'cancelled', '前台', reason || '顾客取消');
          resolve(updatedBooking);
        }
      );
    } catch (err) {
      reject(err);
    }
  });
}

function getBookingById(bookingId: string): Promise<Booking | null> {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT * FROM bookings WHERE id = ?',
      [bookingId],
      (err: Error | null, row: any) => {
        if (err) return reject(err);
        resolve(row || null);
      }
    );
  });
}

function getRoomById(roomId: string): Promise<Room> {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT * FROM rooms WHERE id = ?',
      [roomId],
      (err: Error | null, row: any) => {
        if (err) return reject(err);
        if (!row) return reject(new Error('琴房不存在'));
        resolve(row);
      }
    );
  });
}

function getOrCreateCustomer(name: string, phone: string): Promise<string> {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT id FROM customers WHERE phone = ?',
      [phone],
      (err: Error | null, row: any) => {
        if (err) return reject(err);
        if (row) {
          resolve(row.id);
        } else {
          const id = uuidv4();
          db.run(
            'INSERT INTO customers (id, name, phone, createdAt) VALUES (?, ?, ?, ?)',
            [id, name, phone, new Date().toISOString()],
            (err: Error | null) => {
              if (err) return reject(err);
              resolve(id);
            }
          );
        }
      }
    );
  });
}

function addStatusLog(
  bookingId: string,
  fromStatus: BookingStatus | undefined,
  toStatus: BookingStatus,
  operator: string,
  reason: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO status_logs (id, bookingId, fromStatus, toStatus, operator, reason, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [uuidv4(), bookingId, fromStatus, toStatus, operator, reason, new Date().toISOString()],
      (err: Error | null) => {
        if (err) return reject(err);
        resolve();
      }
    );
  });
}
