import Papa from 'papaparse';
import yaml from 'js-yaml';

export class DataParser {
  constructor() {
    this.warnings = [];
  }

  parseWarehouseLayout(jsonContent) {
    try {
      const data = typeof jsonContent === 'string' ? JSON.parse(jsonContent) : jsonContent;
      this.validateWarehouseLayout(data);
      return {
        success: true,
        data: data,
        warnings: [...this.warnings]
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        warnings: [...this.warnings]
      };
    }
  }

  validateWarehouseLayout(data) {
    const requiredFields = ['dimensions', 'racks', 'aisles'];
    const missingFields = requiredFields.filter(field => !(field in data));
    
    if (missingFields.length > 0) {
      throw new Error(`仓库布局缺少必要字段: ${missingFields.join(', ')}`);
    }

    if (!data.racks || !Array.isArray(data.racks)) {
      throw new Error('货架数据格式错误，应为数组');
    }

    if (!data.aisles || !Array.isArray(data.aisles)) {
      throw new Error('通道数据格式错误，应为数组');
    }

    data.racks.forEach((rack, index) => {
      if (!rack.id) {
        this.warnings.push(`货架 ${index} 缺少ID字段`);
      }
      if (!rack.position || !rack.position.x === undefined || !rack.position.z === undefined) {
        this.warnings.push(`货架 ${rack.id || index} 缺少位置信息`);
      }
    });
  }

  parseForkliftTrajectory(csvContent) {
    try {
      const result = Papa.parse(csvContent, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true
      });

      if (result.errors.length > 0) {
        this.warnings.push(`CSV解析警告: ${result.errors.map(e => e.message).join(', ')}`);
      }

      const data = this.processTrajectoryData(result.data);
      const issues = this.validateTrajectoryData(data);

      return {
        success: true,
        data: data,
        warnings: [...this.warnings, ...issues]
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        warnings: [...this.warnings]
      };
    }
  }

  processTrajectoryData(rawData) {
    const processedData = rawData.map(row => {
      const processed = { ...row };
      
      if (row.timestamp) {
        processed.timestamp = this.parseTimestamp(row.timestamp);
      }
      
      if (row.x === '' || row.x === null || row.x === undefined) {
        processed.x = null;
      }
      if (row.y === '' || row.y === null || row.y === undefined) {
        processed.y = null;
      }
      if (row.z === '' || row.z === null || row.z === undefined) {
        processed.z = null;
      }
      
      return processed;
    });

    return this.handleCrossMidnight(
      this.interpolateMissingCoordinates(processedData)
    );
  }

  parseTimestamp(timestamp) {
    if (typeof timestamp === 'number') {
      return timestamp;
    }
    
    if (typeof timestamp === 'string') {
      const parsed = Date.parse(timestamp);
      if (!isNaN(parsed)) {
        return parsed;
      }
      
      const timeMatch = timestamp.match(/(\d{2}):(\d{2}):(\d{2})/);
      if (timeMatch) {
        const [, hours, minutes, seconds] = timeMatch;
        return parseInt(hours) * 3600000 + parseInt(minutes) * 60000 + parseInt(seconds) * 1000;
      }
    }
    
    return null;
  }

  handleCrossMidnight(data) {
    const sortedData = [...data].sort((a, b) => {
      if (a.timestamp === null || b.timestamp === null) return 0;
      return a.timestamp - b.timestamp;
    });

    for (let i = 1; i < sortedData.length; i++) {
      const prev = sortedData[i - 1].timestamp;
      const curr = sortedData[i].timestamp;
      
      if (prev !== null && curr !== null) {
        const gap = curr - prev;
        
        if (gap < -43200000) {
          for (let j = i; j < sortedData.length; j++) {
            if (sortedData[j].timestamp !== null) {
              sortedData[j].timestamp += 86400000;
            }
          }
          this.warnings.push('检测到跨午夜轨迹，已调整时间戳');
        }
      }
    }

    return sortedData;
  }

  interpolateMissingCoordinates(data) {
    const result = [...data];
    const keys = ['x', 'y', 'z'];
    
    for (const key of keys) {
      let lastValidIndex = -1;
      
      for (let i = 0; i < result.length; i++) {
        if (result[i][key] !== null && result[i][key] !== undefined) {
          if (lastValidIndex >= 0 && lastValidIndex < i - 1) {
            const startValue = result[lastValidIndex][key];
            const endValue = result[i][key];
            const steps = i - lastValidIndex;
            
            for (let j = lastValidIndex + 1; j < i; j++) {
              const ratio = (j - lastValidIndex) / steps;
              result[j][key] = startValue + (endValue - startValue) * ratio;
              if (!result[j]._interpolated) {
                result[j]._interpolated = [];
              }
              result[j]._interpolated.push(key);
            }
            this.warnings.push(`在索引 ${lastValidIndex} 到 ${i} 之间插值了 ${key} 坐标`);
          }
          lastValidIndex = i;
        }
      }
      
      let firstValidIndex = -1;
      for (let i = 0; i < result.length; i++) {
        if (result[i][key] !== null && result[i][key] !== undefined) {
          firstValidIndex = i;
          break;
        }
      }
      
      if (firstValidIndex > 0) {
        for (let j = 0; j < firstValidIndex; j++) {
          result[j][key] = result[firstValidIndex][key];
          if (!result[j]._interpolated) {
            result[j]._interpolated = [];
          }
          result[j]._interpolated.push(key + '_forward');
        }
      }
      
      for (let i = result.length - 1; i >= 0; i--) {
        if (result[i][key] !== null && result[i][key] !== undefined) {
          if (i < result.length - 1) {
            for (let j = i + 1; j < result.length; j++) {
              result[j][key] = result[i][key];
              if (!result[j]._interpolated) {
                result[j]._interpolated = [];
              }
              result[j]._interpolated.push(key + '_backward');
            }
          }
          break;
        }
      }
    }

    return result;
  }

  validateTrajectoryData(data) {
    const issues = [];
    const missingTimestamps = data.filter(row => row.timestamp === null);
    
    if (missingTimestamps.length > 0) {
      issues.push(`发现 ${missingTimestamps.length} 条记录缺少时间戳`);
    }

    const interpolatedCount = data.filter(row => row._interpolated && row._interpolated.length > 0).length;
    if (interpolatedCount > 0) {
      issues.push(`共插值处理了 ${interpolatedCount} 条记录的坐标数据`);
    }

    return issues;
  }

  parsePedestrianEvents(jsonlContent) {
    try {
      const lines = jsonlContent.trim().split('\n').filter(line => line.trim());
      const events = [];
      const parseErrors = [];

      lines.forEach((line, index) => {
        try {
          const event = JSON.parse(line);
          if (event.timestamp) {
            event.timestamp = this.parseTimestamp(event.timestamp);
          }
          events.push(event);
        } catch (error) {
          parseErrors.push(`第 ${index + 1} 行解析错误: ${error.message}`);
        }
      });

      if (parseErrors.length > 0) {
        this.warnings.push(...parseErrors);
      }

      const validatedEvents = this.validatePedestrianEvents(events);

      return {
        success: true,
        data: validatedEvents,
        warnings: [...this.warnings]
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        warnings: [...this.warnings]
      };
    }
  }

  validatePedestrianEvents(events) {
    return events.filter(event => {
      const hasId = event.id || event.pedestrian_id;
      const hasPosition = (event.x !== undefined && event.z !== undefined) || 
                          (event.position && event.position.x !== undefined && event.position.z !== undefined);
      
      if (!hasId || !hasPosition) {
        this.warnings.push(`忽略无效行人事件: 缺少ID或位置信息`);
        return false;
      }
      
      if (event.position && !event.x) {
        event.x = event.position.x;
        event.y = event.position.y || 0;
        event.z = event.position.z;
      }
      
      return true;
    });
  }

  parseSafetyRules(yamlContent) {
    try {
      const rules = yaml.load(yamlContent);
      const validatedRules = this.validateAndNormalizeRules(rules);

      return {
        success: true,
        data: validatedRules,
        warnings: [...this.warnings]
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        warnings: [...this.warnings]
      };
    }
  }

  validateAndNormalizeRules(rules) {
    const defaultRules = {
      blindSpot: {
        enabled: true,
        detectionAngle: 120,
        detectionDistance: 5.0,
        warningDistance: 3.0
      },
      nearMiss: {
        enabled: true,
        warningDistance: 2.0,
        criticalDistance: 1.0
      },
      wrongWay: {
        enabled: true,
        allowedDirection: 'both',
        violationThreshold: 3.0
      },
      turningBlindSpot: {
        enabled: true,
        turningAngleThreshold: 30,
        extraBlindDistance: 2.0
      }
    };

    if (!rules) {
      this.warnings.push('使用默认安全规则');
      return defaultRules;
    }

    const normalized = { ...defaultRules };

    if (rules.blindSpot) {
      normalized.blindSpot = { ...defaultRules.blindSpot, ...rules.blindSpot };
    }
    if (rules.nearMiss) {
      normalized.nearMiss = { ...defaultRules.nearMiss, ...rules.nearMiss };
    }
    if (rules.wrongWay) {
      normalized.wrongWay = { ...defaultRules.wrongWay, ...rules.wrongWay };
    }
    if (rules.turningBlindSpot) {
      normalized.turningBlindSpot = { ...defaultRules.turningBlindSpot, ...rules.turningBlindSpot };
    }

    return normalized;
  }

  getWarnings() {
    return [...this.warnings];
  }

  clearWarnings() {
    this.warnings = [];
  }
}

export default DataParser;
