const fs = require('fs');
const csv = require('csv-parser');
const moment = require('moment');

const parseCSV = (filePath) => {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => {
        results.push(data);
      })
      .on('end', () => {
        resolve(results);
      })
      .on('error', (err) => {
        reject(err);
      });
  });
};

const parseJSON = (filePath) => {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        reject(err);
        return;
      }
      try {
        const parsed = JSON.parse(data);
        resolve(parsed);
      } catch (parseErr) {
        reject(parseErr);
      }
    });
  });
};

const parseWeighingCSV = async (filePath) => {
  const rawData = await parseCSV(filePath);
  const records = [];
  
  for (let i = 0; i < rawData.length; i++) {
    const row = rawData[i];
    const record = {
      weighingNumber: row['称重票编号'] || row['weighing_number'] || row['number'] || `W${Date.now()}-${i}`,
      storeName: row['门店名称'] || row['store_name'] || row['store'] || '',
      weight: parseFloat(row['重量(千克)'] || row['重量'] || row['weight'] || 0),
      weighingTime: parseDateTime(row['称重时间'] || row['weighing_time'] || row['time']),
      operator: row['操作员'] || row['operator'] || '',
      rawLine: JSON.stringify(row),
      lineNumber: i + 2
    };
    records.push(record);
  }
  
  return records;
};

const parseWaybillJSON = async (filePath) => {
  const data = await parseJSON(filePath);
  
  if (Array.isArray(data)) {
    return data.map(item => normalizeWaybill(item));
  }
  
  return [normalizeWaybill(data)];
};

const normalizeWaybill = (item) => {
  return {
    waybillNumber: item['联单编号'] || item['waybill_number'] || item['waybillNumber'] || item['number'] || `WB${Date.now()}`,
    storeName: item['门店名称'] || item['store_name'] || item['storeName'] || item['store'] || '',
    storeCode: item['门店编号'] || item['store_code'] || item['storeCode'] || '',
    collectionTime: parseDateTime(item['回收时间'] || item['collection_time'] || item['collectionTime'] || item['time']),
    weight: parseFloat(item['重量(千克)'] || item['重量'] || item['weight'] || 0),
    oilType: item['油类类型'] || item['oil_type'] || item['oilType'] || '餐厨废油',
    storeSignature: item['门店签字'] || item['store_signature'] || item['storeSignature'] || '',
    driverSignature: item['司机签字'] || item['driver_signature'] || item['driverSignature'] || '',
    rawData: JSON.stringify(item)
  };
};

const parseGPSTrack = async (filePath) => {
  const data = await parseJSON(filePath);
  
  if (Array.isArray(data)) {
    return data.map((item, index) => normalizeGPSTrackPoint(item, index));
  }
  
  if (data.points || data.track || data.features) {
    const points = data.points || data.track || data.features;
    return points.map((item, index) => normalizeGPSTrackPoint(item, index));
  }
  
  return [normalizeGPSTrackPoint(data, 0)];
};

const normalizeGPSTrackPoint = (item, index) => {
  let lat = item['纬度'] || item['lat'] || item['latitude'] || item[0];
  let lon = item['经度'] || item['lon'] || item['longitude'] || item[1] || item['lng'];
  
  if (item.geometry && item.geometry.coordinates) {
    const coords = item.geometry.coordinates;
    lon = coords[0];
    lat = coords[1];
  }
  
  return {
    timestamp: parseDateTime(item['时间'] || item['time'] || item['timestamp'] || item['datetime']),
    latitude: parseFloat(lat) || 0,
    longitude: parseFloat(lon) || 0,
    speed: parseFloat(item['速度'] || item['speed'] || 0),
    altitude: parseFloat(item['海拔'] || item['altitude'] || item['elevation'] || 0),
    rawData: JSON.stringify(item),
    sequence: index
  };
};

const parseDateTime = (value) => {
  if (!value) return null;
  
  const formats = [
    'YYYY-MM-DD HH:mm:ss',
    'YYYY-MM-DD HH:mm',
    'YYYY/MM/DD HH:mm:ss',
    'YYYY/MM/DD HH:mm',
    'YYYY-MM-DDTHH:mm:ss',
    'YYYY-MM-DDTHH:mm:ss.SSSZ',
    'YYYY-MM-DD'
  ];
  
  for (const format of formats) {
    const m = moment(value, format, true);
    if (m.isValid()) {
      return m.toDate();
    }
  }
  
  if (typeof value === 'number') {
    return new Date(value);
  }
  
  const parsed = new Date(value);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }
  
  return null;
};

module.exports = {
  parseCSV,
  parseJSON,
  parseWeighingCSV,
  parseWaybillJSON,
  parseGPSTrack,
  parseDateTime
};
