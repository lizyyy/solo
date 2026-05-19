const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const ImportSession = require('../models/ImportSession');
const DeviceEvent = require('../models/DeviceEvent');
const ServiceTicket = require('../models/ServiceTicket');
const ErrorRecord = require('../models/ErrorRecord');

class ImportService {
  static async importDeviceEvents(filePath) {
    const sessionId = await ImportSession.create('device_events', path.basename(filePath));
    let total = 0;
    let success = 0;
    let errors = 0;

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      let data;
      
      try {
        data = JSON.parse(content);
      } catch (e) {
        await ErrorRecord.create({
          sourceType: 'device_events',
          sourceFile: path.basename(filePath),
          rowNumber: 0,
          rawContent: content.substring(0, 500),
          errorType: 'JSON_PARSE_ERROR',
          errorMessage: `JSON解析失败: ${e.message}`,
          suggestion: '请检查文件格式是否为有效的JSON'
        }, sessionId);
        errors++;
        await ImportSession.updateStats(sessionId, 1, 0, 1);
        return { total: 1, success: 0, errors: 1 };
      }

      const events = Array.isArray(data) ? data : [data];
      total = events.length;

      for (let i = 0; i < events.length; i++) {
        const event = events[i];
        const validation = this.validateDeviceEvent(event, i + 1);
        
        if (validation.valid) {
          await DeviceEvent.create(this.normalizeDeviceEvent(event), sessionId);
          success++;
        } else {
          await ErrorRecord.create({
            sourceType: 'device_events',
            sourceFile: path.basename(filePath),
            rowNumber: i + 1,
            rawContent: JSON.stringify(event),
            errorType: validation.errorType,
            errorMessage: validation.errorMessage,
            suggestion: validation.suggestion
          }, sessionId);
          errors++;
        }
      }
    } catch (e) {
      await ErrorRecord.create({
        sourceType: 'device_events',
        sourceFile: path.basename(filePath),
        rowNumber: 0,
        rawContent: '',
        errorType: 'FILE_READ_ERROR',
        errorMessage: `文件读取失败: ${e.message}`,
        suggestion: '请检查文件路径和权限'
      }, sessionId);
      errors++;
    }

    await ImportSession.updateStats(sessionId, total, success, errors);
    return { total, success, errors, sessionId };
  }

  static validateDeviceEvent(event, rowNum) {
    const errors = [];
    
    if (!event.deviceId && !event.device_id) {
      errors.push('缺少deviceId字段');
    }
    
    if (!event.eventType && !event.event_type) {
      errors.push('缺少eventType字段');
    }
    
    if (!event.eventTime && !event.event_time) {
      errors.push('缺少eventTime字段');
    } else {
      const time = event.eventTime || event.event_time;
      if (isNaN(Date.parse(time))) {
        errors.push('eventTime格式无效');
      }
    }

    if (errors.length > 0) {
      return {
        valid: false,
        errorType: 'VALIDATION_ERROR',
        errorMessage: errors.join('; '),
        suggestion: '请补充必填字段并确保时间格式正确'
      };
    }

    return { valid: true };
  }

  static normalizeDeviceEvent(event) {
    return {
      deviceId: event.deviceId || event.device_id,
      eventType: event.eventType || event.event_type,
      eventTime: event.eventTime || event.event_time,
      stationId: event.stationId || event.station_id,
      cabinetId: event.cabinetId || event.cabinet_id,
      batteryId: event.batteryId || event.battery_id,
      errorCode: event.errorCode || event.error_code,
      errorMessage: event.errorMessage || event.error_message,
      severity: event.severity,
      status: event.status,
      assignee: event.assignee
    };
  }

  static importServiceTickets(filePath) {
    return new Promise(async (resolve) => {
      const sessionId = await ImportSession.create('service_tickets', path.basename(filePath));
      let total = 0;
      let success = 0;
      let errors = 0;
      let rowNum = 0;

      const results = [];
      
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => {
          results.push(data);
        })
        .on('end', async () => {
          total = results.length;
          
          for (let i = 0; i < results.length; i++) {
            rowNum = i + 1;
            const ticket = results[i];
            const validation = this.validateServiceTicket(ticket, rowNum);
            
            if (validation.valid) {
              await ServiceTicket.create(this.normalizeServiceTicket(ticket), sessionId);
              success++;
            } else {
              await ErrorRecord.create({
                sourceType: 'service_tickets',
                sourceFile: path.basename(filePath),
                rowNumber: rowNum,
                rawContent: JSON.stringify(ticket),
                errorType: validation.errorType,
                errorMessage: validation.errorMessage,
                suggestion: validation.suggestion
              }, sessionId);
              errors++;
            }
          }

          await ImportSession.updateStats(sessionId, total, success, errors);
          resolve({ total, success, errors, sessionId });
        })
        .on('error', async (e) => {
          await ErrorRecord.create({
            sourceType: 'service_tickets',
            sourceFile: path.basename(filePath),
            rowNumber: 0,
            rawContent: '',
            errorType: 'FILE_READ_ERROR',
            errorMessage: `CSV文件读取失败: ${e.message}`,
            suggestion: '请检查CSV文件格式和编码'
          }, sessionId);
          await ImportSession.updateStats(sessionId, 0, 0, 1);
          resolve({ total: 0, success: 0, errors: 1, sessionId });
        });
    });
  }

  static validateServiceTicket(ticket, rowNum) {
    const errors = [];
    
    if (!ticket.ticketId && !ticket.ticket_id && !ticket['工单ID']) {
      errors.push('缺少ticketId字段');
    }
    
    if (!ticket.createdTime && !ticket.created_time && !ticket['创建时间']) {
      errors.push('缺少createdTime字段');
    }

    if (errors.length > 0) {
      return {
        valid: false,
        errorType: 'VALIDATION_ERROR',
        errorMessage: errors.join('; '),
        suggestion: '请确保CSV包含必填列: ticketId, createdTime'
      };
    }

    return { valid: true };
  }

  static normalizeServiceTicket(ticket) {
    return {
      ticketId: ticket.ticketId || ticket.ticket_id || ticket['工单ID'],
      ticketType: ticket.ticketType || ticket.ticket_type || ticket['工单类型'],
      customerId: ticket.customerId || ticket.customer_id || ticket['客户ID'],
      customerName: ticket.customerName || ticket.customer_name || ticket['客户姓名'],
      phone: ticket.phone || ticket['电话'],
      stationId: ticket.stationId || ticket.station_id || ticket['站点ID'],
      deviceId: ticket.deviceId || ticket.device_id || ticket['设备ID'],
      issueType: ticket.issueType || ticket.issue_type || ticket['问题类型'],
      description: ticket.description || ticket['描述'],
      status: ticket.status || ticket['状态'],
      priority: ticket.priority || ticket['优先级'],
      assignee: ticket.assignee || ticket['负责人'],
      createdTime: ticket.createdTime || ticket.created_time || ticket['创建时间'],
      resolvedTime: ticket.resolvedTime || ticket.resolved_time || ticket['解决时间']
    };
  }
}

module.exports = ImportService;
