const crypto = require('crypto');
const db = require('../config/database');

class TemperatureService {
  static generateEventHash(boxNumber, eventTime, temperature) {
    const data = `${boxNumber}|${eventTime}|${temperature}`;
    return crypto.createHash('md5').update(data).digest('hex');
  }

  static async isDuplicateEvent(eventHash) {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT id FROM temperature_events WHERE event_hash = ?',
        [eventHash],
        (err, row) => {
          if (err) reject(err);
          else resolve(!!row);
        }
      );
    });
  }

  static async getOrderByBoxNumber(boxNumber) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT o.* FROM orders o 
         JOIN boxes b ON o.id = b.order_id 
         WHERE b.box_number = ?`,
        [boxNumber],
        (err, row) => {
          if (err) reject(err);
          else resolve(row || null);
        }
      );
    });
  }

  static checkThreshold(temperature, order) {
    if (!order) {
      return {
        isAlert: false,
        thresholdMin: null,
        thresholdMax: null,
        reason: '未找到关联订单，无法判定阈值'
      };
    }

    const isBelowMin = temperature < order.required_temp_min;
    const isAboveMax = temperature > order.required_temp_max;
    const isAlert = isBelowMin || isAboveMax;

    let reason = '温度正常';
    if (isAlert) {
      if (isBelowMin) {
        reason = `温度过低: ${temperature}°C < 最低阈值 ${order.required_temp_min}°C`;
      } else {
        reason = `温度过高: ${temperature}°C > 最高阈值 ${order.required_temp_max}°C`;
      }
    }

    return {
      isAlert,
      thresholdMin: order.required_temp_min,
      thresholdMax: order.required_temp_max,
      reason
    };
  }

  static async getShiftByTime(eventTime) {
    return new Promise((resolve, reject) => {
      const eventTimeStr = new Date(eventTime).toISOString().split('T')[1].substring(0, 8);
      
      db.all('SELECT * FROM shifts', [], (err, shifts) => {
        if (err) {
          reject(err);
          return;
        }

        for (const shift of shifts) {
          const startTime = shift.start_time;
          const endTime = shift.end_time;

          if (startTime < endTime) {
            if (eventTimeStr >= startTime && eventTimeStr < endTime) {
              resolve(shift);
              return;
            }
          } else {
            if (eventTimeStr >= startTime || eventTimeStr < endTime) {
              resolve(shift);
              return;
            }
          }
        }

        resolve(null);
      });
    });
  }

  static async insertEvent(eventData, thresholdResult, shift) {
    return new Promise((resolve, reject) => {
      const stmt = db.prepare(`
        INSERT INTO temperature_events 
        (box_number, order_number, temperature, event_time, is_alert, threshold_min, threshold_max, shift_id, shift_name, event_hash, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        [
          eventData.box_number,
          eventData.order_number,
          eventData.temperature,
          eventData.event_time,
          thresholdResult.isAlert ? 1 : 0,
          thresholdResult.thresholdMin,
          thresholdResult.thresholdMax,
          shift ? shift.id : null,
          shift ? shift.shift_name : null,
          eventData.event_hash,
          'processed'
        ],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({
              id: this.lastID,
              ...eventData,
              is_alert: thresholdResult.isAlert,
              threshold_min: thresholdResult.thresholdMin,
              threshold_max: thresholdResult.thresholdMax,
              shift_id: shift ? shift.id : null,
              shift_name: shift ? shift.shift_name : null,
              threshold_reason: thresholdResult.reason
            });
          }
        }
      );
    });
  }

  static async processTemperatureEvent(eventData) {
    const eventHash = this.generateEventHash(
      eventData.box_number,
      eventData.event_time,
      eventData.temperature
    );
    eventData.event_hash = eventHash;

    const isDuplicate = await this.isDuplicateEvent(eventHash);
    if (isDuplicate) {
      return {
        success: false,
        code: 'DUPLICATE_EVENT',
        message: '重复的温度事件，已跳过',
        event_hash: eventHash
      };
    }

    const order = await this.getOrderByBoxNumber(eventData.box_number);
    if (order) {
      eventData.order_number = order.order_number;
    }

    const thresholdResult = this.checkThreshold(eventData.temperature, order);
    const shift = await this.getShiftByTime(eventData.event_time);

    const insertedEvent = await this.insertEvent(eventData, thresholdResult, shift);

    return {
      success: true,
      code: 'EVENT_PROCESSED',
      message: '温度事件处理完成',
      data: insertedEvent
    };
  }

  static async processBatchEvents(events) {
    const results = [];
    
    for (const event of events) {
      try {
        const result = await this.processTemperatureEvent(event);
        results.push({
          event,
          ...result
        });
      } catch (err) {
        results.push({
          event,
          success: false,
          code: 'PROCESS_ERROR',
          message: err.message
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const duplicateCount = results.filter(r => r.code === 'DUPLICATE_EVENT').length;
    const alertCount = results.filter(r => r.data && r.data.is_alert).length;

    return {
      total: events.length,
      success: successCount,
      duplicates: duplicateCount,
      alerts: alertCount,
      results
    };
  }
}

module.exports = TemperatureService;
