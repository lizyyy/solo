const { Op } = require('sequelize');
const { Device, ScanRecord, PairingEvent, Zone, Anomaly, sequelize } = require('../models');

const DEFAULT_CONFIG = {
  rssi: {
    fluctuationThreshold: 20,
    weakThreshold: -75,
    windowMinutes: 30
  },
  disconnect: {
    criticalMinutes: 120,
    warningMinutes: 60
  },
  battery: {
    criticalLevel: 10,
    warningLevel: 20
  },
  pairing: {
    failThreshold: 3,
    windowMinutes: 60
  },
  randomAddress: {
    driftWindowMinutes: 60,
    minSimilarAddresses: 2
  }
};

class RiskAnalyzer {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async analyzeAllDevices(options = {}) {
    const { since = null, force = false } = options;
    const results = {
      totalDevices: 0,
      devicesAnalyzed: 0,
      anomaliesCreated: 0,
      riskTagsUpdated: 0,
      errors: []
    };

    try {
      const devices = await Device.findAll({
        include: [
          { model: Zone, as: 'zone' }
        ]
      });

      results.totalDevices = devices.length;

      for (const device of devices) {
        try {
          const analysisResult = await this.analyzeDevice(device, { since, force });
          results.devicesAnalyzed++;
          if (analysisResult.anomaliesCreated > 0) {
            results.anomaliesCreated += analysisResult.anomaliesCreated;
          }
          if (analysisResult.riskTagsUpdated) {
            results.riskTagsUpdated++;
          }
        } catch (error) {
          results.errors.push({
            deviceId: device.id,
            macAddress: device.mac_address,
            error: error.message
          });
        }
      }
    } catch (error) {
      throw error;
    }

    return results;
  }

  async analyzeDevice(device, options = {}) {
    const { since = null, force = false } = options;
    const result = {
      deviceId: device.id,
      anomaliesCreated: 0,
      riskTagsUpdated: false,
      riskTags: [],
      anomalies: []
    };

    const riskTags = [];

    const rssiResult = await this.analyzeRSSI(device, since);
    if (rssiResult.hasRisk) {
      riskTags.push(...rssiResult.riskTags);
      result.anomalies.push(...rssiResult.anomalies);
    }

    const disconnectResult = await this.analyzeDisconnect(device);
    if (disconnectResult.hasRisk) {
      riskTags.push(...disconnectResult.riskTags);
      result.anomalies.push(...disconnectResult.anomalies);
    }

    const batteryResult = await this.analyzeBattery(device);
    if (batteryResult.hasRisk) {
      riskTags.push(...batteryResult.riskTags);
      result.anomalies.push(...batteryResult.anomalies);
    }

    const pairingResult = await this.analyzePairing(device, since);
    if (pairingResult.hasRisk) {
      riskTags.push(...pairingResult.riskTags);
      result.anomalies.push(...pairingResult.anomalies);
    }

    const zoneResult = await this.analyzeZoneViolation(device, since);
    if (zoneResult.hasRisk) {
      riskTags.push(...zoneResult.riskTags);
      result.anomalies.push(...zoneResult.anomalies);
    }

    const uniqueRiskTags = [...new Set(riskTags)];
    if (JSON.stringify(device.risk_tags) !== JSON.stringify(uniqueRiskTags)) {
      device.risk_tags = uniqueRiskTags;
      await device.save();
      result.riskTagsUpdated = true;
    }
    result.riskTags = uniqueRiskTags;

    for (const anomalyData of result.anomalies) {
      const existingAnomaly = await Anomaly.findOne({
        where: {
          device_id: device.id,
          anomaly_type: anomalyData.anomaly_type,
          status: { [Op.in]: ['open', 'acknowledged', 'investigating'] }
        }
      });

      if (!existingAnomaly || force) {
        await Anomaly.create({
          device_id: device.id,
          mac_address: device.mac_address,
          ...anomalyData
        });
        result.anomaliesCreated++;
      }
    }

    return result;
  }

  async analyzeRSSI(device, since = null) {
    const result = {
      hasRisk: false,
      riskTags: [],
      anomalies: []
    };

    const windowEnd = new Date();
    const windowStart = new Date(windowEnd.getTime() - this.config.rssi.windowMinutes * 60 * 1000);

    const whereClause = {
      mac_address: device.mac_address,
      scan_timestamp: { [Op.between]: [windowStart, windowEnd] }
    };

    if (since) {
      whereClause.scan_timestamp = { [Op.gte]: since };
    }

    const scanRecords = await ScanRecord.findAll({
      where: whereClause,
      order: [['scan_timestamp', 'ASC']]
    });

    if (scanRecords.length < 2) {
      return result;
    }

    const rssiValues = scanRecords.map(r => r.rssi);
    const avgRSSI = rssiValues.reduce((a, b) => a + b, 0) / rssiValues.length;
    const minRSSI = Math.min(...rssiValues);
    const maxRSSI = Math.max(...rssiValues);
    const fluctuation = maxRSSI - minRSSI;

    if (fluctuation > this.config.rssi.fluctuationThreshold) {
      result.hasRisk = true;
      result.riskTags.push('rssi_fluctuation');
      result.anomalies.push({
        anomaly_type: 'rssi_fluctuation',
        severity: fluctuation > 40 ? 'high' : 'medium',
        detected_at: new Date(),
        title: `RSSI信号抖动异常 (${minRSSI} ~ ${maxRSSI} dBm, 波动: ${fluctuation} dBm)`,
        description: `设备在过去${this.config.rssi.windowMinutes}分钟内RSSI波动超过阈值`,
        evidence: {
          avgRSSI,
          minRSSI,
          maxRSSI,
          fluctuation,
          threshold: this.config.rssi.fluctuationThreshold,
          sampleCount: scanRecords.length
        },
        risk_score: fluctuation > 40 ? 75 : 50,
        threshold_config: { fluctuationThreshold: this.config.rssi.fluctuationThreshold }
      });
    }

    if (avgRSSI < this.config.rssi.weakThreshold) {
      result.hasRisk = true;
      result.riskTags.push('weak_signal');
      result.anomalies.push({
        anomaly_type: 'rssi_fluctuation',
        severity: avgRSSI < -90 ? 'critical' : (avgRSSI < -80 ? 'high' : 'medium'),
        detected_at: new Date(),
        title: `信号强度过低 (平均: ${avgRSSI.toFixed(1)} dBm)`,
        description: `设备平均RSSI低于阈值${this.config.rssi.weakThreshold} dBm`,
        evidence: {
          avgRSSI,
          minRSSI,
          maxRSSI,
          threshold: this.config.rssi.weakThreshold
        },
        risk_score: avgRSSI < -90 ? 90 : (avgRSSI < -80 ? 70 : 50),
        threshold_config: { weakThreshold: this.config.rssi.weakThreshold }
      });
    }

    return result;
  }

  async analyzeDisconnect(device) {
    const result = {
      hasRisk: false,
      riskTags: [],
      anomalies: []
    };

    if (!device.last_seen) {
      return result;
    }

    const now = new Date();
    const lastSeen = new Date(device.last_seen);
    const minutesSinceLastSeen = (now - lastSeen) / (1000 * 60);

    if (minutesSinceLastSeen > this.config.disconnect.criticalMinutes) {
      result.hasRisk = true;
      result.riskTags.push('long_disconnect');
      result.anomalies.push({
        anomaly_type: 'long_disconnect',
        severity: 'critical',
        detected_at: new Date(),
        title: `设备失联超过${this.config.disconnect.criticalMinutes}分钟`,
        description: `最后一次扫描时间: ${lastSeen.toISOString()}, 已失联 ${Math.floor(minutesSinceLastSeen)} 分钟`,
        evidence: {
          lastSeen: lastSeen.toISOString(),
          minutesSinceLastSeen: Math.floor(minutesSinceLastSeen),
          criticalThreshold: this.config.disconnect.criticalMinutes,
          warningThreshold: this.config.disconnect.warningMinutes
        },
        risk_score: 85,
        threshold_config: {
          criticalMinutes: this.config.disconnect.criticalMinutes,
          warningMinutes: this.config.disconnect.warningMinutes
        }
      });
    } else if (minutesSinceLastSeen > this.config.disconnect.warningMinutes) {
      result.hasRisk = true;
      result.riskTags.push('pending_disconnect');
      result.anomalies.push({
        anomaly_type: 'long_disconnect',
        severity: 'warning',
        detected_at: new Date(),
        title: `设备失联超过${this.config.disconnect.warningMinutes}分钟`,
        description: `最后一次扫描时间: ${lastSeen.toISOString()}, 已失联 ${Math.floor(minutesSinceLastSeen)} 分钟`,
        evidence: {
          lastSeen: lastSeen.toISOString(),
          minutesSinceLastSeen: Math.floor(minutesSinceLastSeen),
          criticalThreshold: this.config.disconnect.criticalMinutes,
          warningThreshold: this.config.disconnect.warningMinutes
        },
        risk_score: 40,
        threshold_config: {
          criticalMinutes: this.config.disconnect.criticalMinutes,
          warningMinutes: this.config.disconnect.warningMinutes
        }
      });
    }

    return result;
  }

  async analyzeBattery(device) {
    const result = {
      hasRisk: false,
      riskTags: [],
      anomalies: []
    };

    if (device.battery_level === null || device.battery_level === undefined) {
      return result;
    }

    if (device.battery_level < this.config.battery.criticalLevel) {
      result.hasRisk = true;
      result.riskTags.push('low_battery');
      result.anomalies.push({
        anomaly_type: 'low_battery',
        severity: 'critical',
        detected_at: new Date(),
        title: `电池电量严重不足 (${device.battery_level}%)`,
        description: `设备电池电量低于临界阈值${this.config.battery.criticalLevel}%`,
        evidence: {
          batteryLevel: device.battery_level,
          criticalThreshold: this.config.battery.criticalLevel,
          warningThreshold: this.config.battery.warningLevel
        },
        risk_score: 90,
        threshold_config: {
          criticalLevel: this.config.battery.criticalLevel,
          warningLevel: this.config.battery.warningLevel
        }
      });
    } else if (device.battery_level < this.config.battery.warningLevel) {
      result.hasRisk = true;
      result.riskTags.push('low_battery_warning');
      result.anomalies.push({
        anomaly_type: 'low_battery',
        severity: 'medium',
        detected_at: new Date(),
        title: `电池电量偏低 (${device.battery_level}%)`,
        description: `设备电池电量低于警告阈值${this.config.battery.warningLevel}%`,
        evidence: {
          batteryLevel: device.battery_level,
          criticalThreshold: this.config.battery.criticalLevel,
          warningThreshold: this.config.battery.warningLevel
        },
        risk_score: 35,
        threshold_config: {
          criticalLevel: this.config.battery.criticalLevel,
          warningLevel: this.config.battery.warningLevel
        }
      });
    }

    return result;
  }

  async analyzePairing(device, since = null) {
    const result = {
      hasRisk: false,
      riskTags: [],
      anomalies: []
    };

    const windowEnd = new Date();
    const windowStart = new Date(windowEnd.getTime() - this.config.pairing.windowMinutes * 60 * 1000);

    const whereClause = {
      mac_address: device.mac_address,
      status: 'failed',
      event_timestamp: { [Op.between]: [windowStart, windowEnd] }
    };

    if (since) {
      whereClause.event_timestamp = { [Op.gte]: since };
    }

    const failedPairings = await PairingEvent.findAll({
      where: whereClause,
      order: [['event_timestamp', 'DESC']]
    });

    if (failedPairings.length >= this.config.pairing.failThreshold) {
      result.hasRisk = true;
      result.riskTags.push('pairing_failures');
      
      const recentFailures = failedPairings.slice(0, 5);
      
      result.anomalies.push({
        anomaly_type: 'pairing_failures',
        severity: failedPairings.length > 10 ? 'critical' : (failedPairings.length > 5 ? 'high' : 'medium'),
        detected_at: new Date(),
        title: `配对失败次数过多 (${failedPairings.length}次)`,
        description: `在过去${this.config.pairing.windowMinutes}分钟内有${failedPairings.length}次配对失败`,
        evidence: {
          failureCount: failedPairings.length,
          threshold: this.config.pairing.failThreshold,
          recentFailures: recentFailures.map(f => ({
            timestamp: f.event_timestamp,
            errorCode: f.error_code,
            errorMessage: f.error_message,
            hostDevice: f.host_device
          }))
        },
        risk_score: failedPairings.length > 10 ? 85 : (failedPairings.length > 5 ? 65 : 45),
        threshold_config: {
          failThreshold: this.config.pairing.failThreshold,
          windowMinutes: this.config.pairing.windowMinutes
        }
      });
    }

    return result;
  }

  async analyzeZoneViolation(device, since = null) {
    const result = {
      hasRisk: false,
      riskTags: [],
      anomalies: []
    };

    if (!device.zone_id || !device.zone) {
      return result;
    }

    const zone = device.zone;
    
    const windowEnd = new Date();
    const windowStart = since || new Date(windowEnd.getTime() - 24 * 60 * 60 * 1000);

    const recentScans = await ScanRecord.findAll({
      where: {
        mac_address: device.mac_address,
        scan_timestamp: { [Op.gte]: windowStart }
      },
      order: [['scan_timestamp', 'DESC']],
      limit: 10
    });

    if (zone.forbidden_device_types && zone.forbidden_device_types.includes(device.device_type)) {
      result.hasRisk = true;
      result.riskTags.push('zone_violation');
      result.anomalies.push({
        anomaly_type: 'zone_violation',
        severity: 'high',
        detected_at: new Date(),
        title: `设备类型禁止进入区域: ${zone.zone_name}`,
        description: `设备类型 ${device.device_type} 被禁止出现在区域 ${zone.zone_name}`,
        evidence: {
          deviceType: device.device_type,
          zoneId: zone.id,
          zoneName: zone.zone_name,
          forbiddenTypes: zone.forbidden_device_types
        },
        risk_score: 70,
        zone_id: zone.id
      });
    }

    if (zone.allowed_device_types && 
        zone.allowed_device_types.length > 0 && 
        !zone.allowed_device_types.includes(device.device_type)) {
      result.hasRisk = true;
      result.riskTags.push('zone_violation');
      result.anomalies.push({
        anomaly_type: 'zone_violation',
        severity: 'medium',
        detected_at: new Date(),
        title: `设备类型不在区域允许列表: ${zone.zone_name}`,
        description: `设备类型 ${device.device_type} 不在区域 ${zone.zone_name} 的允许设备类型列表中`,
        evidence: {
          deviceType: device.device_type,
          zoneId: zone.id,
          zoneName: zone.zone_name,
          allowedTypes: zone.allowed_device_types
        },
        risk_score: 40,
        zone_id: zone.id
      });
    }

    return result;
  }

  async detectRandomAddressDrift(since = null) {
    const result = {
      detected: false,
      groups: [],
      anomalies: []
    };

    const windowEnd = new Date();
    const windowStart = since || new Date(windowEnd.getTime() - this.config.randomAddress.driftWindowMinutes * 60 * 1000);

    const scanRecords = await ScanRecord.findAll({
      where: {
        scan_timestamp: { [Op.gte]: windowStart }
      },
      include: [{ model: Device, as: 'device' }],
      order: [['scan_timestamp', 'ASC']]
    });

    const groups = this.groupSimilarAddresses(scanRecords);

    for (const group of groups) {
      if (group.addresses.length >= this.config.randomAddress.minSimilarAddresses) {
        result.detected = true;
        result.groups.push(group);

        const canonicalAddress = group.addresses[0];
        const otherAddresses = group.addresses.slice(1);

        result.anomalies.push({
          anomaly_type: 'random_address_drift',
          severity: 'medium',
          detected_at: new Date(),
          title: `检测到随机地址漂移: ${canonicalAddress}`,
          description: `发现 ${group.addresses.length} 个相似的MAC地址，可能是同一台设备使用随机地址`,
          evidence: {
            addresses: group.addresses,
            canonicalAddress,
            otherAddresses,
            sampleCount: group.scanCount,
            timeRange: {
              start: group.earliestTime,
              end: group.latestTime
            }
          },
          risk_score: 55,
          threshold_config: {
            driftWindowMinutes: this.config.randomAddress.driftWindowMinutes,
            minSimilarAddresses: this.config.randomAddress.minSimilarAddresses
          }
        });
      }
    }

    return result;
  }

  groupSimilarAddresses(scanRecords) {
    const groups = [];
    const processed = new Set();

    for (let i = 0; i < scanRecords.length; i++) {
      const record1 = scanRecords[i];
      const mac1 = record1.mac_address;

      if (processed.has(mac1)) continue;

      const group = {
        addresses: [mac1],
        scanRecords: [record1],
        scanCount: 1,
        earliestTime: record1.scan_timestamp,
        latestTime: record1.scan_timestamp
      };

      processed.add(mac1);

      for (let j = i + 1; j < scanRecords.length; j++) {
        const record2 = scanRecords[j];
        const mac2 = record2.mac_address;

        if (processed.has(mac2)) continue;

        if (this.areAddressesSimilar(mac1, mac2)) {
          group.addresses.push(mac2);
          group.scanRecords.push(record2);
          group.scanCount++;
          
          if (record2.scan_timestamp < group.earliestTime) {
            group.earliestTime = record2.scan_timestamp;
          }
          if (record2.scan_timestamp > group.latestTime) {
            group.latestTime = record2.scan_timestamp;
          }

          processed.add(mac2);
        }
      }

      if (group.addresses.length > 1) {
        groups.push(group);
      }
    }

    return groups;
  }

  areAddressesSimilar(mac1, mac2) {
    if (!mac1 || !mac2) return false;

    const norm1 = mac1.replace(/[^0-9A-Fa-f]/g, '').toLowerCase();
    const norm2 = mac2.replace(/[^0-9A-Fa-f]/g, '').toLowerCase();

    if (norm1.length !== 12 || norm2.length !== 12) return false;

    const oui1 = norm1.substring(0, 6);
    const oui2 = norm2.substring(0, 6);

    return oui1 === oui2;
  }

  async detectDuplicateDevices() {
    const result = {
      detected: false,
      duplicates: [],
      anomalies: []
    };

    const devices = await Device.findAll({
      where: {
        canonical_device_id: null
      },
      include: [
        { model: ScanRecord, as: 'scanRecords', limit: 20 }
      ]
    });

    const byName = {};
    const bySerial = {};

    for (const device of devices) {
      if (device.device_name) {
        if (!byName[device.device_name]) {
          byName[device.device_name] = [];
        }
        byName[device.device_name].push(device);
      }

      if (device.serial_number) {
        if (!bySerial[device.serial_number]) {
          bySerial[device.serial_number] = [];
        }
        bySerial[device.serial_number].push(device);
      }
    }

    for (const [name, deviceList] of Object.entries(byName)) {
      if (deviceList.length > 1) {
        result.detected = true;
        result.duplicates.push({
          type: 'same_name',
          name,
          devices: deviceList.map(d => ({
            id: d.id,
            macAddress: d.mac_address,
            deviceType: d.device_type
          }))
        });

        result.anomalies.push({
          anomaly_type: 'duplicate_device',
          severity: 'medium',
          detected_at: new Date(),
          title: `发现重复设备: ${name}`,
          description: `发现 ${deviceList.length} 台设备使用相同的名称 "${name}"`,
          evidence: {
            name,
            deviceCount: deviceList.length,
            devices: deviceList.map(d => ({
              id: d.id,
              macAddress: d.mac_address,
              deviceType: d.device_type
            }))
          },
          risk_score: 45
        });
      }
    }

    for (const [serial, deviceList] of Object.entries(bySerial)) {
      if (deviceList.length > 1) {
        result.detected = true;
        result.duplicates.push({
          type: 'same_serial',
          serial,
          devices: deviceList.map(d => ({
            id: d.id,
            macAddress: d.mac_address,
            deviceType: d.device_type
          }))
        });

        result.anomalies.push({
          anomaly_type: 'duplicate_device',
          severity: 'high',
          detected_at: new Date(),
          title: `发现重复序列号: ${serial}`,
          description: `发现 ${deviceList.length} 台设备使用相同的序列号 "${serial}"`,
          evidence: {
            serial,
            deviceCount: deviceList.length,
            devices: deviceList.map(d => ({
              id: d.id,
              macAddress: d.mac_address,
              deviceType: d.device_type
            }))
          },
          risk_score: 70
        });
      }
    }

    return result;
  }
}

module.exports = RiskAnalyzer;
