import * as turf from '@turf/turf';

const DEFAULT_CONFIG = {
  maxBatteryCycles: 300,
  minBatteryCoolingHours: 1,
  safetyAltitudeMargin: 10,
  returnBatteryReserve: 0.3,
  hoverBatteryPerMinute: 0.015,
  flightBatteryPerKilometer: 0.08,
  ascentRate: 5,
  descentRate: 3,
  windCompensationFactor: 1.2
};

export function analyzeMission(missionData, config = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const risks = [];
  
  const { flightPath, restrictedZones, batteryData, weatherWindow, missionInfo } = missionData;
  
  if (!flightPath || flightPath.length === 0) {
    risks.push({
      id: 'no_flight_path',
      type: 'critical',
      category: 'flight_path',
      title: '无航线数据',
      description: '未找到有效的航线数据，请检查导入的 KML 文件',
      canOverride: false,
      overrideReason: null,
      isOverridden: false
    });
    return { risks, summary: generateSummary(risks), config: cfg };
  }

  const boundaryRisks = checkFlightBoundary(flightPath, restrictedZones, cfg);
  risks.push(...boundaryRisks);

  const altitudeRisks = checkAltitudeLimits(flightPath, restrictedZones, cfg);
  risks.push(...altitudeRisks);

  if (batteryData && batteryData.batteries) {
    const batteryRisks = checkBatteryStatus(batteryData.batteries, cfg);
    risks.push(...batteryRisks);
  }

  const batteryCalcRisks = calculateBatteryRequirement(
    flightPath, 
    batteryData, 
    weatherWindow, 
    cfg
  );
  risks.push(...batteryCalcRisks);

  if (weatherWindow) {
    const weatherRisks = checkWeatherWindow(weatherWindow, cfg);
    risks.push(...weatherRisks);
  }

  return {
    risks,
    summary: generateSummary(risks),
    config: cfg
  };
}

function checkFlightBoundary(flightPath, restrictedZones, config) {
  const risks = [];
  
  if (!restrictedZones || restrictedZones.features.length === 0) {
    return risks;
  }

  const lineCoords = flightPath.map(p => [p.longitude, p.latitude, p.altitude]);
  const flightLine = turf.lineString(lineCoords);

  restrictedZones.features.forEach((zone, zoneIndex) => {
    const zoneType = zone.properties._zoneType;
    const zoneName = zone.properties._name || `限制区 ${zoneIndex + 1}`;
    
    if (zone.geometry.type === 'Polygon' || zone.geometry.type === 'MultiPolygon') {
      const zonePolygon = turf.polygon(zone.geometry.coordinates);
      
      const intersection = turf.lineIntersect(flightLine, zonePolygon);
      
      if (intersection.features.length > 0) {
        const intersectPoints = intersection.features.map(f => ({
          longitude: f.geometry.coordinates[0],
          latitude: f.geometry.coordinates[1]
        }));

        if (zoneType === 'no_fly') {
          risks.push({
            id: `no_fly_violation_${zoneIndex}`,
            type: 'critical',
            category: 'boundary',
            title: '航线侵入禁飞区',
            description: `航线在以下位置侵入禁飞区 "${zoneName}"：${formatPoints(intersectPoints)}`,
            details: {
              zoneName,
              zoneType: 'no_fly',
              intersectPoints,
              zoneGeometry: zone.geometry
            },
            canOverride: false,
            overrideReason: null,
            isOverridden: false
          });
        } else {
          risks.push({
            id: `restricted_zone_violation_${zoneIndex}`,
            type: 'warning',
            category: 'boundary',
            title: '航线进入限制区域',
            description: `航线在以下位置进入限制区域 "${zoneName}"：${formatPoints(intersectPoints)}`,
            details: {
              zoneName,
              zoneType,
              intersectPoints,
              zoneGeometry: zone.geometry
            },
            canOverride: true,
            overrideReason: null,
            isOverridden: false
          });
        }
      }

      if (lineCoords.length > 0) {
        const startPoint = turf.point(lineCoords[0].slice(0, 2));
        const endPoint = turf.point(lineCoords[lineCoords.length - 1].slice(0, 2));
        
        const startInZone = turf.booleanPointInPolygon(startPoint, zonePolygon);
        const endInZone = turf.booleanPointInPolygon(endPoint, zonePolygon);
        
        if (startInZone || endInZone) {
          const location = startInZone && endInZone ? '起点和终点' : (startInZone ? '起点' : '终点');
          
          if (zoneType === 'no_fly') {
            risks.push({
              id: `no_fly_start_end_${zoneIndex}`,
              type: 'critical',
              category: 'boundary',
              title: '起降点在禁飞区内',
              description: `航线${location}位于禁飞区 "${zoneName}" 内`,
              details: {
                zoneName,
                zoneType: 'no_fly',
                location,
                startPoint: lineCoords[0],
                endPoint: lineCoords[lineCoords.length - 1]
              },
              canOverride: false,
              overrideReason: null,
              isOverridden: false
            });
          }
        }
      }
    }
  });

  return risks;
}

function checkAltitudeLimits(flightPath, restrictedZones, config) {
  const risks = [];
  
  flightPath.forEach((point, index) => {
    const altitude = point.altitude || 0;
    
    if (altitude > 120) {
      risks.push({
        id: `altitude_exceed_${index}`,
        type: 'warning',
        category: 'altitude',
        title: '飞行高度超过默认限制',
        description: `航点 ${index + 1} 飞行高度为 ${altitude.toFixed(1)} 米，超过默认的 120 米限制`,
        details: {
          waypointIndex: index,
          altitude,
          limit: 120,
          coordinates: point
        },
        canOverride: true,
        overrideReason: null,
        isOverridden: false
      });
    }
  });

  if (restrictedZones && restrictedZones.features.length > 0) {
    const lineCoords = flightPath.map(p => [p.longitude, p.latitude, p.altitude]);
    
    restrictedZones.features.forEach((zone, zoneIndex) => {
      const zoneType = zone.properties._zoneType;
      const zoneName = zone.properties._name || `限制区 ${zoneIndex + 1}`;
      const maxAlt = zone.properties._maxAltitude;
      
      if (zoneType === 'height_limit' && maxAlt !== undefined) {
        if (zone.geometry.type === 'Polygon' || zone.geometry.type === 'MultiPolygon') {
          const zonePolygon = turf.polygon(zone.geometry.coordinates);
          
          flightPath.forEach((point, index) => {
            const turfPoint = turf.point([point.longitude, point.latitude]);
            
            if (turf.booleanPointInPolygon(turfPoint, zonePolygon)) {
              const altitude = point.altitude || 0;
              
              if (altitude > maxAlt) {
                risks.push({
                  id: `height_limit_violation_${zoneIndex}_${index}`,
                  type: 'warning',
                  category: 'altitude',
                  title: '高度超出限高区限制',
                  description: `航点 ${index + 1} 在限高区 "${zoneName}" 内的高度为 ${altitude.toFixed(1)} 米，超过限制的 ${maxAlt} 米`,
                  details: {
                    zoneName,
                    waypointIndex: index,
                    altitude,
                    limit: maxAlt,
                    coordinates: point
                  },
                  canOverride: true,
                  overrideReason: null,
                  isOverridden: false
                });
              }
            }
          });
        }
      }
    });
  }

  return risks;
}

function checkBatteryStatus(batteries, config) {
  const risks = [];
  
  batteries.forEach((battery, index) => {
    const batteryId = battery.batteryId || `电池 ${index + 1}`;
    
    if (battery.cycles > config.maxBatteryCycles) {
      risks.push({
        id: `battery_cycle_exceed_${index}`,
        type: 'critical',
        category: 'battery',
        title: '电池循环次数超限',
        description: `电池 "${batteryId}" 循环次数为 ${battery.cycles} 次，超过限制的 ${config.maxBatteryCycles} 次`,
        details: {
          batteryId,
          currentCycles: battery.cycles,
          maxCycles: config.maxBatteryCycles,
          lastUsed: battery.lastUsed
        },
        canOverride: false,
        overrideReason: null,
        isOverridden: false
      });
    }
    
    if (battery.cycles > config.maxBatteryCycles * 0.8) {
      risks.push({
        id: `battery_cycle_warning_${index}`,
        type: 'warning',
        category: 'battery',
        title: '电池循环次数接近上限',
        description: `电池 "${batteryId}" 循环次数为 ${battery.cycles} 次，已达到上限的 ${((battery.cycles / config.maxBatteryCycles) * 100).toFixed(0)}%`,
        details: {
          batteryId,
          currentCycles: battery.cycles,
          maxCycles: config.maxBatteryCycles,
          percentage: (battery.cycles / config.maxBatteryCycles) * 100
        },
        canOverride: true,
        overrideReason: null,
        isOverridden: false
      });
    }
    
    if (battery.lastUsedTime) {
      const now = new Date();
      const hoursSinceLastUse = (now - battery.lastUsedTime) / (1000 * 60 * 60);
      
      if (hoursSinceLastUse < config.minBatteryCoolingHours) {
        risks.push({
          id: `battery_cooling_${index}`,
          type: 'warning',
          category: 'battery',
          title: '电池降温时间不足',
          description: `电池 "${batteryId}" 上次使用在 ${hoursSinceLastUse.toFixed(1)} 小时前，需要至少 ${config.minBatteryCoolingHours} 小时降温时间`,
          details: {
            batteryId,
            hoursSinceLastUse,
            requiredHours: config.minBatteryCoolingHours,
            lastUsed: battery.lastUsed
          },
          canOverride: true,
          overrideReason: null,
          isOverridden: false
        });
      }
    }
  });
  
  return risks;
}

function calculateBatteryRequirement(flightPath, batteryData, weatherWindow, config) {
  const risks = [];
  
  if (flightPath.length < 2) {
    return risks;
  }

  let totalDistance = 0;
  let totalAscent = 0;
  let totalDescent = 0;
  let maxDistanceFromStart = 0;
  
  const startPoint = flightPath[0];

  for (let i = 1; i < flightPath.length; i++) {
    const prev = flightPath[i - 1];
    const curr = flightPath[i];
    
    const dist = calculateHaversineDistance(
      prev.latitude, prev.longitude,
      curr.latitude, curr.longitude
    );
    totalDistance += dist;
    
    const distFromStart = calculateHaversineDistance(
      startPoint.latitude, startPoint.longitude,
      curr.latitude, curr.longitude
    );
    maxDistanceFromStart = Math.max(maxDistanceFromStart, distFromStart);
    
    const altDiff = curr.altitude - prev.altitude;
    if (altDiff > 0) {
      totalAscent += altDiff;
    } else {
      totalDescent += Math.abs(altDiff);
    }
  }

  const windFactor = weatherWindow?.windSpeed 
    ? 1 + (weatherWindow.windSpeed * 0.02)
    : config.windCompensationFactor;

  const flightBattery = totalDistance * config.flightBatteryPerKilometer * windFactor;
  
  const ascentBattery = (totalAscent / 100) * 0.02;
  const descentBattery = (totalDescent / 100) * 0.005;
  
  const hoverBattery = 5 * config.hoverBatteryPerMinute;
  
  const returnDistance = maxDistanceFromStart;
  const returnBattery = returnDistance * config.flightBatteryPerKilometer * windFactor;
  
  const totalRequiredBattery = flightBattery + ascentBattery + descentBattery + 
                                hoverBattery + returnBattery;
  
  const reserveBattery = totalRequiredBattery * config.returnBatteryReserve;
  const totalBatteryNeeded = totalRequiredBattery + reserveBattery;

  let availableBatteryCapacity = 1.0;
  
  if (batteryData && batteryData.batteries && batteryData.batteries.length > 0) {
    const battery = batteryData.batteries[0];
    const cycleFactor = Math.max(0.6, 1 - (battery.cycles / config.maxBatteryCycles) * 0.3);
    availableBatteryCapacity = cycleFactor;
  }

  const batteryDetails = {
    totalDistance: totalDistance.toFixed(2),
    maxDistanceFromStart: maxDistanceFromStart.toFixed(2),
    totalAscent: totalAscent.toFixed(0),
    totalDescent: totalDescent.toFixed(0),
    estimatedFlightBattery: (flightBattery * 100).toFixed(1),
    estimatedReturnBattery: (returnBattery * 100).toFixed(1),
    estimatedTotalBattery: (totalBatteryNeeded * 100).toFixed(1),
    availableCapacity: (availableBatteryCapacity * 100).toFixed(1),
    windFactor: windFactor.toFixed(2)
  };

  if (totalBatteryNeeded > availableBatteryCapacity) {
    risks.push({
      id: 'battery_insufficient',
      type: 'critical',
      category: 'battery_calc',
      title: '返航电量不足',
      description: `预计总电量需求为 ${(totalBatteryNeeded * 100).toFixed(1)}%，但可用容量仅为 ${(availableBatteryCapacity * 100).toFixed(1)}%。请缩短航线或更换电池。`,
      details: batteryDetails,
      canOverride: false,
      overrideReason: null,
      isOverridden: false
    });
  } else if (totalBatteryNeeded > availableBatteryCapacity * 0.8) {
    risks.push({
      id: 'battery_margin_low',
      type: 'warning',
      category: 'battery_calc',
      title: '电量余量偏低',
      description: `预计总电量需求为 ${(totalBatteryNeeded * 100).toFixed(1)}%，占可用容量的 ${((totalBatteryNeeded / availableBatteryCapacity) * 100).toFixed(0)}%，建议预留更多安全余量。`,
      details: batteryDetails,
      canOverride: true,
      overrideReason: null,
      isOverridden: false
    });
  }

  return risks;
}

function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
}

function checkWeatherWindow(weatherWindow, config) {
  const risks = [];
  
  if (weatherWindow.windSpeed !== undefined) {
    if (weatherWindow.windSpeed > 12) {
      risks.push({
        id: 'wind_speed_high',
        type: 'critical',
        category: 'weather',
        title: '风速过高',
        description: `当前风速 ${weatherWindow.windSpeed} m/s 超过安全飞行限制（建议 < 10 m/s）`,
        details: {
          windSpeed: weatherWindow.windSpeed,
          recommendedMax: 10
        },
        canOverride: true,
        overrideReason: null,
        isOverridden: false
      });
    } else if (weatherWindow.windSpeed > 8) {
      risks.push({
        id: 'wind_speed_warning',
        type: 'warning',
        category: 'weather',
        title: '风速偏高',
        description: `当前风速 ${weatherWindow.windSpeed} m/s，请注意飞行安全并预留更多电量`,
        details: {
          windSpeed: weatherWindow.windSpeed
        },
        canOverride: false,
        overrideReason: null,
        isOverridden: false
      });
    }
  }
  
  if (weatherWindow.visibility !== undefined) {
    if (weatherWindow.visibility < 3) {
      risks.push({
        id: 'visibility_low',
        type: 'warning',
        category: 'weather',
        title: '能见度偏低',
        description: `当前能见度 ${weatherWindow.visibility} km，建议保持目视可见`,
        details: {
          visibility: weatherWindow.visibility
        },
        canOverride: true,
        overrideReason: null,
        isOverridden: false
      });
    }
  }
  
  return risks;
}

function formatPoints(points) {
  if (points.length === 0) return '';
  
  return points.map(p => 
    `(${p.latitude.toFixed(6)}°, ${p.longitude.toFixed(6)}°)`
  ).join(', ');
}

function generateSummary(risks) {
  const critical = risks.filter(r => r.type === 'critical' && !r.isOverridden);
  const warnings = risks.filter(r => r.type === 'warning' && !r.isOverridden);
  const overridden = risks.filter(r => r.isOverridden);
  
  const canFly = critical.length === 0;
  
  return {
    canFly,
    criticalCount: critical.length,
    warningCount: warnings.length,
    overriddenCount: overridden.length,
    totalRisks: risks.length,
    status: canFly ? (warnings.length > 0 ? 'warning' : 'ok') : 'critical',
    message: canFly 
      ? (warnings.length > 0 ? `可以飞行，但有 ${warnings.length} 项警告需要注意` : '所有检查通过，可以安全飞行')
      : `存在 ${critical.length} 项严重问题，禁止飞行`
  };
}

export function overrideRisk(missionData, riskId, reason) {
  if (!reason || reason.trim() === '') {
    return {
      success: false,
      error: '必须提供改判理由'
    };
  }

  const risk = missionData.risks?.find(r => r.id === riskId);
  
  if (!risk) {
    return {
      success: false,
      error: '未找到指定的风险项'
    };
  }
  
  if (!risk.canOverride) {
    return {
      success: false,
      error: '此风险项不允许改判'
    };
  }
  
  risk.isOverridden = true;
  risk.overrideReason = reason.trim();
  risk.overrideTime = new Date().toISOString();
  
  missionData.summary = generateSummary(missionData.risks);
  
  return {
    success: true,
    updatedRisk: risk,
    summary: missionData.summary
  };
}

export function revertOverride(missionData, riskId) {
  const risk = missionData.risks?.find(r => r.id === riskId);
  
  if (!risk) {
    return {
      success: false,
      error: '未找到指定的风险项'
    };
  }
  
  if (!risk.isOverridden) {
    return {
      success: false,
      error: '此风险项未被改判'
    };
  }
  
  risk.isOverridden = false;
  risk.overrideReason = null;
  risk.overrideTime = null;
  
  missionData.summary = generateSummary(missionData.risks);
  
  return {
    success: true,
    updatedRisk: risk,
    summary: missionData.summary
  };
}
