const fs = require('fs');
const path = require('path');
const { Parser } = require('json2csv');
const DeviceEvent = require('../models/DeviceEvent');
const ServiceTicket = require('../models/ServiceTicket');
const ErrorRecord = require('../models/ErrorRecord');

class ExportService {
  static async exportDeviceEvents(filterOptions, outputPath) {
    const events = await DeviceEvent.filter(filterOptions);
    const fields = [
      'id', 'device_id', 'event_type', 'event_time', 'station_id',
      'cabinet_id', 'battery_id', 'error_code', 'error_message',
      'severity', 'status', 'assignee', 'created_at'
    ];
    
    return this.writeCSV(events, fields, outputPath, 'device_events');
  }

  static async exportServiceTickets(filterOptions, outputPath) {
    const tickets = await ServiceTicket.filter(filterOptions);
    const fields = [
      'id', 'ticket_id', 'ticket_type', 'customer_id', 'customer_name',
      'phone', 'station_id', 'device_id', 'issue_type', 'description',
      'status', 'priority', 'assignee', 'created_time', 'resolved_time'
    ];
    
    return this.writeCSV(tickets, fields, outputPath, 'service_tickets');
  }

  static async exportErrors(filterOptions, outputPath) {
    const errors = await ErrorRecord.filter(filterOptions);
    const fields = [
      'id', 'source_type', 'source_file', 'row_number',
      'error_type', 'error_message', 'suggestion', 'resolved', 'created_at'
    ];
    
    return this.writeCSV(errors, fields, outputPath, 'errors');
  }

  static async exportSummary(outputPath) {
    const eventSummary = await DeviceEvent.getSummary();
    const ticketSummary = await ServiceTicket.getSummary();
    const errorSummary = await ErrorRecord.getSummary();

    const summary = {
      exportedAt: new Date().toISOString(),
      deviceEvents: eventSummary,
      serviceTickets: ticketSummary,
      errors: errorSummary
    };

    const filePath = outputPath || path.join(__dirname, '../../exports', `summary_${Date.now()}.json`);
    this.ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, JSON.stringify(summary, null, 2), 'utf8');
    
    return { filePath, recordCount: 1 };
  }

  static writeCSV(data, fields, outputPath, prefix) {
    const filePath = outputPath || path.join(__dirname, '../../exports', `${prefix}_${Date.now()}.csv`);
    this.ensureDir(path.dirname(filePath));

    try {
      const json2csvParser = new Parser({ fields });
      const csv = json2csvParser.parse(data);
      fs.writeFileSync(filePath, csv, 'utf8');
      return { filePath, recordCount: data.length };
    } catch (e) {
      throw new Error(`CSV导出失败: ${e.message}`);
    }
  }

  static ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  static async exportCombinedReport(filterOptions, outputPath) {
    const events = await DeviceEvent.filter(filterOptions);
    const tickets = await ServiceTicket.filter(filterOptions);
    
    const combinedData = [];
    
    events.forEach(e => {
      combinedData.push({
        type: '设备事件',
        id: e.id,
        reference_id: e.device_id,
        title: e.event_type,
        description: e.error_message || '',
        status: e.status,
        assignee: e.assignee || '',
        time: e.event_time,
        station: e.station_id || ''
      });
    });

    tickets.forEach(t => {
      combinedData.push({
        type: '客服工单',
        id: t.id,
        reference_id: t.ticket_id,
        title: t.issue_type || '',
        description: t.description || '',
        status: t.status,
        assignee: t.assignee || '',
        time: t.created_time,
        station: t.station_id || ''
      });
    });

    combinedData.sort((a, b) => new Date(b.time) - new Date(a.time));

    const fields = ['type', 'id', 'reference_id', 'title', 'description', 'status', 'assignee', 'time', 'station'];
    return this.writeCSV(combinedData, fields, outputPath, 'combined_report');
  }
}

module.exports = ExportService;
