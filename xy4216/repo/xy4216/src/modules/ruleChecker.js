export class RuleChecker {
  constructor(options = {}) {
    this.options = {
      maxTimeGap: options.maxTimeGap || 2.0,
      minOverlapSeconds: options.minOverlapSeconds || 1.0,
      riskDistanceThreshold: options.riskDistanceThreshold || 3.0,
      dangerDistanceThreshold: options.dangerDistanceThreshold || 1.5
    };
  }

  validateAll(data) {
    const { forklift, pedestrian, warehouse } = data;
    const errors = [];
    const warnings = [];
    const info = [];

    if (!forklift || forklift.length === 0) {
      errors.push({
        type: 'missing_data',
        category: 'forklift',
        message: '缺少叉车轨迹数据',
        severity: 'error'
      });
    }

    if (!pedestrian || pedestrian.length === 0) {
      errors.push({
        type: 'missing_data',
        category: 'pedestrian',
        message: '缺少行人定位数据',
        severity: 'error'
      });
    }

    if (!warehouse) {
      warnings.push({
        type: 'missing_data',
        category: 'warehouse',
        message: '缺少仓库平面图数据，将使用默认配置',
        severity: 'warning'
      });
    }

    if (forklift && forklift.length > 0) {
      const forkliftChecks = this._validateForkliftData(forklift, warehouse);
      errors.push(...forkliftChecks.errors);
      warnings.push(...forkliftChecks.warnings);
      info.push(...forkliftChecks.info);
    }

    if (pedestrian && pedestrian.length > 0) {
      const pedestrianChecks = this._validatePedestrianData(pedestrian, warehouse);
      errors.push(...pedestrianChecks.errors);
      warnings.push(...pedestrianChecks.warnings);
      info.push(...pedestrianChecks.info);
    }

    if (forklift && pedestrian && forklift.length > 0 && pedestrian.length > 0) {
      const syncChecks = this._validateTimeSynchronization(forklift, pedestrian);
      errors.push(...syncChecks.errors);
      warnings.push(...syncChecks.warnings);
      info.push(...syncChecks.info);
    }

    if (forklift && forklift.length > 0) {
      const duplicateChecks = this._checkDuplicateDeviceIds(forklift, 'forklift');
      errors.push(...duplicateChecks.errors);
    }

    if (pedestrian && pedestrian.length > 0) {
      const duplicateChecks = this._checkDuplicateDeviceIds(pedestrian, 'pedestrian');
      errors.push(...duplicateChecks.errors);
    }

    const riskPoints = [];
    if (forklift && pedestrian && forklift.length > 0 && pedestrian.length > 0) {
      riskPoints.push(...this._detectRiskPoints(forklift, pedestrian));
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      info,
      riskPoints,
      summary: this._generateSummary(errors, warnings, info, riskPoints)
    };
  }

  _validateForkliftData(forkliftData, warehouseData) {
    const errors = [];
    const warnings = [];
    const info = [];

    const sortedData = [...forkliftData].sort((a, b) => a.timestamp - b.timestamp);

    for (let i = 1; i < sortedData.length; i++) {
      const gap = sortedData[i].timestamp - sortedData[i - 1].timestamp;
      if (gap > this.options.maxTimeGap) {
        warnings.push({
          type: 'missing_frames',
          category: 'forklift',
          message: `在时间 ${sortedData[i - 1].timestamp.toFixed(2)}s 到 ${sortedData[i].timestamp.toFixed(2)}s 之间存在 ${gap.toFixed(2)}s 的数据缺口`,
          details: {
            startTime: sortedData[i - 1].timestamp,
            endTime: sortedData[i].timestamp,
            gap: gap
          },
          severity: 'warning'
        });
      }
    }

    if (warehouseData && warehouseData.dimensions) {
      const bounds = {
        minX: 0,
        maxX: warehouseData.dimensions.width,
        minY: 0,
        maxY: warehouseData.dimensions.height,
        minZ: 0,
        maxZ: warehouseData.dimensions.depth
      };

      forkliftData.forEach((point, index) => {
        if (point.x < bounds.minX || point.x > bounds.maxX ||
            point.z < bounds.minZ || point.z > bounds.maxZ) {
          errors.push({
            type: 'coordinate_out_of_bounds',
            category: 'forklift',
            message: `第 ${index + 1} 帧坐标越界: (${point.x.toFixed(2)}, ${point.z.toFixed(2)})`,
            details: {
              frame: index,
              timestamp: point.timestamp,
              position: { x: point.x, y: point.y, z: point.z },
              bounds: bounds
            },
            severity: 'error'
          });
        }
      });
    }

    const timeRange = {
      start: sortedData[0].timestamp,
      end: sortedData[sortedData.length - 1].timestamp,
      duration: sortedData[sortedData.length - 1].timestamp - sortedData[0].timestamp
    };

    info.push({
      type: 'data_info',
      category: 'forklift',
      message: `叉车数据: ${forkliftData.length} 帧, 时长 ${timeRange.duration.toFixed(2)}s`,
      details: timeRange,
      severity: 'info'
    });

    return { errors, warnings, info };
  }

  _validatePedestrianData(pedestrianData, warehouseData) {
    const errors = [];
    const warnings = [];
    const info = [];

    const sortedData = [...pedestrianData].sort((a, b) => a.timestamp - b.timestamp);

    for (let i = 1; i < sortedData.length; i++) {
      const gap = sortedData[i].timestamp - sortedData[i - 1].timestamp;
      if (gap > this.options.maxTimeGap) {
        warnings.push({
          type: 'missing_frames',
          category: 'pedestrian',
          message: `在时间 ${sortedData[i - 1].timestamp.toFixed(2)}s 到 ${sortedData[i].timestamp.toFixed(2)}s 之间存在 ${gap.toFixed(2)}s 的数据缺口`,
          details: {
            startTime: sortedData[i - 1].timestamp,
            endTime: sortedData[i].timestamp,
            gap: gap
          },
          severity: 'warning'
        });
      }
    }

    if (warehouseData && warehouseData.dimensions) {
      const bounds = {
        minX: 0,
        maxX: warehouseData.dimensions.width,
        minY: 0,
        maxY: warehouseData.dimensions.height,
        minZ: 0,
        maxZ: warehouseData.dimensions.depth
      };

      pedestrianData.forEach((point, index) => {
        if (point.x < bounds.minX || point.x > bounds.maxX ||
            point.z < bounds.minZ || point.z > bounds.maxZ) {
          errors.push({
            type: 'coordinate_out_of_bounds',
            category: 'pedestrian',
            message: `第 ${index + 1} 帧坐标越界: (${point.x.toFixed(2)}, ${point.z.toFixed(2)})`,
            details: {
              frame: index,
              timestamp: point.timestamp,
              position: { x: point.x, y: point.y, z: point.z },
              bounds: bounds
            },
            severity: 'error'
          });
        }
      });
    }

    const timeRange = {
      start: sortedData[0].timestamp,
      end: sortedData[sortedData.length - 1].timestamp,
      duration: sortedData[sortedData.length - 1].timestamp - sortedData[0].timestamp
    };

    info.push({
      type: 'data_info',
      category: 'pedestrian',
      message: `行人数据: ${pedestrianData.length} 帧, 时长 ${timeRange.duration.toFixed(2)}s`,
      details: timeRange,
      severity: 'info'
    });

    return { errors, warnings, info };
  }

  _validateTimeSynchronization(forkliftData, pedestrianData) {
    const errors = [];
    const warnings = [];
    const info = [];

    const forkliftTimes = forkliftData.map(d => d.timestamp).sort((a, b) => a - b);
    const pedestrianTimes = pedestrianData.map(d => d.timestamp).sort((a, b) => a - b);

    const forkliftRange = {
      start: forkliftTimes[0],
      end: forkliftTimes[forkliftTimes.length - 1]
    };

    const pedestrianRange = {
      start: pedestrianTimes[0],
      end: pedestrianTimes[pedestrianTimes.length - 1]
    };

    const overlapStart = Math.max(forkliftRange.start, pedestrianRange.start);
    const overlapEnd = Math.min(forkliftRange.end, pedestrianRange.end);
    const overlapDuration = overlapEnd - overlapStart;

    if (overlapDuration <= 0) {
      errors.push({
        type: 'time_misalignment',
        category: 'synchronization',
        message: `叉车和行人数据时间范围没有重叠`,
        details: {
          forkliftRange: forkliftRange,
          pedestrianRange: pedestrianRange
        },
        severity: 'error'
      });
    } else if (overlapDuration < this.options.minOverlapSeconds) {
      warnings.push({
        type: 'time_misalignment',
        category: 'synchronization',
        message: `数据重叠时间较短: ${overlapDuration.toFixed(2)}s`,
        details: {
          overlapStart,
          overlapEnd,
          overlapDuration,
          forkliftRange,
          pedestrianRange
        },
        severity: 'warning'
      });
    }

    const timeOffset = pedestrianRange.start - forkliftRange.start;
    if (Math.abs(timeOffset) > 1.0) {
      warnings.push({
        type: 'time_offset',
        category: 'synchronization',
        message: `数据起始时间偏差: ${timeOffset.toFixed(2)}s`,
        details: {
          offset: timeOffset,
          forkliftStart: forkliftRange.start,
          pedestrianStart: pedestrianRange.start
        },
        severity: 'warning'
      });
    }

    info.push({
      type: 'sync_info',
      category: 'synchronization',
      message: `时间重叠: ${overlapDuration.toFixed(2)}s`,
      details: {
        overlapStart,
        overlapEnd,
        overlapDuration
      },
      severity: 'info'
    });

    return { errors, warnings, info };
  }

  _checkDuplicateDeviceIds(data, category) {
    const errors = [];
    const deviceIdCounts = {};

    data.forEach(point => {
      const deviceId = point.deviceId || 'unknown';
      deviceIdCounts[deviceId] = (deviceIdCounts[deviceId] || 0) + 1;
    });

    if (Object.keys(deviceIdCounts).length > 1) {
      errors.push({
        type: 'duplicate_device_id',
        category: category,
        message: `检测到多个设备ID: ${Object.keys(deviceIdCounts).join(', ')}`,
        details: {
          deviceIdCounts: deviceIdCounts
        },
        severity: 'error'
      });
    }

    return { errors };
  }

  _detectRiskPoints(forkliftData, pedestrianData) {
    const riskPoints = [];
    
    const forkliftSorted = [...forkliftData].sort((a, b) => a.timestamp - b.timestamp);
    const pedestrianSorted = [...pedestrianData].sort((a, b) => a.timestamp - b.timestamp);

    const allTimestamps = new Set([
      ...forkliftSorted.map(d => d.timestamp),
      ...pedestrianSorted.map(d => d.timestamp)
    ]);

    const timestamps = Array.from(allTimestamps).sort((a, b) => a - b);

    let riskZoneStart = null;
    let minDistanceInZone = Infinity;
    let dangerZoneStart = null;
    let minDangerDistance = Infinity;

    timestamps.forEach(timestamp => {
      const forkliftPoint = this._findNearestPoint(forkliftSorted, timestamp);
      const pedestrianPoint = this._findNearestPoint(pedestrianSorted, timestamp);

      if (!forkliftPoint || !pedestrianPoint) return;

      const distance = Math.sqrt(
        Math.pow(forkliftPoint.x - pedestrianPoint.x, 2) +
        Math.pow(forkliftPoint.z - pedestrianPoint.z, 2)
      );

      if (distance <= this.options.dangerDistanceThreshold) {
        if (!dangerZoneStart) {
          dangerZoneStart = timestamp;
          minDangerDistance = distance;
        } else {
          minDangerDistance = Math.min(minDangerDistance, distance);
        }
      } else if (dangerZoneStart) {
        riskPoints.push({
          id: `risk_${riskPoints.length}`,
          type: 'danger',
          level: 'high',
          startTime: dangerZoneStart,
          endTime: timestamp,
          duration: timestamp - dangerZoneStart,
          minDistance: minDangerDistance,
          forkliftPositions: {
            start: this._findNearestPoint(forkliftSorted, dangerZoneStart),
            end: forkliftPoint
          },
          pedestrianPositions: {
            start: this._findNearestPoint(pedestrianSorted, dangerZoneStart),
            end: pedestrianPoint
          }
        });
        dangerZoneStart = null;
        minDangerDistance = Infinity;
      }

      if (distance <= this.options.riskDistanceThreshold && distance > this.options.dangerDistanceThreshold) {
        if (!riskZoneStart) {
          riskZoneStart = timestamp;
          minDistanceInZone = distance;
        } else {
          minDistanceInZone = Math.min(minDistanceInZone, distance);
        }
      } else if (riskZoneStart && !dangerZoneStart) {
        riskPoints.push({
          id: `risk_${riskPoints.length}`,
          type: 'warning',
          level: 'medium',
          startTime: riskZoneStart,
          endTime: timestamp,
          duration: timestamp - riskZoneStart,
          minDistance: minDistanceInZone,
          forkliftPositions: {
            start: this._findNearestPoint(forkliftSorted, riskZoneStart),
            end: forkliftPoint
          },
          pedestrianPositions: {
            start: this._findNearestPoint(pedestrianSorted, riskZoneStart),
            end: pedestrianPoint
          }
        });
        riskZoneStart = null;
        minDistanceInZone = Infinity;
      }
    });

    if (dangerZoneStart) {
      const lastTimestamp = timestamps[timestamps.length - 1];
      riskPoints.push({
        id: `risk_${riskPoints.length}`,
        type: 'danger',
        level: 'high',
        startTime: dangerZoneStart,
        endTime: lastTimestamp,
        duration: lastTimestamp - dangerZoneStart,
        minDistance: minDangerDistance,
        forkliftPositions: {
          start: this._findNearestPoint(forkliftSorted, dangerZoneStart),
          end: this._findNearestPoint(forkliftSorted, lastTimestamp)
        },
        pedestrianPositions: {
          start: this._findNearestPoint(pedestrianSorted, dangerZoneStart),
          end: this._findNearestPoint(pedestrianSorted, lastTimestamp)
        }
      });
    }

    if (riskZoneStart && !dangerZoneStart) {
      const lastTimestamp = timestamps[timestamps.length - 1];
      riskPoints.push({
        id: `risk_${riskPoints.length}`,
        type: 'warning',
        level: 'medium',
        startTime: riskZoneStart,
        endTime: lastTimestamp,
        duration: lastTimestamp - riskZoneStart,
        minDistance: minDistanceInZone,
        forkliftPositions: {
          start: this._findNearestPoint(forkliftSorted, riskZoneStart),
          end: this._findNearestPoint(forkliftSorted, lastTimestamp)
        },
        pedestrianPositions: {
          start: this._findNearestPoint(pedestrianSorted, riskZoneStart),
          end: this._findNearestPoint(pedestrianSorted, lastTimestamp)
        }
      });
    }

    return riskPoints;
  }

  _findNearestPoint(sortedData, targetTime) {
    if (sortedData.length === 0) return null;

    let left = 0;
    let right = sortedData.length - 1;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      if (sortedData[mid].timestamp === targetTime) {
        return sortedData[mid];
      } else if (sortedData[mid].timestamp < targetTime) {
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }

    if (left >= sortedData.length) return sortedData[sortedData.length - 1];
    if (right < 0) return sortedData[0];

    const leftDist = Math.abs(sortedData[right].timestamp - targetTime);
    const rightDist = Math.abs(sortedData[left].timestamp - targetTime);

    return leftDist < rightDist ? sortedData[right] : sortedData[left];
  }

  _generateSummary(errors, warnings, info, riskPoints) {
    return {
      totalErrors: errors.length,
      totalWarnings: warnings.length,
      totalInfo: info.length,
      riskPoints: {
        total: riskPoints.length,
        high: riskPoints.filter(r => r.level === 'high').length,
        medium: riskPoints.filter(r => r.level === 'medium').length,
        low: riskPoints.filter(r => r.level === 'low').length
      }
    };
  }

  getPositionAtTime(data, timestamp) {
    return this._findNearestPoint(data, timestamp);
  }
}

export default RuleChecker;
