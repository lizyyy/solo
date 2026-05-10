const ReservationModel = require('../models/ReservationModel');
const TableModel = require('../models/TableModel');
const ScriptModel = require('../models/ScriptModel');
const HostModel = require('../models/HostModel');
const WaitlistModel = require('../models/WaitlistModel');
const { get, run } = require('../models/database');
const { addMinutes, format } = require('date-fns');

class ReservationService {
  static calculateEndTime(startTime, durationMinutes) {
    const [hours, minutes] = startTime.split(':').map(Number);
    const date = new Date(2000, 0, 1, hours, minutes);
    const endDate = addMinutes(date, durationMinutes);
    return format(endDate, 'HH:mm');
  }

  static async validateReservation(data, excludeId = null) {
    const errors = [];

    if (!data.script_id) {
      errors.push('请选择剧本');
      return { valid: false, errors };
    }

    const script = await ScriptModel.getById(data.script_id);
    if (!script) {
      errors.push('剧本不存在');
      return { valid: false, errors };
    }

    if (data.reservation_type === 'private' && data.player_count < script.min_players) {
      errors.push(`玩家人数不足，包场最少需要 ${script.min_players} 人`);
    }
    if (data.player_count > script.max_players) {
      errors.push(`玩家人数超出上限，最多 ${script.max_players} 人`);
    }

    const endTime = data.end_time || this.calculateEndTime(data.start_time, script.duration_minutes);

    if (!data.table_id) {
      errors.push('请选择桌位');
      return { valid: false, errors };
    }

    const table = await TableModel.getById(data.table_id);
    if (!table) {
      errors.push('桌位不存在');
    }

    if (data.reservation_type === 'shared' && data.player_count > table.capacity) {
      errors.push(`桌位容量不足，该桌最多容纳 ${table.capacity} 人`);
    }

    const tableConflicts = await ReservationModel.getTableConflicts(
      data.table_id, data.date, data.start_time, endTime, excludeId
    );

    if (tableConflicts.length > 0) {
      const conflict = tableConflicts[0];
      if (conflict.reservation_type === 'private') {
        errors.push(`时间冲突：该桌位 ${conflict.start_time}-${conflict.end_time} 已被包场`);
      } else if (data.reservation_type === 'private') {
        errors.push(`时间冲突：该桌位 ${conflict.start_time}-${conflict.end_time} 已有散客拼桌`);
      } else {
        const totalPlayers = data.player_count + conflict.player_count;
        if (totalPlayers > table.capacity) {
          errors.push(`拼桌容量不足：当前已有 ${conflict.player_count} 人，加上您的 ${data.player_count} 人超出桌位上限 ${table.capacity} 人`);
        }
      }
    }

    let hostConflicts = [];
    if (data.host_id) {
      const host = await HostModel.getById(data.host_id);
      if (!host) {
        errors.push('主持人不存在');
      } else {
        const isOnLeave = await HostModel.isHostOnLeave(data.host_id, data.date, data.start_time, endTime);
        if (isOnLeave) {
          errors.push(`主持人 ${host.name} 在该时间段请假`);
        }

        hostConflicts = await ReservationModel.getHostConflicts(
          data.host_id, data.date, data.start_time, endTime, excludeId
        );
        if (hostConflicts.length > 0) {
          errors.push(`主持人 ${host.name} 在该时间段已有安排`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      conflicts: {
        table: tableConflicts,
        host: hostConflicts
      }
    };
  }

  static async createReservation(data, idempotencyKey, actor = 'system') {
    if (idempotencyKey) {
      const existing = await ReservationModel.getByIdempotencyKey(idempotencyKey);
      if (existing) {
        return {
          idempotent: true,
          reservation: existing,
          message: '预约已存在（幂等操作）'
        };
      }
    }

    const script = await ScriptModel.getById(data.script_id);
    const endTime = this.calculateEndTime(data.start_time, script.duration_minutes);

    const validation = await this.validateReservation(data);
    if (!validation.valid) {
      return {
        success: false,
        errors: validation.errors,
        conflicts: validation.conflicts
      };
    }

    const totalAmount = this.calculateTotalAmount(data, script);

    const reservationData = {
      ...data,
      end_time: endTime,
      total_amount: totalAmount
    };

    const reservation = await ReservationModel.create(reservationData, idempotencyKey);
    await ReservationModel.addHistory(reservation.id, 'create', null, reservation, actor);

    return {
      success: true,
      idempotent: false,
      reservation
    };
  }

  static calculateTotalAmount(data, script) {
    let baseAmount = script.price;
    if (data.reservation_type === 'private') {
      baseAmount *= 1.5;
    }
    return Math.round(baseAmount * 100) / 100;
  }

  static async updateReservation(id, data, actor = 'system') {
    const oldReservation = await ReservationModel.getById(id);
    if (!oldReservation) {
      return { success: false, errors: ['预约不存在'] };
    }

    const script = await ScriptModel.getById(data.script_id);
    const endTime = this.calculateEndTime(data.start_time, script.duration_minutes);

    const validation = await this.validateReservation(data, id);
    if (!validation.valid) {
      return {
        success: false,
        errors: validation.errors,
        conflicts: validation.conflicts
      };
    }

    const totalAmount = this.calculateTotalAmount(data, script);

    const updateData = {
      ...data,
      end_time: endTime,
      total_amount: totalAmount
    };

    const reservation = await ReservationModel.update(id, updateData);

    const changes = this.detectChanges(oldReservation, reservation);
    if (Object.keys(changes).length > 0) {
      await ReservationModel.addHistory(id, 'update', oldReservation, reservation, actor);
    }

    return {
      success: true,
      reservation,
      changes
    };
  }

  static detectChanges(oldObj, newObj) {
    const changes = {};
    const fields = ['customer_name', 'customer_phone', 'table_id', 'script_id', 'host_id',
                    'date', 'start_time', 'end_time', 'player_count', 'status', 'notes'];
    for (const field of fields) {
      if (oldObj[field] !== newObj[field]) {
        changes[field] = { old: oldObj[field], new: newObj[field] };
      }
    }
    return changes;
  }

  static async cancelReservation(id, actor = 'system') {
    const reservation = await ReservationModel.getById(id);
    if (!reservation) {
      return { success: false, errors: ['预约不存在'] };
    }

    const updated = await ReservationModel.updateStatus(id, 'cancelled');
    await ReservationModel.addHistory(id, 'cancel', reservation, updated, actor);

    return {
      success: true,
      reservation: updated
    };
  }

  static async convertWaitlistToReservation(waitlistId, data, idempotencyKey, actor = 'system') {
    const waitlist = await WaitlistModel.getById(waitlistId);
    if (!waitlist) {
      return { success: false, errors: ['候补记录不存在'] };
    }

    if (waitlist.status !== 'waiting') {
      return { success: false, errors: ['该候补已处理'] };
    }

    const duplicateCheck = await get(
      'SELECT * FROM reservations WHERE waitlist_id = ?',
      [waitlistId]
    );

    if (duplicateCheck) {
      return {
        idempotent: true,
        reservation: duplicateCheck,
        message: '已从候补转正（幂等操作）'
      };
    }

    const reservationData = {
      customer_name: waitlist.customer_name,
      customer_phone: waitlist.customer_phone,
      script_id: waitlist.script_id,
      date: waitlist.date,
      start_time: waitlist.start_time,
      player_count: waitlist.player_count,
      reservation_type: 'shared',
      status: 'confirmed',
      waitlist_id: waitlistId,
      ...data
    };

    const result = await this.createReservation(reservationData, idempotencyKey, actor);

    if (result.success) {
      await WaitlistModel.updateStatus(waitlistId, 'converted');
    }

    return result;
  }

  static async addToWaitlist(data, idempotencyKey, actor = 'system') {
    if (idempotencyKey) {
      const existing = await WaitlistModel.getByIdempotencyKey(idempotencyKey);
      if (existing) {
        return {
          idempotent: true,
          waitlist: existing,
          message: '候补已存在（幂等操作）'
        };
      }
    }

    const duplicate = await WaitlistModel.checkDuplicate(
      data.customer_phone, data.script_id, data.date
    );

    if (duplicate) {
      return {
        success: false,
        errors: ['该顾客已在同一剧本的候补队列中']
      };
    }

    const waitlist = await WaitlistModel.create(data, idempotencyKey);

    return {
      success: true,
      idempotent: false,
      waitlist
    };
  }
}

module.exports = ReservationService;
