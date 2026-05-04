import { TimeUtils } from '../utils/timeUtils.js';
import { GeoUtils } from '../utils/geoUtils.js';

export class RiskDetector {
  constructor(dataManager) {
    this.dataManager = dataManager;
    this.riskEvents = [];
    this.riskIdCounter = 0;
  }

  detectAllRisks() {
    this.riskEvents = [];
    
    this.detectSpeedViolations();
    this.detectNoEntryZoneViolations();
    this.detectVehicleConflicts();
    this.detectFuelingBridgeOverlap();
    
    return this.riskEvents;
  }

  createRiskEvent(type, level, startTime, endTime, description, metadata = {}) {
    const event = {
      id: `risk_${++this.riskIdCounter}`,
      type,
      level,
      startTime,
      endTime,
      duration: endTime - startTime,
      description,
      metadata,
      timestamp: startTime
    };
    
    this.riskEvents.push(event);
    return event;
  }

  detectSpeedViolations() {
    const { vehicles, safetyRules } = this.dataManager;
    const defaultSpeedLimit = safetyRules?.speedLimits?.[0]?.limit || 30;
    
    const areaSpeedLimits = new Map();
    safetyRules?.speedLimits?.forEach(rule => {
      if (rule.area) {
        areaSpeedLimits.set(rule.area, rule.limit);
      }
    });
    
    vehicles.forEach(vehicle => {
      if (!vehicle.tracks || vehicle.tracks.length < 2) return;
      
      let violationStart = null;
      let violationType = null;
      let maxSpeed = 0;
      let speedLimit = defaultSpeedLimit;
      
      for (let i = 0; i < vehicle.tracks.length; i++) {
        const track = vehicle.tracks[i];
        const speed = track.speed || track.calculatedSpeed || 0;
        
        let currentLimit = defaultSpeedLimit;
        let inSpecialArea = false;
        
        safetyRules?.speedLimits?.forEach(rule => {
          if (rule.polygon) {
            const point = { latitude: track.latitude, longitude: track.longitude };
            if (GeoUtils.isPointInPolygon(point, rule.polygon)) {
              currentLimit = rule.limit;
              inSpecialArea = true;
            }
          }
        });
        
        speedLimit = currentLimit;
        
        if (speed > currentLimit) {
          if (!violationStart) {
            violationStart = track.timestamp;
            violationType = inSpecialArea ? '特殊区域超速' : '超速';
          }
          if (speed > maxSpeed) maxSpeed = speed;
        } else {
          if (violationStart) {
            const endTime = track.timestamp;
            const duration = endTime - violationStart;
            
            if (duration >= 3000) {
              this.createRiskEvent(
                'speed_violation',
                maxSpeed > currentLimit * 1.5 ? 'high' : (maxSpeed > currentLimit * 1.2 ? 'medium' : 'low'),
                violationStart,
                endTime,
                `${vehicle.type} ${vehicle.id} ${violationType}：${maxSpeed.toFixed(1)} km/h，限制：${currentLimit} km/h`,
                {
                  vehicleId: vehicle.id,
                  vehicleType: vehicle.type,
                  maxSpeed,
                  speedLimit: currentLimit,
                  startIndex: i - 1,
                  endIndex: i
                }
              );
            }
            
            violationStart = null;
            violationType = null;
            maxSpeed = 0;
          }
        }
      }
      
      if (violationStart && vehicle.tracks.length > 0) {
        const lastTrack = vehicle.tracks[vehicle.tracks.length - 1];
        const endTime = lastTrack.timestamp;
        const duration = endTime - violationStart;
        
        if (duration >= 3000) {
          this.createRiskEvent(
            'speed_violation',
            maxSpeed > speedLimit * 1.5 ? 'high' : (maxSpeed > speedLimit * 1.2 ? 'medium' : 'low'),
            violationStart,
            endTime,
            `${vehicle.type} ${vehicle.id} 超速：${maxSpeed.toFixed(1)} km/h，限制：${speedLimit} km/h`,
            {
              vehicleId: vehicle.id,
              vehicleType: vehicle.type,
              maxSpeed,
              speedLimit
            }
          );
        }
      }
    });
  }

  detectNoEntryZoneViolations() {
    const { vehicles, safetyRules } = this.dataManager;
    const noEntryZones = safetyRules?.noEntryZones || [];
    
    if (noEntryZones.length === 0) return;
    
    vehicles.forEach(vehicle => {
      if (!vehicle.tracks) return;
      
      noEntryZones.forEach(zone => {
        const allowedTypes = zone.allowed_vehicle_types || [];
        if (allowedTypes.length > 0 && !allowedTypes.includes(vehicle.type)) {
          return;
        }
        
        let violationStart = null;
        let violationTracks = [];
        
        for (let i = 0; i < vehicle.tracks.length; i++) {
          const track = vehicle.tracks[i];
          const point = { latitude: track.latitude, longitude: track.longitude };
          
          const isInZone = zone.polygon ? 
            GeoUtils.isPointInPolygon(point, zone.polygon) : false;
          
          if (isInZone) {
            if (!violationStart) {
              violationStart = track.timestamp;
              violationTracks = [track];
            } else {
              violationTracks.push(track);
            }
          } else {
            if (violationStart) {
              const endTime = track.timestamp;
              const duration = endTime - violationStart;
              
              if (duration >= 5000) {
                this.createRiskEvent(
                  'no_entry_violation',
                  'high',
                  violationStart,
                  endTime,
                  `${vehicle.type} ${vehicle.id} 进入禁入区：${zone.name || '未知区域'}`,
                  {
                    vehicleId: vehicle.id,
                    vehicleType: vehicle.type,
                    zoneName: zone.name,
                    zonePolygon: zone.polygon,
                    tracks: violationTracks
                  }
                );
              }
              
              violationStart = null;
              violationTracks = [];
            }
          }
        }
        
        if (violationStart && vehicle.tracks.length > 0) {
          const lastTrack = vehicle.tracks[vehicle.tracks.length - 1];
          const endTime = lastTrack.timestamp;
          const duration = endTime - violationStart;
          
          if (duration >= 5000) {
            this.createRiskEvent(
              'no_entry_violation',
              'high',
              violationStart,
              endTime,
              `${vehicle.type} ${vehicle.id} 进入禁入区：${zone.name || '未知区域'}`,
              {
                vehicleId: vehicle.id,
                vehicleType: vehicle.type,
                zoneName: zone.name
              }
            );
          }
        }
      });
    });
  }

  detectVehicleConflicts() {
    const { vehicles, safetyRules } = this.dataManager;
    const minDistance = safetyRules?.proximityRules?.min_distance || 10;
    
    if (vehicles.length < 2) return;
    
    const timePoints = this.collectAllTimePoints();
    
    timePoints.forEach(timeMs => {
      const activeVehicles = [];
      
      vehicles.forEach(vehicle => {
        const pos = this.dataManager.getVehiclePositionAtTime(vehicle, timeMs);
        if (pos) {
          activeVehicles.push({
            vehicle,
            position: pos
          });
        }
      });
      
      for (let i = 0; i < activeVehicles.length; i++) {
        for (let j = i + 1; j < activeVehicles.length; j++) {
          const v1 = activeVehicles[i];
          const v2 = activeVehicles[j];
          
          const distance = GeoUtils.haversineDistance(
            v1.position.latitude, v1.position.longitude,
            v2.position.latitude, v2.position.longitude
          );
          
          if (distance < minDistance) {
            const existingConflict = this.riskEvents.find(e => 
              e.type === 'vehicle_conflict' &&
              ((e.metadata.vehicleId1 === v1.vehicle.id && e.metadata.vehicleId2 === v2.vehicle.id) ||
               (e.metadata.vehicleId1 === v2.vehicle.id && e.metadata.vehicleId2 === v1.vehicle.id)) &&
              Math.abs(e.endTime - timeMs) < 5000
            );
            
            if (existingConflict) {
              existingConflict.endTime = timeMs;
              existingConflict.duration = existingConflict.endTime - existingConflict.startTime;
              if (distance < existingConflict.metadata.minDistance) {
                existingConflict.metadata.minDistance = distance;
              }
            } else {
              this.createRiskEvent(
                'vehicle_conflict',
                distance < minDistance * 0.5 ? 'high' : 'medium',
                timeMs,
                timeMs,
                `${v1.vehicle.type} ${v1.vehicle.id} 与 ${v2.vehicle.type} ${v2.vehicle.id} 距离过近：${distance.toFixed(1)}m，最小安全距离：${minDistance}m`,
                {
                  vehicleId1: v1.vehicle.id,
                  vehicleType1: v1.vehicle.type,
                  vehicleId2: v2.vehicle.id,
                  vehicleType2: v2.vehicle.type,
                  minDistance: distance,
                  safeDistance: minDistance
                }
              );
            }
          }
        }
      }
    });
  }

  detectFuelingBridgeOverlap() {
    const { vehicles, turnarounds, safetyRules, stands } = this.dataManager;
    const fuelingVehicles = vehicles.filter(v => v.type === 'fuel_truck' || v.type === '加油车');
    const bridgeVehicles = vehicles.filter(v => v.type === 'passenger_bridge' || v.type === '登机桥');
    
    if (fuelingVehicles.length === 0 || bridgeVehicles.length === 0) return;
    
    turnarounds.forEach(turnaround => {
      const stand = stands.find(s => s.id === turnaround.standId);
      if (!stand) return;
      
      const standTimeStart = turnaround.arrivalTime;
      const standTimeEnd = turnaround.departureTime;
      
      if (!standTimeStart || !standTimeEnd) return;
      
      const fuelingOperations = this.findOperationsNearStand(
        fuelingVehicles, stand, standTimeStart, standTimeEnd
      );
      
      const bridgeOperations = this.findOperationsNearStand(
        bridgeVehicles, stand, standTimeStart, standTimeEnd
      );
      
      fuelingOperations.forEach(fuelOp => {
        bridgeOperations.forEach(bridgeOp => {
          const overlapStart = Math.max(fuelOp.startTime, bridgeOp.startTime);
          const overlapEnd = Math.min(fuelOp.endTime, bridgeOp.endTime);
          
          if (overlapStart < overlapEnd) {
            const overlapDuration = overlapEnd - overlapStart;
            
            if (overlapDuration >= 10000) {
              this.createRiskEvent(
                'fuel_bridge_overlap',
                'high',
                overlapStart,
                overlapEnd,
                `航班 ${turnaround.flightNumber} 在机位 ${stand.id} 作业期间，加油车 ${fuelOp.vehicleId} 与登机桥 ${bridgeOp.vehicleId} 作业时间重叠 ${(overlapDuration / 1000).toFixed(0)} 秒`,
                {
                  flightNumber: turnaround.flightNumber,
                  standId: stand.id,
                  fuelVehicleId: fuelOp.vehicleId,
                  bridgeVehicleId: bridgeOp.vehicleId,
                  overlapDuration
                }
              );
            }
          }
        });
      });
    });
  }

  collectAllTimePoints() {
    const { vehicles } = this.dataManager;
    const timePoints = new Set();
    const stepMs = 1000;
    
    let minTime = Infinity;
    let maxTime = -Infinity;
    
    vehicles.forEach(vehicle => {
      if (vehicle.tracks && vehicle.tracks.length > 0) {
        const first = vehicle.tracks[0].timestamp;
        const last = vehicle.tracks[vehicle.tracks.length - 1].timestamp;
        if (first < minTime) minTime = first;
        if (last > maxTime) maxTime = last;
      }
    });
    
    if (minTime === Infinity) return [];
    
    for (let t = minTime; t <= maxTime; t += stepMs) {
      timePoints.add(t);
    }
    
    return Array.from(timePoints).sort((a, b) => a - b);
  }

  findOperationsNearStand(vehicles, stand, timeStart, timeEnd) {
    const operations = [];
    const standRadius = 50;
    
    vehicles.forEach(vehicle => {
      if (!vehicle.tracks) return;
      
      let inAreaStart = null;
      let lastInArea = false;
      
      vehicle.tracks.forEach(track => {
        if (track.timestamp < timeStart || track.timestamp > timeEnd) return;
        
        const distance = GeoUtils.haversineDistance(
          track.latitude, track.longitude,
          stand.latitude, stand.longitude
        );
        
        const isInArea = distance <= standRadius;
        
        if (isInArea && !lastInArea) {
          inAreaStart = track.timestamp;
        }
        
        if (!isInArea && lastInArea && inAreaStart) {
          operations.push({
            vehicleId: vehicle.id,
            startTime: inAreaStart,
            endTime: track.timestamp
          });
          inAreaStart = null;
        }
        
        lastInArea = isInArea;
      });
      
      if (inAreaStart) {
        const lastTrack = vehicle.tracks[vehicle.tracks.length - 1];
        operations.push({
          vehicleId: vehicle.id,
          startTime: inAreaStart,
          endTime: lastTrack.timestamp
        });
      }
    });
    
    return operations;
  }

  getRisksByLevel(level) {
    return this.riskEvents.filter(e => e.level === level);
  }

  getRisksByType(type) {
    return this.riskEvents.filter(e => e.type === type);
  }

  getRisksInTimeRange(startTime, endTime) {
    return this.riskEvents.filter(e => 
      (e.startTime >= startTime && e.startTime <= endTime) ||
      (e.endTime >= startTime && e.endTime <= endTime) ||
      (e.startTime <= startTime && e.endTime >= endTime)
    );
  }

  getRiskSummary() {
    const high = this.getRisksByLevel('high').length;
    const medium = this.getRisksByLevel('medium').length;
    const low = this.getRisksByLevel('low').length;
    
    const byType = {};
    this.riskEvents.forEach(e => {
      byType[e.type] = (byType[e.type] || 0) + 1;
    });
    
    return {
      total: this.riskEvents.length,
      byLevel: { high, medium, low },
      byType
    };
  }
}

export default RiskDetector;
