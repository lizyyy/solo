const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const dayjs = require('dayjs');

const { CONFIG } = require('../config/constants');

class DoorParser {
  constructor() {
    this.doorRecords = [];
    this.doorEvents = [];
  }

  async parseFile(filePath) {
    return new Promise((resolve, reject) => {
      const results = [];
      
      if (!fs.existsSync(filePath)) {
        return reject(new Error(`开门数据文件不存在: ${filePath}`));
      }

      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
          const record = this.parseRow(row);
          if (record) {
            results.push(record);
          }
        })
        .on('end', () => {
          const sortedResults = this.sortByTime(results);
          this.doorRecords = sortedResults;
          this.doorEvents = this.extractDoorEvents(sortedResults);
          resolve({ records: sortedResults, events: this.doorEvents });
        })
        .on('error', (error) => {
          reject(new Error(`解析开门数据失败: ${error.message}`));
        });
    });
  }

  parseRow(row) {
    try {
      const timeField = this.findTimeField(row);
      const doorStatusField = this.findDoorStatusField(row);
      const vehicleField = this.findVehicleField(row);

      if (!timeField) {
        return null;
      }

      const timestamp = dayjs(row[timeField]);
      if (!timestamp.isValid()) {
        return null;
      }

      const doorStatus = this.parseDoorStatus(row, doorStatusField);
      if (doorStatus === null) {
        return null;
      }

      return {
        timestamp: timestamp.toISOString(),
        time: row[timeField],
        doorStatus,
        isDoorOpen: doorStatus === 'open',
        vehicle: row[vehicleField] || 'unknown',
        source: 'door'
      };
    } catch (error) {
      return null;
    }
  }

  findTimeField(row) {
    const possibleFields = ['时间', 'time', 'timestamp', 'datetime', '日期时间', '日期'];
    for (const field of possibleFields) {
      if (row.hasOwnProperty(field)) {
        return field;
      }
      const lowerField = field.toLowerCase();
      const matchedField = Object.keys(row).find(
        key => key.toLowerCase().includes(lowerField)
      );
      if (matchedField) {
        return matchedField;
      }
    }
    return null;
  }

  findDoorStatusField(row) {
    const possibleFields = ['门状态', 'door_status', 'door', '开门状态', '门', '车门状态'];
    for (const field of possibleFields) {
      if (row.hasOwnProperty(field)) {
        return field;
      }
      const lowerField = field.toLowerCase();
      const matchedField = Object.keys(row).find(
        key => key.toLowerCase().includes(lowerField)
      );
      if (matchedField) {
        return matchedField;
      }
    }
    return null;
  }

  findVehicleField(row) {
    const possibleFields = ['车辆', 'vehicle', '车牌', '车牌号', '车号', 'vehicle_id'];
    for (const field of possibleFields) {
      if (row.hasOwnProperty(field)) {
        return field;
      }
      const lowerField = field.toLowerCase();
      const matchedField = Object.keys(row).find(
        key => key.toLowerCase().includes(lowerField)
      );
      if (matchedField) {
        return matchedField;
      }
    }
    return null;
  }

  parseDoorStatus(row, doorStatusField) {
    if (!doorStatusField) {
      return null;
    }

    const value = row[doorStatusField]?.toString().toLowerCase().trim();

    if (['1', 'open', 'true', '已开门', '开门', '开', '是'].includes(value)) {
      return 'open';
    }

    if (['0', 'closed', 'false', '已关门', '关门', '关', '否'].includes(value)) {
      return 'closed';
    }

    return null;
  }

  sortByTime(records) {
    return records.sort((a, b) => 
      dayjs(a.timestamp).valueOf() - dayjs(b.timestamp).valueOf()
    );
  }

  extractDoorEvents(records) {
    const events = [];
    let openTime = null;
    let openVehicle = null;

    for (let i = 0; i < records.length; i++) {
      const current = records[i];
      
      if (current.isDoorOpen && !openTime) {
        openTime = current.timestamp;
        openVehicle = current.vehicle;
      } else if (!current.isDoorOpen && openTime) {
        const closeTime = current.timestamp;
        const durationMinutes = dayjs(closeTime).diff(dayjs(openTime), 'minute', true);
        
        events.push({
          id: events.length + 1,
          openTime,
          closeTime,
          openTimeStr: dayjs(openTime).format('YYYY-MM-DD HH:mm:ss'),
          closeTimeStr: dayjs(closeTime).format('YYYY-MM-DD HH:mm:ss'),
          durationMinutes,
          durationFormatted: this.formatDuration(durationMinutes),
          vehicle: openVehicle,
          isExceeded: durationMinutes > CONFIG.DOOR.ACCEPTABLE_OPEN_MINUTES
        });
        
        openTime = null;
        openVehicle = null;
      }
    }

    if (openTime) {
      const lastRecord = records[records.length - 1];
      const durationMinutes = dayjs(lastRecord.timestamp).diff(dayjs(openTime), 'minute', true);
      
      events.push({
        id: events.length + 1,
        openTime,
        closeTime: null,
        openTimeStr: dayjs(openTime).format('YYYY-MM-DD HH:mm:ss'),
        closeTimeStr: '未关闭',
        durationMinutes,
        durationFormatted: this.formatDuration(durationMinutes) + ' (未关闭)',
        vehicle: openVehicle,
        isExceeded: durationMinutes > CONFIG.DOOR.ACCEPTABLE_OPEN_MINUTES,
        isOpenAtEnd: true
      });
    }

    return events;
  }

  formatDuration(minutes) {
    if (minutes < 1) {
      return `${Math.round(minutes * 60)}秒`;
    }
    if (minutes < 60) {
      return `${Math.round(minutes)}分钟`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`;
  }

  getDoorEvents() {
    return this.doorEvents;
  }

  getDoorEventsInTimeRange(startTime, endTime) {
    const start = dayjs(startTime);
    const end = dayjs(endTime);

    return this.doorEvents.filter(event => {
      const eventStart = dayjs(event.openTime);
      const eventEnd = event.closeTime ? dayjs(event.closeTime) : end;
      
      return eventStart.isBefore(end) && eventEnd.isAfter(start);
    });
  }

  getVehicles() {
    return [...new Set([...this.doorRecords.map(r => r.vehicle), ...this.doorEvents.map(e => e.vehicle)])];
  }

  getExceededDoorEvents() {
    return this.doorEvents.filter(e => e.isExceeded);
  }
}

module.exports = DoorParser;
