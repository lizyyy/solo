const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const dayjs = require('dayjs');

const { CONFIG } = require('../config/constants');

class TemperatureParser {
  constructor() {
    this.temperatureRecords = [];
  }

  async parseFile(filePath) {
    return new Promise((resolve, reject) => {
      const results = [];
      
      if (!fs.existsSync(filePath)) {
        return reject(new Error(`温度数据文件不存在: ${filePath}`));
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
          this.temperatureRecords = sortedResults;
          resolve(sortedResults);
        })
        .on('error', (error) => {
          reject(new Error(`解析温度数据失败: ${error.message}`));
        });
    });
  }

  parseRow(row) {
    try {
      const timeField = this.findTimeField(row);
      const temperatureField = this.findTemperatureField(row);
      const vehicleField = this.findVehicleField(row);
      const batchField = this.findBatchField(row);

      if (!timeField || !temperatureField) {
        return null;
      }

      const timestamp = dayjs(row[timeField]);
      if (!timestamp.isValid()) {
        return null;
      }

      const temperature = parseFloat(row[temperatureField]);
      if (isNaN(temperature)) {
        return null;
      }

      return {
        timestamp: timestamp.toISOString(),
        time: row[timeField],
        temperature,
        vehicle: row[vehicleField] || 'unknown',
        batch: row[batchField] || 'unknown',
        source: 'temperature'
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

  findTemperatureField(row) {
    const possibleFields = ['温度', 'temperature', 'temp', '当前温度', '车厢温度'];
    for (const field of possibleFields) {
      if (row.hasOwnProperty(field)) {
        return field;
      }
      const lowerField = field.toLowerCase();
      const matchedField = Object.keys(row).find(
        key => key.toLowerCase().includes(lowerField) && 
               !key.toLowerCase().includes('设置') && 
               !key.toLowerCase().includes('目标')
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

  findBatchField(row) {
    const possibleFields = ['批次', 'batch', '批次号', '运输批次', '订单号'];
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

  sortByTime(records) {
    return records.sort((a, b) => 
      dayjs(a.timestamp).valueOf() - dayjs(b.timestamp).valueOf()
    );
  }

  getRecordsByVehicle(vehicle) {
    return this.temperatureRecords.filter(r => r.vehicle === vehicle);
  }

  getRecordsByBatch(batch) {
    return this.temperatureRecords.filter(r => r.batch === batch);
  }

  getVehicles() {
    return [...new Set(this.temperatureRecords.map(r => r.vehicle))];
  }

  getBatches() {
    return [...new Set(this.temperatureRecords.map(r => r.batch))];
  }

  getTimeRange() {
    if (this.temperatureRecords.length === 0) {
      return null;
    }
    const times = this.temperatureRecords.map(r => dayjs(r.timestamp).valueOf());
    return {
      start: dayjs(Math.min(...times)).toISOString(),
      end: dayjs(Math.max(...times)).toISOString()
    };
  }
}

module.exports = TemperatureParser;
