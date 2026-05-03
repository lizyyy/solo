const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');
const dayjs = require('dayjs');

const DATA_DIR = path.join(__dirname, '../../data');

class DataParser {
  constructor() {
    this.cache = {};
  }

  parseBikeGPS(csvContent) {
    const result = Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true,
      transform: (value, header) => {
        switch (header) {
          case 'latitude':
          case 'longitude':
          case 'accuracy':
            return parseFloat(value) || null;
          case 'timestamp':
            return dayjs(value).valueOf();
          case 'bike_id':
            return value;
          case 'status':
            return value;
          default:
            return value;
        }
      }
    });

    if (result.errors.length > 0) {
      console.warn('CSV解析警告:', result.errors.slice(0, 5));
    }

    return result.data.filter(row => 
      row.bike_id && 
      row.latitude !== null && 
      row.longitude !== null &&
      !isNaN(row.latitude) && 
      !isNaN(row.longitude)
    );
  }

  parseStationCapacity(jsonContent) {
    let stations;
    try {
      stations = typeof jsonContent === 'string' 
        ? JSON.parse(jsonContent) 
        : jsonContent;
    } catch (e) {
      throw new Error('站点容量JSON解析失败: ' + e.message);
    }

    if (!Array.isArray(stations)) {
      if (stations.stations) {
        stations = stations.stations;
      } else {
        throw new Error('站点数据格式错误，应为数组或包含stations字段的对象');
      }
    }

    return stations.map(station => ({
      station_id: station.station_id || station.id,
      name: station.name || station.station_name,
      latitude: parseFloat(station.latitude || station.lat),
      longitude: parseFloat(station.longitude || station.lng || station.lon),
      capacity: parseInt(station.capacity || station.total_docks) || 0,
      current_bikes: parseInt(station.current_bikes || station.available_bikes) || 0,
      address: station.address || ''
    }));
  }

  parseWorkOrders(csvContent) {
    const result = Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true,
      transform: (value, header) => {
        switch (header) {
          case 'work_order_id':
          case 'bike_id':
            return value;
          case 'created_at':
          case 'completed_at':
            return value ? dayjs(value).valueOf() : null;
          case 'status':
            return value;
          case 'issue_type':
            return value;
          case 'latitude':
          case 'longitude':
            return parseFloat(value) || null;
          default:
            return value;
        }
      }
    });

    if (result.errors.length > 0) {
      console.warn('工单CSV解析警告:', result.errors.slice(0, 5));
    }

    return result.data;
  }

  async loadSampleData() {
    const sampleDir = path.join(DATA_DIR, 'sample');
    
    const bikeGPSPath = path.join(sampleDir, 'bike_gps.csv');
    const stationPath = path.join(sampleDir, 'station_capacity.json');
    const workOrdersPath = path.join(sampleDir, 'work_orders.csv');

    const [bikeGPSContent, stationContent, workOrdersContent] = await Promise.all([
      fs.promises.readFile(bikeGPSPath, 'utf-8'),
      fs.promises.readFile(stationPath, 'utf-8'),
      fs.promises.readFile(workOrdersPath, 'utf-8')
    ]);

    return {
      bikeGPS: this.parseBikeGPS(bikeGPSContent),
      stations: this.parseStationCapacity(stationContent),
      workOrders: this.parseWorkOrders(workOrdersContent)
    };
  }

  async loadFromFiles(filePaths) {
    const { bikeGPSPath, stationPath, workOrdersPath } = filePaths;
    
    const results = {};

    if (bikeGPSPath) {
      const content = await fs.promises.readFile(bikeGPSPath, 'utf-8');
      results.bikeGPS = this.parseBikeGPS(content);
    }

    if (stationPath) {
      const content = await fs.promises.readFile(stationPath, 'utf-8');
      results.stations = this.parseStationCapacity(content);
    }

    if (workOrdersPath) {
      const content = await fs.promises.readFile(workOrdersPath, 'utf-8');
      results.workOrders = this.parseWorkOrders(content);
    }

    return results;
  }
}

module.exports = new DataParser();
