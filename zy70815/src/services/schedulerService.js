const moment = require('moment');
const db = require('../database/db');

class SchedulerService {
  async getAvailableBerths(shipLength) {
    return await db.all(
      'SELECT * FROM berths WHERE max_length >= ? AND is_available = 1',
      [shipLength]
    );
  }

  async getTideData(date) {
    const startOfDay = moment(date).startOf('day').format('YYYY-MM-DD');
    const endOfDay = moment(date).endOf('day').format('YYYY-MM-DD HH:mm:ss');
    
    return await db.all(
      'SELECT * FROM tides WHERE time BETWEEN ? AND ? ORDER BY time ASC',
      [startOfDay, endOfDay]
    );
  }

  checkTideWindow(arrivalTime, shipDraught, tideData, berthMaxDraught) {
    const effectiveDepth = berthMaxDraught;
    const requiredDepth = shipDraught * 1.1;

    if (effectiveDepth >= requiredDepth) {
      return { available: true, message: '泊位吃水充足，无需等待潮汐' };
    }

    const arrivalMoment = moment(arrivalTime);
    
    for (const tide of tideData) {
      const tideMoment = moment(tide.time);
      const totalDepth = berthMaxDraught + tide.height;
      
      if (totalDepth >= requiredDepth) {
        const hoursDiff = tideMoment.diff(arrivalMoment, 'hours');
        if (hoursDiff >= 0 && hoursDiff <= 24) {
          return {
            available: true,
            waitUntil: tide.time,
            message: `需等待至 ${tide.time} 潮汐窗口，潮高 ${tide.height}m`,
            tideHeight: tide.height
          };
        }
      }
    }

    return {
      available: false,
      message: '24小时内无可用潮汐窗口'
    };
  }

  async scheduleShips(taskId, ships, scheduleDate) {
    const results = [];
    const berthUsage = new Map();

    let sortedShips = [...ships].sort((a, b) => {
      if (a.is_jump_queue && !b.is_jump_queue) return -1;
      if (!a.is_jump_queue && b.is_jump_queue) return 1;
      if (a.priority !== b.priority) return b.priority - a.priority;
      return moment(a.arrival_time).valueOf() - moment(b.arrival_time).valueOf();
    });

    for (const ship of sortedShips) {
      const berths = await this.getAvailableBerths(ship.length);
      
      if (berths.length === 0) {
        results.push({
          ship_name: ship.ship_name,
          imo_no: ship.imo_no,
          success: false,
          message: '无符合长度要求的可用泊位'
        });
        continue;
      }

      const tideData = await this.getTideData(scheduleDate);
      let assigned = false;

      for (const berth of berths) {
        const lastUsage = berthUsage.get(berth.id) || moment(scheduleDate).startOf('day');
        const tideCheck = this.checkTideWindow(
          moment.max(moment(ship.arrival_time), lastUsage),
          ship.draught,
          tideData,
          berth.max_draught
        );

        if (tideCheck.available) {
          const berthTime = tideCheck.waitUntil || 
            moment.max(moment(ship.arrival_time), lastUsage).toISOString();
          
          const departureTime = moment(berthTime).add(24, 'hours').toISOString();
          
          const assignmentResult = await db.run(`
            INSERT INTO berth_assignments 
            (task_id, ship_id, berth_id, berth_no, ship_name, assigned_by, status)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `, [taskId, ship.db_id, berth.id, berth.berth_no, ship.ship_name, 'system', 'assigned']);

          await db.run(`
            UPDATE ships 
            SET estimated_berth_time = ?, estimated_departure_time = ?
            WHERE id = ?
          `, [berthTime, departureTime, ship.db_id]);

          berthUsage.set(berth.id, moment(departureTime));

          results.push({
            ship_name: ship.ship_name,
            imo_no: ship.imo_no,
            success: true,
            berth_no: berth.berth_no,
            berth_name: berth.name,
            berth_time: berthTime,
            departure_time: departureTime,
            tide_info: tideCheck.message,
            is_jump_queue: ship.is_jump_queue
          });

          assigned = true;
          break;
        }
      }

      if (!assigned) {
        results.push({
          ship_name: ship.ship_name,
          imo_no: ship.imo_no,
          success: false,
          message: '所有符合条件的泊位均无可用潮汐窗口'
        });
      }
    }

    return results;
  }

  async lockBerthAssignment(assignmentId, lockedBy) {
    const assignment = await db.get(
      'SELECT * FROM berth_assignments WHERE id = ?',
      [assignmentId]
    );

    if (!assignment) {
      throw new Error('泊位分配记录不存在');
    }

    if (assignment.is_locked) {
      throw new Error('泊位已锁定，无法重复锁定');
    }

    const beforeState = JSON.stringify({
      is_locked: assignment.is_locked,
      status: assignment.status
    });

    await db.run(`
      UPDATE berth_assignments 
      SET is_locked = 1, locked_at = CURRENT_TIMESTAMP, locked_by = ?, status = 'locked'
      WHERE id = ?
    `, [lockedBy, assignmentId]);

    const afterState = JSON.stringify({
      is_locked: true,
      status: 'locked'
    });

    await db.run(`
      INSERT INTO berth_adjustments (assignment_id, adjusted_by, reason, before_state, after_state)
      VALUES (?, ?, ?, ?, ?)
    `, [assignmentId, lockedBy, '锁定泊位', beforeState, afterState]);

    return await db.get('SELECT * FROM berth_assignments WHERE id = ?', [assignmentId]);
  }

  async adjustBerthAssignment(assignmentId, newBerthId, adjustedBy, reason) {
    const assignment = await db.get(
      'SELECT * FROM berth_assignments WHERE id = ?',
      [assignmentId]
    );

    if (!assignment) {
      throw new Error('泊位分配记录不存在');
    }

    const newBerth = await db.get(
      'SELECT * FROM berths WHERE id = ?',
      [newBerthId]
    );

    if (!newBerth) {
      throw new Error('目标泊位不存在');
    }

    const beforeState = JSON.stringify({
      berth_id: assignment.berth_id,
      berth_no: assignment.berth_no
    });

    await db.run(`
      UPDATE berth_assignments 
      SET berth_id = ?, berth_no = ?, status = 'adjusted'
      WHERE id = ?
    `, [newBerthId, newBerth.berth_no, assignmentId]);

    const afterState = JSON.stringify({
      berth_id: newBerthId,
      berth_no: newBerth.berth_no
    });

    await db.run(`
      INSERT INTO berth_adjustments (assignment_id, adjusted_by, reason, before_state, after_state)
      VALUES (?, ?, ?, ?, ?)
    `, [assignmentId, adjustedBy, reason, beforeState, afterState]);

    return await db.get('SELECT * FROM berth_assignments WHERE id = ?', [assignmentId]);
  }

  async getAssignmentAdjustments(assignmentId) {
    return await db.all(
      'SELECT * FROM berth_adjustments WHERE assignment_id = ? ORDER BY adjusted_at DESC',
      [assignmentId]
    );
  }

  async addTideData(tideData) {
    const { date, time, height, tide_type } = tideData;
    const result = await db.run(`
      INSERT INTO tides (date, time, height, tide_type)
      VALUES (?, ?, ?, ?)
    `, [date, time, height, tide_type]);
    return result.lastID;
  }

  async getTideDataByDateRange(startDate, endDate) {
    return await db.all(`
      SELECT * FROM tides 
      WHERE date >= ? AND date <= ? 
      ORDER BY time ASC
    `, [startDate, endDate]);
  }
}

module.exports = new SchedulerService();
