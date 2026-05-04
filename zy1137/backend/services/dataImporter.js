const { Op } = require('sequelize');
const { Device, ScanRecord, PairingEvent, Zone, sequelize } = require('../models');
const { 
  parseCSVFromBuffer, 
  parseJSONLFromBuffer, 
  parseJSONFromBuffer,
  normalizeMacAddress,
  parseDateTime,
  parseInteger,
  parseBoolean,
  getDeviceTypeFromName,
  isRandomMacAddress
} = require('../utils/dataParser');

class DataImporter {
  constructor() {
    this.stats = {
      total: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: []
    };
  }

  async importDevices(buffer, options = {}) {
    this.resetStats();
    const devices = await parseCSVFromBuffer(buffer);
    
    for (const row of devices) {
      try {
        this.stats.total++;
        const result = await this.importSingleDevice(row, options);
        if (result.created) this.stats.created++;
        else if (result.updated) this.stats.updated++;
        else this.stats.skipped++;
      } catch (error) {
        this.stats.errors.push({
          row: JSON.stringify(row),
          error: error.message
        });
      }
    }

    return this.stats;
  }

  async importSingleDevice(row, options = {}) {
    const { updateExisting = true } = options;
    const macAddress = normalizeMacAddress(row.mac_address || row.mac || row.MAC || row.MAC_ADDRESS);
    
    if (!macAddress) {
      throw new Error('无效的MAC地址');
    }

    const deviceData = {
      mac_address: macAddress,
      device_name: row.device_name || row.name || row.DEVICE_NAME || null,
      device_type: row.device_type || row.type || getDeviceTypeFromName(row.device_name || row.name),
      serial_number: row.serial_number || row.serial || row.SERIAL_NUMBER || null,
      model: row.model || row.MODEL || null,
      manufacturer: row.manufacturer || row.MANUFACTURER || null,
      battery_level: parseInteger(row.battery_level || row.battery || row.BATTERY_LEVEL),
      is_random_address: parseBoolean(row.is_random_address || row.random_address, isRandomMacAddress(macAddress))
    };

    let existingDevice = await Device.findOne({
      where: { mac_address: macAddress }
    });

    if (existingDevice) {
      if (updateExisting) {
        await existingDevice.update(deviceData);
        return { updated: true, device: existingDevice };
      }
      return { skipped: true, device: existingDevice };
    }

    const device = await Device.create(deviceData);
    return { created: true, device };
  }

  async importBleScans(buffer, options = {}) {
    this.resetStats();
    const scans = await parseJSONLFromBuffer(buffer);
    
    const transaction = await sequelize.transaction();
    
    try {
      for (const scan of scans) {
        try {
          this.stats.total++;
          const result = await this.importSingleScan(scan, { ...options, transaction });
          if (result.created) this.stats.created++;
          else if (result.updated) this.stats.updated++;
          else this.stats.skipped++;
        } catch (error) {
          this.stats.errors.push({
            scan: JSON.stringify(scan).substring(0, 200),
            error: error.message
          });
        }
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }

    return this.stats;
  }

  async importSingleScan(scan, options = {}) {
    const { transaction, linkToDevice = true } = options;
    
    const macAddress = normalizeMacAddress(scan.mac_address || scan.mac || scan.MAC);
    
    if (!macAddress) {
      throw new Error('无效的MAC地址');
    }

    const timestamp = parseDateTime(scan.timestamp || scan.scan_timestamp || scan.time || new Date());
    const rssi = parseInteger(scan.rssi || scan.RSSI, -100);
    const txPower = parseInteger(scan.tx_power || scan.txPower);

    let deviceId = null;
    if (linkToDevice) {
      const device = await Device.findOne({
        where: { mac_address: macAddress },
        transaction
      });
      
      if (device) {
        deviceId = device.id;
        
        if (!device.first_seen || timestamp < device.first_seen) {
          device.first_seen = timestamp;
        }
        if (!device.last_seen || timestamp > device.last_seen) {
          device.last_seen = timestamp;
        }
        
        if (device.changed()) {
          await device.save({ transaction });
        }
      }
    }

    const scanData = {
      device_id: deviceId,
      mac_address: macAddress,
      rssi: rssi,
      tx_power: txPower,
      scan_timestamp: timestamp,
      scan_source: scan.source || scan.scan_source || scan.scanner || null,
      is_connectable: parseBoolean(scan.is_connectable || scan.connectable, true),
      advertising_data: scan.advertising_data || scan.advertisingData || scan.ad_data || {},
      raw_data: scan
    };

    const existingScan = await ScanRecord.findOne({
      where: {
        mac_address: macAddress,
        scan_timestamp: timestamp
      },
      transaction
    });

    if (existingScan) {
      return { skipped: true, scan: existingScan };
    }

    const scanRecord = await ScanRecord.create(scanData, { transaction });
    return { created: true, scan: scanRecord };
  }

  async importPairingEvents(buffer, options = {}) {
    this.resetStats();
    const events = await parseCSVFromBuffer(buffer);
    
    const transaction = await sequelize.transaction();
    
    try {
      for (const row of events) {
        try {
          this.stats.total++;
          const result = await this.importSinglePairingEvent(row, { ...options, transaction });
          if (result.created) this.stats.created++;
          else if (result.updated) this.stats.updated++;
          else this.stats.skipped++;
        } catch (error) {
          this.stats.errors.push({
            row: JSON.stringify(row),
            error: error.message
          });
        }
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }

    return this.stats;
  }

  async importSinglePairingEvent(row, options = {}) {
    const { transaction, linkToDevice = true } = options;
    
    const macAddress = normalizeMacAddress(row.mac_address || row.mac || row.MAC || row.device_mac);
    
    if (!macAddress) {
      throw new Error('无效的MAC地址');
    }

    const eventType = this.normalizeEventType(row.event_type || row.type);
    const status = this.normalizeStatus(row.status || row.result);
    const timestamp = parseDateTime(row.timestamp || row.event_timestamp || row.time || new Date());

    let deviceId = null;
    if (linkToDevice) {
      const device = await Device.findOne({
        where: { mac_address: macAddress },
        transaction
      });
      
      if (device) {
        deviceId = device.id;
      }
    }

    const eventData = {
      device_id: deviceId,
      mac_address: macAddress,
      event_type: eventType,
      status: status,
      host_device: row.host_device || row.host || row.client || null,
      host_mac: normalizeMacAddress(row.host_mac || row.client_mac),
      event_timestamp: timestamp,
      duration_seconds: parseInteger(row.duration_seconds || row.duration),
      error_code: row.error_code || row.code || null,
      error_message: row.error_message || row.message || row.error || null,
      operator: row.operator || row.user || row.operator_name || null,
      metadata: row
    };

    const existingEvent = await PairingEvent.findOne({
      where: {
        mac_address: macAddress,
        event_type: eventType,
        event_timestamp: timestamp
      },
      transaction
    });

    if (existingEvent) {
      return { skipped: true, event: existingEvent };
    }

    const event = await PairingEvent.create(eventData, { transaction });
    return { created: true, event };
  }

  async importZones(buffer, options = {}) {
    this.resetStats();
    const zones = await parseJSONFromBuffer(buffer);
    
    for (const zoneData of (zones.zones || zones)) {
      try {
        this.stats.total++;
        const result = await this.importSingleZone(zoneData, options);
        if (result.created) this.stats.created++;
        else if (result.updated) this.stats.updated++;
        else this.stats.skipped++;
      } catch (error) {
        this.stats.errors.push({
          zone: JSON.stringify(zoneData).substring(0, 200),
          error: error.message
        });
      }
    }

    return this.stats;
  }

  async importSingleZone(zoneData, options = {}) {
    const { updateExisting = true } = options;
    
    const zoneCode = zoneData.zone_code || zoneData.code || zoneData.id;
    
    if (!zoneCode) {
      throw new Error('缺少区域代码');
    }

    const zoneRecord = {
      zone_name: zoneData.zone_name || zoneData.name || zoneCode,
      zone_code: zoneCode,
      zone_type: this.normalizeZoneType(zoneData.zone_type || zoneData.type),
      description: zoneData.description || null,
      location: zoneData.location || {},
      expected_device_types: zoneData.expected_device_types || zoneData.expectedTypes || [],
      allowed_device_types: zoneData.allowed_device_types || zoneData.allowedTypes || [],
      forbidden_device_types: zoneData.forbidden_device_types || zoneData.forbiddenTypes || [],
      rssi_threshold: parseInteger(zoneData.rssi_threshold || zoneData.rssiThreshold, -70),
      expected_scan_frequency_minutes: parseInteger(zoneData.expected_scan_frequency || zoneData.scanFrequency, 30),
      max_allowed_disconnect_minutes: parseInteger(zoneData.max_disconnect_minutes || zoneData.maxDisconnect, 120)
    };

    let existingZone = await Zone.findOne({
      where: { zone_code: zoneCode }
    });

    if (existingZone) {
      if (updateExisting) {
        await existingZone.update(zoneRecord);
        return { updated: true, zone: existingZone };
      }
      return { skipped: true, zone: existingZone };
    }

    const zone = await Zone.create(zoneRecord);
    return { created: true, zone };
  }

  normalizeEventType(type) {
    if (!type) return 'connect';
    const lower = type.toLowerCase();
    if (lower.includes('pair')) return 'pair';
    if (lower.includes('unpair')) return 'unpair';
    if (lower.includes('connect')) return 'connect';
    if (lower.includes('disconnect')) return 'disconnect';
    if (lower.includes('fail')) return 'fail';
    return 'connect';
  }

  normalizeStatus(status) {
    if (!status) return 'success';
    const lower = status.toLowerCase();
    if (lower.includes('success') || lower === 'ok' || lower === 'true') return 'success';
    if (lower.includes('fail') || lower.includes('error') || lower === 'false') return 'failed';
    if (lower.includes('timeout')) return 'timeout';
    return 'success';
  }

  normalizeZoneType(type) {
    if (!type) return 'other';
    const lower = type.toLowerCase();
    if (lower.includes('warehouse') || lower.includes('仓库')) return 'warehouse';
    if (lower.includes('retail') || lower.includes('零售') || lower.includes('销售')) return 'retail';
    if (lower.includes('office') || lower.includes('办公')) return 'office';
    if (lower.includes('storage') || lower.includes('存储')) return 'storage';
    if (lower.includes('entrance') || lower.includes('入口') || lower.includes('门禁')) return 'entrance';
    if (lower.includes('checkout') || lower.includes('收银') || lower.includes('结账')) return 'checkout';
    return 'other';
  }

  resetStats() {
    this.stats = {
      total: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: []
    };
  }

  getStats() {
    return { ...this.stats };
  }
}

module.exports = DataImporter;
