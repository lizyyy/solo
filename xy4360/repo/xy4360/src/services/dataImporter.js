const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

class DataImporter {
  constructor() {}

  async importFrequenciesFromCsv(filePath) {
    return new Promise((resolve, reject) => {
      const results = [];
      const devices = new Map();
      
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
          const cleanedRow = this._cleanRow(row);
          
          if (!cleanedRow.frequency || isNaN(parseFloat(cleanedRow.frequency))) {
            console.warn(`跳过无效行: 缺少或无效的频率值`);
            return;
          }

          const deviceName = cleanedRow.device_name || cleanedRow.device || '未知设备';
          const deviceType = this._parseDeviceType(cleanedRow.type || cleanedRow.device_type);
          
          if (!devices.has(deviceName)) {
            devices.set(deviceName, {
              name: deviceName,
              type: deviceType,
              manufacturer: cleanedRow.manufacturer,
              model: cleanedRow.model,
              notes: cleanedRow.notes
            });
          }

          results.push({
            device_name: deviceName,
            device_type: deviceType,
            frequency: parseFloat(cleanedRow.frequency),
            band: cleanedRow.band,
            channel: cleanedRow.channel,
            tx_power: cleanedRow.tx_power,
            antenna_gain: cleanedRow.antenna_gain ? parseFloat(cleanedRow.antenna_gain) : undefined,
            is_backup: this._parseBoolean(cleanedRow.is_backup || cleanedRow.backup),
            backup_for: cleanedRow.backup_for || cleanedRow.backup_for_device,
            notes: cleanedRow.notes
          });
        })
        .on('end', () => {
          resolve({
            devices: Array.from(devices.values()),
            frequencies: results
          });
        })
        .on('error', reject);
    });
  }

  importForbiddenBandsFromJson(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    
    let bands = [];
    
    if (Array.isArray(data)) {
      bands = data;
    } else if (data.bands && Array.isArray(data.bands)) {
      bands = data.bands;
    } else if (data.forbidden && Array.isArray(data.forbidden)) {
      bands = data.forbidden;
    } else {
      throw new Error('无法解析禁用频段数据格式');
    }

    return bands.map(band => ({
      name: band.name || band.label || '未命名频段',
      freq_start: parseFloat(band.freq_start || band.start || band.min),
      freq_end: parseFloat(band.freq_end || band.end || band.max),
      reason: band.reason || band.description || band.notes,
      priority: band.priority || 1
    })).filter(band => !isNaN(band.freq_start) && !isNaN(band.freq_end));
  }

  _cleanRow(row) {
    const cleaned = {};
    Object.keys(row).forEach(key => {
      const newKey = key.trim().toLowerCase().replace(/\s+/g, '_');
      cleaned[newKey] = String(row[key] || '').trim();
    });
    return cleaned;
  }

  _parseDeviceType(typeStr) {
    if (!typeStr) return 'microphone';
    
    const lower = typeStr.toLowerCase().trim();
    if (lower.includes('mic') || lower.includes('麦克') || lower.includes('话筒') || lower.includes('microphone')) {
      return 'microphone';
    }
    if (lower.includes('iem') || lower.includes('in-ear') || lower.includes('监听') || lower.includes('耳返') || lower.includes('monitor')) {
      return 'iem';
    }
    if (lower.includes('comm') || lower.includes('对讲') || lower.includes('intercom') || lower.includes('radio')) {
      return 'intercom';
    }
    if (lower.includes('backup') || lower.includes('备用')) {
      return 'backup';
    }
    
    return typeStr;
  }

  _parseBoolean(value) {
    if (!value) return false;
    const lower = String(value).toLowerCase();
    return lower === 'true' || lower === 'yes' || lower === '是' || lower === '1';
  }
}

module.exports = DataImporter;
