const storage = require('../utils/storage');
const Dispatch = require('../models/dispatch');
const { 
  VEHICLE_TYPES, VEHICLE_TYPE_NAMES, 
  AIRPORT_GATES, DISPATCH_STATUS,
  DRIVER_NOTIFICATION_TYPES 
} = require('../config');

const PICKUP_BUFFER_MINUTES = 15;
const TRAVEL_TIME_PER_MINUTE = 2;

class DispatchEngine {
  constructor() {
    this.storage = storage;
  }

  calculateScore(flight, vehicle, driver) {
    let score = 0;
    let scoreDetails = [];

    const gateInfo = flight.getGateInfo();
    const vehicleBase = vehicle.getBaseInfo();

    if (flight.vehiclePreference) {
      if (vehicle.type === flight.vehiclePreference) {
        score += 100;
        scoreDetails.push({
          factor: '车型偏好匹配',
          preference: VEHICLE_TYPE_NAMES[flight.vehiclePreference],
          matched: VEHICLE_TYPE_NAMES[vehicle.type],
          points: 100
        });
      } else {
        score -= 50;
        scoreDetails.push({
          factor: '车型偏好不匹配',
          preference: VEHICLE_TYPE_NAMES[flight.vehiclePreference],
          available: VEHICLE_TYPE_NAMES[vehicle.type],
          points: -50
        });
      }
    }

    const distanceScore = this.calculateDistanceScore(gateInfo, vehicleBase);
    score += distanceScore.points;
    scoreDetails.push(distanceScore);

    const delayScore = this.calculateDelayScore(flight);
    score += delayScore.points;
    scoreDetails.push(delayScore);

    const priorityScore = this.calculatePriorityScore(flight);
    score += priorityScore.points;
    scoreDetails.push(priorityScore);

    if (driver) {
      const driverScore = this.calculateDriverScore(driver);
      score += driverScore.points;
      scoreDetails.push(driverScore);
    }

    return {
      totalScore: score,
      details: scoreDetails
    };
  }

  calculateDistanceScore(gateInfo, vehicleBase) {
    let distance = gateInfo ? gateInfo.distance : 10;
    
    if (gateInfo && vehicleBase && gateInfo.terminal !== vehicleBase.terminal) {
      distance += 15;
    }

    const maxDistance = 50;
    const normalizedScore = Math.max(0, 50 - distance);

    return {
      factor: '航站楼距离',
      gateTerminal: gateInfo ? gateInfo.terminal : '未知',
      baseTerminal: vehicleBase ? vehicleBase.terminal : '未知',
      distance: distance,
      points: normalizedScore
    };
  }

  calculateDelayScore(flight) {
    const delayMinutes = flight.delayMinutes;
    
    if (delayMinutes === 0) {
      return {
        factor: '航班延误状态',
        delayMinutes: 0,
        status: '正点',
        points: 0
      };
    } else if (delayMinutes < 30) {
      return {
        factor: '航班延误状态',
        delayMinutes: delayMinutes,
        status: '轻微延误',
        points: 10
      };
    } else if (delayMinutes < 60) {
      return {
        factor: '航班延误状态',
        delayMinutes: delayMinutes,
        status: '中度延误',
        points: 25
      };
    } else {
      return {
        factor: '航班延误状态',
        delayMinutes: delayMinutes,
        status: '严重延误',
        points: 40
      };
    }
  }

  calculatePriorityScore(flight) {
    const priorityMap = {
      'platinum': 50,
      'gold': 30,
      'silver': 15
    };

    const priority = priorityMap[flight.passengerLevel] || 0;
    const levelNames = {
      'platinum': '白金卡',
      'gold': '金卡',
      'silver': '银卡'
    };

    return {
      factor: '贵宾等级优先级',
      level: flight.passengerLevel,
      levelName: levelNames[flight.passengerLevel] || '普通',
      points: priority
    };
  }

  calculateDriverScore(driver) {
    const ratingScore = driver.rating * 10;
    const experienceBonus = Math.min(driver.experienceYears * 2, 10);

    return {
      factor: '司机资质评分',
      driverName: driver.name,
      rating: driver.rating,
      experienceYears: driver.experienceYears,
      points: ratingScore + experienceBonus
    };
  }

  findBestMatch(flightId) {
    const flight = this.storage.getFlightById(flightId);
    if (!flight) {
      throw new Error(`航班不存在: ${flightId}`);
    }

    const availableVehicles = this.storage.getVehicles().filter(v => 
      v.status === 'available'
    );
    const availableDrivers = this.storage.getDrivers().filter(d => 
      d.status === 'available' || d.status === 'on_duty'
    );

    if (availableVehicles.length === 0) {
      return {
        success: false,
        error: '没有可用车辆',
        conflicts: [{ type: 'NO_VEHICLE', message: '当前没有可用的车辆' }]
      };
    }

    if (availableDrivers.length === 0) {
      return {
        success: false,
        error: '没有可用司机',
        conflicts: [{ type: 'NO_DRIVER', message: '当前没有可用的司机' }]
      };
    }

    const matches = [];
    const conflicts = [];

    for (const vehicle of availableVehicles) {
      const assignedDriver = availableDrivers.find(d => d.vehicleId === vehicle.id) 
        || availableDrivers.find(d => !d.vehicleId);
      
      if (!assignedDriver) continue;

      const driver = assignedDriver;
      const scoreResult = this.calculateScore(flight, vehicle, driver);

      matches.push({
        vehicle,
        driver,
        score: scoreResult.totalScore,
        scoreDetails: scoreResult.details
      });
    }

    if (matches.length === 0) {
      return {
        success: false,
        error: '无法找到匹配的车辆和司机',
        conflicts: [{ type: 'NO_MATCH', message: '无法为航班匹配合适的车辆和司机' }]
      };
    }

    matches.sort((a, b) => b.score - a.score);
    const bestMatch = matches[0];

    if (flight.vehiclePreference && bestMatch.vehicle.type !== flight.vehiclePreference) {
      const hasPreferredVehicle = availableVehicles.some(v => v.type === flight.vehiclePreference);
      if (!hasPreferredVehicle) {
        conflicts.push({
          type: 'VEHICLE_PREFERENCE_UNAVAILABLE',
          message: `贵宾偏好的 ${VEHICLE_TYPE_NAMES[flight.vehiclePreference]} 不可用，已自动分配 ${VEHICLE_TYPE_NAMES[bestMatch.vehicle.type]}`,
          preference: flight.vehiclePreference,
          assigned: bestMatch.vehicle.type
        });
      }
    }

    const pickupTime = this.calculatePickupTime(flight, bestMatch.vehicle);

    return {
      success: true,
      flight,
      vehicle: bestMatch.vehicle,
      driver: bestMatch.driver,
      score: bestMatch.score,
      scoreDetails: bestMatch.scoreDetails,
      pickupTime,
      conflicts,
      alternatives: matches.slice(1, 4)
    };
  }

  calculatePickupTime(flight, vehicle) {
    const effectiveDeparture = flight.getEffectiveDepartureTime();
    const gateInfo = flight.getGateInfo();
    const vehicleBase = vehicle.getBaseInfo();

    let travelMinutes = gateInfo ? Math.ceil(gateInfo.distance / TRAVEL_TIME_PER_MINUTE) : 5;
    
    if (gateInfo && vehicleBase && gateInfo.terminal !== vehicleBase.terminal) {
      travelMinutes += 5;
    }

    const totalBuffer = travelMinutes + PICKUP_BUFFER_MINUTES;
    const pickupTime = new Date(effectiveDeparture.getTime() - totalBuffer * 60 * 1000);

    return pickupTime;
  }

  createDispatch(matchResult) {
    if (!matchResult.success) {
      throw new Error(matchResult.error || '无法创建调派');
    }

    const dispatch = new Dispatch({
      flightId: matchResult.flight.id,
      vehicleId: matchResult.vehicle.id,
      driverId: matchResult.driver.id,
      status: DISPATCH_STATUS.PENDING,
      pickupTime: matchResult.pickupTime,
      notes: `评分: ${matchResult.score}`
    });

    if (matchResult.conflicts && matchResult.conflicts.length > 0) {
      matchResult.conflicts.forEach(conflict => {
        dispatch.addConflict(conflict);
      });
    }

    this.storage.saveDispatch(dispatch);
    return dispatch;
  }

  recalculateDueToDelay(flightId, newDelayMinutes, reason) {
    const flight = this.storage.getFlightById(flightId);
    if (!flight) {
      throw new Error(`航班不存在: ${flightId}`);
    }

    const delayResult = flight.updateDelay(newDelayMinutes, reason);
    this.storage.saveFlight(flight);

    const activeDispatches = this.storage.getDispatchesByFlightId(flightId).filter(d => 
      [DISPATCH_STATUS.PENDING, DISPATCH_STATUS.ASSIGNED, DISPATCH_STATUS.EN_ROUTE].includes(d.status)
    );

    const results = [];

    for (const dispatch of activeDispatches) {
      const vehicle = this.storage.getVehicleById(dispatch.vehicleId);
      const driver = this.storage.getDriverById(dispatch.driverId);

      if (!vehicle || !driver) {
        dispatch.addConflict({
          type: 'RESOURCE_MISSING',
          message: '关联的车辆或司机信息缺失'
        });
        this.storage.saveDispatch(dispatch);
        continue;
      }

      const newPickupTime = this.calculatePickupTime(flight, vehicle);
      const oldPickupTime = dispatch.pickupTime;

      dispatch.pickupTime = newPickupTime;
      dispatch.addNotification({
        type: DRIVER_NOTIFICATION_TYPES.DELAY_NOTICE,
        recipient: driver.name,
        message: `航班 ${flight.flightNumber} 延误 ${newDelayMinutes} 分钟，接驾时间调整为 ${newPickupTime.toLocaleString()}`,
        delayInfo: delayResult
      });

      const timeDiffMinutes = (newPickupTime - oldPickupTime) / (1000 * 60);

      results.push({
        dispatchId: dispatch.id,
        oldPickupTime,
        newPickupTime,
        timeAdjustmentMinutes: timeDiffMinutes,
        notificationsSent: 1
      });

      this.storage.saveDispatch(dispatch);
    }

    return {
      flight: flight,
      delayUpdate: delayResult,
      affectedDispatches: results,
      summary: {
        delayChange: delayResult.delayChange,
        affectedCount: results.length,
        totalAdjustmentMinutes: results.reduce((sum, r) => sum + r.timeAdjustmentMinutes, 0)
      }
    };
  }

  checkConflicts() {
    const dispatches = this.storage.getDispatches();
    const conflicts = [];

    for (let i = 0; i < dispatches.length; i++) {
      for (let j = i + 1; j < dispatches.length; j++) {
        const d1 = dispatches[i];
        const d2 = dispatches[j];

        if ([DISPATCH_STATUS.COMPLETED, DISPATCH_STATUS.CANCELLED].includes(d1.status)) continue;
        if ([DISPATCH_STATUS.COMPLETED, DISPATCH_STATUS.CANCELLED].includes(d2.status)) continue;

        if (d1.vehicleId === d2.vehicleId && this.timeOverlap(d1, d2)) {
          const conflict = {
            type: 'VEHICLE_CONFLICT',
            severity: 'high',
            dispatch1: d1.id,
            dispatch2: d2.id,
            vehicleId: d1.vehicleId,
            message: `车辆 ${d1.vehicleId} 同时分配给两个重叠时间的调派`,
            resolution: '需要重新分配车辆或调整时间'
          };
          conflicts.push(conflict);
          d1.addConflict(conflict);
          d2.addConflict(conflict);
        }

        if (d1.driverId === d2.driverId && this.timeOverlap(d1, d2)) {
          const conflict = {
            type: 'DRIVER_CONFLICT',
            severity: 'high',
            dispatch1: d1.id,
            dispatch2: d2.id,
            driverId: d1.driverId,
            message: `司机 ${d1.driverId} 同时分配给两个重叠时间的调派`,
            resolution: '需要重新分配司机或调整时间'
          };
          conflicts.push(conflict);
          d1.addConflict(conflict);
          d2.addConflict(conflict);
        }
      }
    }

    return {
      conflicts,
      count: conflicts.length,
      byType: {
        vehicle: conflicts.filter(c => c.type === 'VEHICLE_CONFLICT').length,
        driver: conflicts.filter(c => c.type === 'DRIVER_CONFLICT').length
      }
    };
  }

  timeOverlap(dispatch1, dispatch2) {
    if (!dispatch1.pickupTime || !dispatch2.pickupTime) return false;

    const d1Start = dispatch1.pickupTime.getTime();
    const d1End = d1Start + 60 * 60 * 1000;
    const d2Start = dispatch2.pickupTime.getTime();
    const d2End = d2Start + 60 * 60 * 1000;

    return (d1Start < d2End && d1End > d2Start);
  }

  generateReport(format = 'json') {
    const flights = this.storage.getFlights();
    const vehicles = this.storage.getVehicles();
    const drivers = this.storage.getDrivers();
    const dispatches = this.storage.getDispatches();
    const conflicts = this.checkConflicts();

    const stats = {
      generatedAt: new Date().toISOString(),
      summary: {
        totalFlights: flights.length,
        delayedFlights: flights.filter(f => f.delayMinutes > 0).length,
        totalVehicles: vehicles.length,
        availableVehicles: vehicles.filter(v => v.status === 'available').length,
        totalDrivers: drivers.length,
        availableDrivers: drivers.filter(d => d.status === 'available').length,
        totalDispatches: dispatches.length,
        pendingDispatches: dispatches.filter(d => d.status === DISPATCH_STATUS.PENDING).length,
        completedDispatches: dispatches.filter(d => d.status === DISPATCH_STATUS.COMPLETED).length,
        conflicts: conflicts.count
      },
      byTerminal: this.getTerminalStats(flights),
      byVehicleType: this.getVehicleTypeStats(vehicles, dispatches),
      delayAnalysis: this.getDelayAnalysis(flights)
    };

    if (format === 'json') {
      return JSON.stringify(stats, null, 2);
    } else if (format === 'text') {
      return this.formatReportAsText(stats);
    }

    return JSON.stringify(stats, null, 2);
  }

  getTerminalStats(flights) {
    const terminalStats = {};
    
    flights.forEach(flight => {
      const gateInfo = flight.getGateInfo();
      const terminal = gateInfo ? gateInfo.terminal : '未知';
      
      if (!terminalStats[terminal]) {
        terminalStats[terminal] = {
          count: 0,
          delayed: 0,
          totalDelayMinutes: 0
        };
      }
      
      terminalStats[terminal].count++;
      if (flight.delayMinutes > 0) {
        terminalStats[terminal].delayed++;
        terminalStats[terminal].totalDelayMinutes += flight.delayMinutes;
      }
    });

    return terminalStats;
  }

  getVehicleTypeStats(vehicles, dispatches) {
    const typeStats = {};
    
    Object.values(VEHICLE_TYPES).forEach(type => {
      typeStats[type] = {
        typeName: VEHICLE_TYPE_NAMES[type],
        total: vehicles.filter(v => v.type === type).length,
        dispatched: dispatches.filter(d => {
          const vehicle = vehicles.find(v => v.id === d.vehicleId);
          return vehicle && vehicle.type === type;
        }).length
      };
    });

    return typeStats;
  }

  getDelayAnalysis(flights) {
    const delayed = flights.filter(f => f.delayMinutes > 0);
    
    if (delayed.length === 0) {
      return {
        count: 0,
        averageDelay: 0,
        maxDelay: 0,
        categories: {
          minor: 0,
          moderate: 0,
          severe: 0
        }
      };
    }

    return {
      count: delayed.length,
      averageDelay: Math.round(delayed.reduce((sum, f) => sum + f.delayMinutes, 0) / delayed.length),
      maxDelay: Math.max(...delayed.map(f => f.delayMinutes)),
      categories: {
        minor: delayed.filter(f => f.delayMinutes < 30).length,
        moderate: delayed.filter(f => f.delayMinutes >= 30 && f.delayMinutes < 60).length,
        severe: delayed.filter(f => f.delayMinutes >= 60).length
      }
    };
  }

  formatReportAsText(stats) {
    let text = `机场贵宾车调派系统报告\n`;
    text += `生成时间: ${new Date(stats.generatedAt).toLocaleString()}\n`;
    text += '='.repeat(60) + '\n\n';

    text += '【摘要统计】\n';
    text += `  航班总数: ${stats.summary.totalFlights}\n`;
    text += `  延误航班: ${stats.summary.delayedFlights}\n`;
    text += `  车辆总数: ${stats.summary.totalVehicles}\n`;
    text += `  可用车辆: ${stats.summary.availableVehicles}\n`;
    text += `  司机总数: ${stats.summary.totalDrivers}\n`;
    text += `  可用司机: ${stats.summary.availableDrivers}\n`;
    text += `  调派总数: ${stats.summary.totalDispatches}\n`;
    text += `  待处理调派: ${stats.summary.pendingDispatches}\n`;
    text += `  已完成调派: ${stats.summary.completedDispatches}\n`;
    text += `  冲突数量: ${stats.summary.conflicts}\n\n`;

    text += '【航站楼分布】\n';
    for (const [terminal, data] of Object.entries(stats.byTerminal)) {
      text += `  ${terminal}:\n`;
      text += `    航班数: ${data.count}, 延误: ${data.delayed}, 平均延误: ${data.count > 0 ? Math.round(data.totalDelayMinutes / data.count) : 0}分钟\n`;
    }
    text += '\n';

    text += '【延误分析】\n';
    text += `  延误航班数: ${stats.delayAnalysis.count}\n`;
    text += `  平均延误: ${stats.delayAnalysis.averageDelay}分钟\n`;
    text += `  最大延误: ${stats.delayAnalysis.maxDelay}分钟\n`;
    text += `  分类: 轻微(${stats.delayAnalysis.categories.minor}) 中度(${stats.delayAnalysis.categories.moderate}) 严重(${stats.delayAnalysis.categories.severe})\n`;

    return text;
  }
}

module.exports = new DispatchEngine();
