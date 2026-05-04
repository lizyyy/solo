const db = require('../config/database');
const { NotFoundError, ValidationError } = require('../utils/errors');
const { calculateSettlement, calculateOvertimeFee, checkDepositSufficient } = require('../services/pricingService');
const { BOOKING_STATES, updateBookingStatus, getStateDisplayName, isModifiableState } = require('../services/bookingStateService');

function previewSettlement(req, res, next) {
  try {
    const { id } = req.params;
    const { actualEndTime, damageRecords } = req.body;
    
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(id);
    if (!booking) {
      throw new NotFoundError('预约不存在', 'booking');
    }
    
    if (!isModifiableState(booking.status)) {
      throw new ValidationError(`预约状态 "${getStateDisplayName(booking.status)}" 不允许结算`, 'status');
    }
    
    const endTime = actualEndTime || new Date().toISOString();
    const damages = damageRecords || [];
    
    const settlement = calculateSettlement(id, endTime, damages);
    
    res.json({
      success: true,
      data: {
        bookingId: id,
        bookingNumber: booking.booking_number,
        currentStatus: booking.status,
        settlementPreview: settlement
      }
    });
  } catch (err) {
    next(err);
  }
}

function processSettlement(req, res, next) {
  try {
    const { id } = req.params;
    const { 
      actualEndTime, 
      damageRecords, 
      additionalPaymentAmount,
      refundAmount,
      paymentMethod,
      notes,
      processedBy
    } = req.body;
    
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(id);
    if (!booking) {
      throw new NotFoundError('预约不存在', 'booking');
    }
    
    if (booking.status === BOOKING_STATES.SETTLED) {
      throw new ValidationError('预约已结清，无法重复结算', 'status');
    }
    
    const endTime = actualEndTime || new Date().toISOString();
    const damages = damageRecords || [];
    
    const settlement = calculateSettlement(id, endTime, damages);
    
    if (settlement.needsAdditionalPayment) {
      if (!additionalPaymentAmount || Number(additionalPaymentAmount) < settlement.additionalPaymentAmount) {
        throw new ValidationError(
          `需要补收 ${settlement.additionalPaymentAmount} 元，请提供足够的补收金额`,
          'additionalPaymentAmount'
        );
      }
    }
    
    if (settlement.needsRefund) {
      if (refundAmount === undefined || Number(refundAmount) > settlement.refundAmount) {
        throw new ValidationError(
          `可退还金额为 ${settlement.refundAmount} 元，退款金额不能超过此数额`,
          'refundAmount'
        );
      }
    }
    
    db.transaction(() => {
      if (settlement.overtimeAmount > 0) {
        db.prepare(`
          UPDATE bookings SET overtime_amount = ?, actual_end_time = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
        `).run(settlement.overtimeAmount, endTime, id);
      } else {
        db.prepare(`
          UPDATE bookings SET actual_end_time = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
        `).run(endTime, id);
      }
      
      if (damages && damages.length > 0) {
        const damageStmt = db.prepare(`
          INSERT INTO damage_records (booking_id, device_id, room_id, damage_type, description, estimated_cost, status, reported_by, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        damages.forEach(damage => {
          damageStmt.run(
            id,
            damage.deviceId || null,
            damage.roomId || null,
            damage.damageType || 'unknown',
            damage.description || '',
            Number(damage.estimatedCost || 0),
            'reported',
            processedBy || null,
            damage.notes || null
          );
        });
        
        const totalDamageAmount = damages.reduce((sum, d) => sum + Number(d.estimatedCost || 0), 0);
        db.prepare(`
          UPDATE bookings SET damage_amount = ?, total_amount = base_amount + device_amount + overtime_amount + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
        `).run(totalDamageAmount, totalDamageAmount, id);
      }
      
      if (settlement.needsAdditionalPayment && additionalPaymentAmount) {
        const transactionStmt = db.prepare(`
          INSERT INTO deposit_transactions (booking_id, transaction_type, amount, payment_method, notes, created_by)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        transactionStmt.run(
          id,
          'additional_payment',
          Number(additionalPaymentAmount),
          paymentMethod || null,
          notes || '补收费用',
          processedBy || null
        );
      }
      
      if (settlement.needsRefund && refundAmount && Number(refundAmount) > 0) {
        const transactionStmt = db.prepare(`
          INSERT INTO deposit_transactions (booking_id, transaction_type, amount, payment_method, notes, created_by)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        transactionStmt.run(
          id,
          'refund',
          -Number(refundAmount),
          paymentMethod || null,
          notes || '退还押金',
          processedBy || null
        );
      }
      
      updateBookingStatus(id, BOOKING_STATES.SETTLED, processedBy, '结算完成');
      
      db.prepare(`
        UPDATE booking_devices SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE booking_id = ?
      `).run('returned', id);
      
    })();
    
    const updatedBooking = db.prepare(`
      SELECT b.*, 
             r.name as room_name,
             c.name as customer_name
      FROM bookings b
      JOIN rooms r ON b.room_id = r.id
      JOIN customers c ON b.customer_id = c.id
      WHERE b.id = ?
    `).get(id);
    
    const transactions = db.prepare(`
      SELECT * FROM deposit_transactions WHERE booking_id = ? ORDER BY created_at DESC
    `).all(id);
    
    const finalDamages = db.prepare(`
      SELECT dr.*, d.name as device_name, r.name as room_name
      FROM damage_records dr
      LEFT JOIN devices d ON dr.device_id = d.id
      LEFT JOIN rooms r ON dr.room_id = r.id
      WHERE dr.booking_id = ?
    `).all(id);
    
    res.json({
      success: true,
      data: {
        booking: updatedBooking,
        settlementDetails: settlement,
        depositTransactions: transactions,
        damageRecords: finalDamages
      },
      message: '结算完成'
    });
  } catch (err) {
    next(err);
  }
}

function recordDamage(req, res, next) {
  try {
    const { id } = req.params;
    const { deviceId, roomId, damageType, description, estimatedCost, reportedBy, notes } = req.body;
    
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(id);
    if (!booking) {
      throw new NotFoundError('预约不存在', 'booking');
    }
    
    if (!isModifiableState(booking.status)) {
      throw new ValidationError(`预约状态 "${getStateDisplayName(booking.status)}" 不允许记录损耗`, 'status');
    }
    
    if (!description) {
      throw new ValidationError('请提供损耗描述', 'description');
    }
    
    const stmt = db.prepare(`
      INSERT INTO damage_records (booking_id, device_id, room_id, damage_type, description, estimated_cost, status, reported_by, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      id,
      deviceId || null,
      roomId || null,
      damageType || 'unknown',
      description,
      Number(estimatedCost || 0),
      'reported',
      reportedBy || null,
      notes || null
    );
    
    const damageRecord = db.prepare(`
      SELECT dr.*, d.name as device_name, r.name as room_name
      FROM damage_records dr
      LEFT JOIN devices d ON dr.device_id = d.id
      LEFT JOIN rooms r ON dr.room_id = r.id
      WHERE dr.id = ?
    `).get(result.lastInsertRowid);
    
    res.status(201).json({
      success: true,
      data: damageRecord
    });
  } catch (err) {
    next(err);
  }
}

function getDepositTransactions(req, res, next) {
  try {
    const { id } = req.params;
    
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(id);
    if (!booking) {
      throw new NotFoundError('预约不存在', 'booking');
    }
    
    const transactions = db.prepare(`
      SELECT * FROM deposit_transactions WHERE booking_id = ? ORDER BY created_at DESC
    `).all(id);
    
    const summary = transactions.reduce((acc, t) => {
      if (t.transaction_type === 'deposit') acc.deposit += t.amount;
      if (t.transaction_type === 'refund') acc.refund += Math.abs(t.amount);
      if (t.transaction_type === 'additional_payment') acc.additionalPayment += t.amount;
      return acc;
    }, { deposit: 0, refund: 0, additionalPayment: 0 });
    
    res.json({
      success: true,
      data: {
        bookingId: id,
        bookingNumber: booking.booking_number,
        summary: {
          totalDeposit: Number(summary.deposit.toFixed(2)),
          totalRefund: Number(summary.refund.toFixed(2)),
          totalAdditionalPayment: Number(summary.additionalPayment.toFixed(2)),
          currentDeposit: Number((summary.deposit - summary.refund + summary.additionalPayment).toFixed(2))
        },
        transactions
      }
    });
  } catch (err) {
    next(err);
  }
}

function extendBooking(req, res, next) {
  try {
    const { id } = req.params;
    const { newEndTime, extendedBy } = req.body;
    
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(id);
    if (!booking) {
      throw new NotFoundError('预约不存在', 'booking');
    }
    
    if (!isModifiableState(booking.status)) {
      throw new ValidationError(`预约状态 "${getStateDisplayName(booking.status)}" 不允许延长`, 'status');
    }
    
    if (!newEndTime) {
      throw new ValidationError('请提供新的结束时间', 'newEndTime');
    }
    
    if (new Date(newEndTime) <= new Date(booking.end_time)) {
      throw new ValidationError('新的结束时间必须晚于当前结束时间', 'newEndTime');
    }
    
    const currentDeviceIds = db.prepare('SELECT device_id FROM booking_devices WHERE booking_id = ?').all(id).map(d => d.device_id);
    
    const { validateBookingModification } = require('../services/conflictService');
    validateBookingModification(id, booking.room_id, booking.start_time, newEndTime, currentDeviceIds);
    
    const originalOvertime = calculateOvertimeFee(id, newEndTime);
    
    const { calculateDurationHours } = require('../services/pricingService');
    const extendHours = calculateDurationHours(booking.end_time, newEndTime);
    
    const room = db.prepare('SELECT base_rate_per_hour FROM rooms WHERE id = ?').get(booking.room_id);
    const baseRate = room.base_rate_per_hour;
    const extendFee = baseRate * extendHours;
    
    let deviceExtendFee = 0;
    if (currentDeviceIds.length > 0) {
      const placeholders = currentDeviceIds.map(() => '?').join(',');
      const devices = db.prepare(`
        SELECT bd.rental_rate FROM booking_devices bd
        WHERE bd.booking_id = ? AND bd.device_id IN (${placeholders})
      `).all(id, ...currentDeviceIds);
      
      deviceExtendFee = devices.reduce((sum, d) => sum + d.rental_rate * extendHours, 0);
    }
    
    const totalExtendFee = extendFee + deviceExtendFee;
    
    db.transaction(() => {
      const newBaseAmount = booking.base_amount + extendFee;
      const newDeviceAmount = booking.device_amount + deviceExtendFee;
      const newTotalAmount = booking.total_amount + totalExtendFee;
      
      db.prepare(`
        UPDATE bookings 
        SET end_time = ?, base_amount = ?, device_amount = ?, total_amount = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(newEndTime, newBaseAmount, newDeviceAmount, newTotalAmount, id);
      
    })();
    
    const updatedBooking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(id);
    
    const currentDeposit = booking.deposit_amount || 0;
    const { calculateDepositRequired } = require('../services/pricingService');
    const newDepositRequired = calculateDepositRequired(booking.room_id, currentDeviceIds);
    
    res.json({
      success: true,
      data: {
        booking: updatedBooking,
        extensionDetails: {
          originalEndTime: booking.end_time,
          newEndTime,
          extendHours,
          roomExtendFee: Number(extendFee.toFixed(2)),
          deviceExtendFee: Number(deviceExtendFee.toFixed(2)),
          totalExtendFee: Number(totalExtendFee.toFixed(2))
        },
        depositWarning: {
          currentDeposit,
          requiredDeposit: newDepositRequired.totalDeposit,
          deficit: Math.max(0, newDepositRequired.totalDeposit - currentDeposit)
        }
      },
      message: `预约已延长 ${extendHours} 小时`
    });
  } catch (err) {
    next(err);
  }
}

function changeRoom(req, res, next) {
  try {
    const { id } = req.params;
    const { newRoomId, changedBy, notes } = req.body;
    
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(id);
    if (!booking) {
      throw new NotFoundError('预约不存在', 'booking');
    }
    
    if (!isModifiableState(booking.status)) {
      throw new ValidationError(`预约状态 "${getStateDisplayName(booking.status)}" 不允许换房`, 'status');
    }
    
    if (!newRoomId) {
      throw new ValidationError('请指定新房间', 'newRoomId');
    }
    
    if (newRoomId === booking.room_id) {
      throw new ValidationError('新房间不能与当前房间相同', 'newRoomId');
    }
    
    const newRoom = db.prepare('SELECT * FROM rooms WHERE id = ? AND status = ?').get(newRoomId, 'active');
    if (!newRoom) {
      throw new NotFoundError('新房间不存在或不可用', 'room');
    }
    
    const currentDeviceIds = db.prepare('SELECT device_id FROM booking_devices WHERE booking_id = ?').all(id).map(d => d.device_id);
    
    const { validateBookingModification } = require('../services/conflictService');
    validateBookingModification(id, newRoomId, booking.start_time, booking.end_time, currentDeviceIds);
    
    const oldRoom = db.prepare('SELECT name, base_rate_per_hour FROM rooms WHERE id = ?').get(booking.room_id);
    
    const { calculateDurationHours, calculateRoomFee } = require('../services/pricingService');
    const durationHours = calculateDurationHours(booking.start_time, booking.end_time);
    const newRoomFee = calculateRoomFee(newRoomId, booking.start_time, booking.end_time);
    
    const priceDifference = newRoomFee.totalAmount - booking.base_amount;
    
    db.transaction(() => {
      const newTotalAmount = booking.total_amount + priceDifference;
      
      db.prepare(`
        UPDATE bookings 
        SET room_id = ?, base_amount = ?, total_amount = ?, notes = COALESCE(?, notes), updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(newRoomId, newRoomFee.totalAmount, newTotalAmount, notes, id);
      
    })();
    
    const updatedBooking = db.prepare(`
      SELECT b.*, r.name as room_name
      FROM bookings b
      JOIN rooms r ON b.room_id = r.id
      WHERE b.id = ?
    `).get(id);
    
    res.json({
      success: true,
      data: {
        booking: updatedBooking,
        roomChangeDetails: {
          oldRoomId: booking.room_id,
          oldRoomName: oldRoom.name,
          oldRoomRate: oldRoom.base_rate_per_hour,
          newRoomId,
          newRoomName: newRoom.name,
          newRoomRate: newRoom.base_rate_per_hour,
          priceDifference: Number(priceDifference.toFixed(2)),
          newTotalAmount: updatedBooking.total_amount
        }
      },
      message: `已从 ${oldRoom.name} 更换到 ${newRoom.name}`
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  previewSettlement,
  processSettlement,
  recordDamage,
  getDepositTransactions,
  extendBooking,
  changeRoom
};
