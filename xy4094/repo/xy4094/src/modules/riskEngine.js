import { GeoCalculator } from './geo.js';

export const RiskLevel = {
  CRITICAL: 'critical',
  WARNING: 'warning',
  INFO: 'info'
};

export const RiskType = {
  SPEED_EXCEED: 'speed_exceed',
  WIND_ANGLE_EXTREME: 'wind_angle_extreme',
  GIMBAL_ANGLE_ISSUE: 'gimbal_angle_issue',
  NO_FLY_ZONE_COLLISION: 'no_fly_zone_collision',
  NO_FLY_ZONE_PROXIMITY: 'no_fly_zone_proximity',
  ALERT_POINT: 'alert_point',
  MANUAL: 'manual'
};

export const RiskTypeNames = {
  [RiskType.SPEED_EXCEED]: '速度超限',
  [RiskType.WIND_ANGLE_EXTREME]: '风航夹角异常',
  [RiskType.GIMBAL_ANGLE_ISSUE]: '云台角度异常',
  [RiskType.NO_FLY_ZONE_COLLISION]: '闯入禁飞区',
  [RiskType.NO_FLY_ZONE_PROXIMITY]: '接近禁飞区',
  [RiskType.ALERT_POINT]: '告警点',
  [RiskType.MANUAL]: '人工标注'
};

export class RiskEngine {
  constructor() {
    this.geoCalculator = new GeoCalculator();
    
    this.config = {
      maxSpeed: 15,
      warningSpeed: 12,
      criticalWindAngle: 75,
      warningWindAngle: 60,
      maxGimbalAngle: 85,
      warningGimbalAngle: 75,
      noFlyZoneCriticalDistance: 0,
      noFlyZoneWarningDistance: 50,
      noFlyZoneInfoDistance: 100
    };
    
    this.riskEvents = [];
    this.manualAnnotations = [];
  }

  setConfig(config) {
    this.config = { ...this.config, ...config };
  }

  analyze(data) {
    this.riskEvents = [];
    
    const { track, weather, noFlyZones, alerts } = data;
    
    if (!track || !track.points || track.points.length === 0) {
      return [];
    }
    
    const points = track.points;
    
    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      const pointData = {
        ...point,
        index: i,
        progress: track.duration > 0 ? (point.timestamp - track.startTime) / track.duration : 0
      };
      
      this.checkSpeed(pointData);
      this.checkGimbalAngle(pointData);
      
      if (weather && weather.records) {
        const weatherAtTime = this.getWeatherAtTime(weather, point.timestamp);
        if (weatherAtTime) {
          this.checkWindAngle(pointData, weatherAtTime);
        }
      }
      
      if (noFlyZones && noFlyZones.features) {
        for (const zone of noFlyZones.features) {
          this.checkNoFlyZone(pointData, zone);
        }
      }
    }
    
    if (alerts && alerts.features) {
      for (const alert of alerts.features) {
        this.checkAlertPoint(alert, points);
      }
    }
    
    this.riskEvents.sort((a, b) => a.timestamp - b.timestamp);
    
    this.deduplicateEvents();
    
    return this.getAllEvents();
  }

  checkSpeed(point) {
    const speed = point.speed || 0;
    
    if (speed > this.config.maxSpeed) {
      this.addEvent({
        type: RiskType.SPEED_EXCEED,
        level: RiskLevel.CRITICAL,
        timestamp: point.timestamp,
        progress: point.progress,
        pointIndex: point.index,
        position: {
          latitude: point.latitude,
          longitude: point.longitude,
          altitude: point.altitude
        },
        details: {
          speed: speed,
          limit: this.config.maxSpeed,
          exceed: speed - this.config.maxSpeed
        },
        description: `速度严重超限: 当前 ${speed.toFixed(2)} m/s，限制 ${this.config.maxSpeed} m/s`
      });
    } else if (speed > this.config.warningSpeed) {
      this.addEvent({
        type: RiskType.SPEED_EXCEED,
        level: RiskLevel.WARNING,
        timestamp: point.timestamp,
        progress: point.progress,
        pointIndex: point.index,
        position: {
          latitude: point.latitude,
          longitude: point.longitude,
          altitude: point.altitude
        },
        details: {
          speed: speed,
          warningLimit: this.config.warningSpeed,
          maxLimit: this.config.maxSpeed
        },
        description: `速度接近限制: 当前 ${speed.toFixed(2)} m/s，警告阈值 ${this.config.warningSpeed} m/s`
      });
    }
  }

  checkWindAngle(point, weatherData) {
    const heading = point.heading || 0;
    const windDirection = weatherData.windDirection || 0;
    const windAngle = this.geoCalculator.calculateWindAngle(heading, windDirection);
    
    if (windAngle > this.config.criticalWindAngle) {
      this.addEvent({
        type: RiskType.WIND_ANGLE_EXTREME,
        level: RiskLevel.CRITICAL,
        timestamp: point.timestamp,
        progress: point.progress,
        pointIndex: point.index,
        position: {
          latitude: point.latitude,
          longitude: point.longitude,
          altitude: point.altitude
        },
        details: {
          windAngle: windAngle,
          heading: heading,
          windDirection: windDirection,
          windSpeed: weatherData.windSpeed,
          criticalAngle: this.config.criticalWindAngle
        },
        description: `风航夹角异常: 夹角 ${windAngle.toFixed(1)}°，风向 ${windDirection.toFixed(0)}°，航向 ${heading.toFixed(0)}°，风速 ${weatherData.windSpeed?.toFixed(1) || 0} m/s`
      });
    } else if (windAngle > this.config.warningWindAngle) {
      this.addEvent({
        type: RiskType.WIND_ANGLE_EXTREME,
        level: RiskLevel.WARNING,
        timestamp: point.timestamp,
        progress: point.progress,
        pointIndex: point.index,
        position: {
          latitude: point.latitude,
          longitude: point.longitude,
          altitude: point.altitude
        },
        details: {
          windAngle: windAngle,
          heading: heading,
          windDirection: windDirection,
          windSpeed: weatherData.windSpeed,
          warningAngle: this.config.warningWindAngle
        },
        description: `风航夹角较大: 夹角 ${windAngle.toFixed(1)}°，风向 ${windDirection.toFixed(0)}°，航向 ${heading.toFixed(0)}°`
      });
    }
  }

  checkGimbalAngle(point) {
    const gimbalPitch = Math.abs(point.gimbalPitch || 0);
    
    if (gimbalPitch > this.config.maxGimbalAngle) {
      this.addEvent({
        type: RiskType.GIMBAL_ANGLE_ISSUE,
        level: RiskLevel.CRITICAL,
        timestamp: point.timestamp,
        progress: point.progress,
        pointIndex: point.index,
        position: {
          latitude: point.latitude,
          longitude: point.longitude,
          altitude: point.altitude
        },
        details: {
          gimbalPitch: point.gimbalPitch,
          gimbalYaw: point.gimbalYaw,
          maxAngle: this.config.maxGimbalAngle
        },
        description: `云台角度超限: 俯仰角 ${point.gimbalPitch?.toFixed(1) || 0}°，最大允许 ${this.config.maxGimbalAngle}°，可能存在漏拍风险`
      });
    } else if (gimbalPitch > this.config.warningGimbalAngle) {
      this.addEvent({
        type: RiskType.GIMBAL_ANGLE_ISSUE,
        level: RiskLevel.WARNING,
        timestamp: point.timestamp,
        progress: point.progress,
        pointIndex: point.index,
        position: {
          latitude: point.latitude,
          longitude: point.longitude,
          altitude: point.altitude
        },
        details: {
          gimbalPitch: point.gimbalPitch,
          gimbalYaw: point.gimbalYaw,
          warningAngle: this.config.warningGimbalAngle
        },
        description: `云台角度接近极限: 俯仰角 ${point.gimbalPitch?.toFixed(1) || 0}°`
      });
    }
  }

  checkNoFlyZone(point, noFlyZone) {
    const collision = this.geoCalculator.checkCollisionWithZone(point, noFlyZone);
    
    const zoneName = noFlyZone.properties?.name || '未命名禁飞区';
    
    if (collision.collision) {
      this.addEvent({
        type: RiskType.NO_FLY_ZONE_COLLISION,
        level: RiskLevel.CRITICAL,
        timestamp: point.timestamp,
        progress: point.progress,
        pointIndex: point.index,
        position: {
          latitude: point.latitude,
          longitude: point.longitude,
          altitude: point.altitude
        },
        details: {
          zoneId: noFlyZone.id,
          zoneName: zoneName,
          zoneProperties: noFlyZone.properties,
          distance: 0
        },
        description: `闯入禁飞区: "${zoneName}"，严重违规`
      });
    } else if (collision.distance <= this.config.noFlyZoneWarningDistance) {
      this.addEvent({
        type: RiskType.NO_FLY_ZONE_PROXIMITY,
        level: RiskLevel.WARNING,
        timestamp: point.timestamp,
        progress: point.progress,
        pointIndex: point.index,
        position: {
          latitude: point.latitude,
          longitude: point.longitude,
          altitude: point.altitude
        },
        details: {
          zoneId: noFlyZone.id,
          zoneName: zoneName,
          zoneProperties: noFlyZone.properties,
          distance: collision.distance
        },
        description: `接近禁飞区: "${zoneName}"，距离 ${this.geoCalculator.formatDistance(collision.distance)}`
      });
    } else if (collision.distance <= this.config.noFlyZoneInfoDistance) {
      this.addEvent({
        type: RiskType.NO_FLY_ZONE_PROXIMITY,
        level: RiskLevel.INFO,
        timestamp: point.timestamp,
        progress: point.progress,
        pointIndex: point.index,
        position: {
          latitude: point.latitude,
          longitude: point.longitude,
          altitude: point.altitude
        },
        details: {
          zoneId: noFlyZone.id,
          zoneName: zoneName,
          zoneProperties: noFlyZone.properties,
          distance: collision.distance
        },
        description: `附近有禁飞区: "${zoneName}"，距离 ${this.geoCalculator.formatDistance(collision.distance)}`
      });
    }
  }

  checkAlertPoint(alert, trackPoints) {
    if (!alert.geometry || alert.geometry.type !== 'Point') {
      return;
    }
    
    const alertCoords = alert.geometry.coordinates;
    const alertPoint = {
      latitude: alertCoords[1],
      longitude: alertCoords[0]
    };
    
    let minDistance = Infinity;
    let closestPoint = null;
    let closestIndex = -1;
    
    for (let i = 0; i < trackPoints.length; i++) {
      const point = trackPoints[i];
      const distance = this.geoCalculator.distanceBetween(point, alertPoint);
      
      if (distance < minDistance) {
        minDistance = distance;
        closestPoint = point;
        closestIndex = i;
      }
    }
    
    if (closestPoint) {
      const level = alert.properties?.level || 
        (minDistance < 30 ? RiskLevel.CRITICAL : 
         minDistance < 100 ? RiskLevel.WARNING : RiskLevel.INFO);
      
      const trackProgress = trackPoints.length > 1 ? 
        (closestPoint.timestamp - trackPoints[0].timestamp) / 
        (trackPoints[trackPoints.length - 1].timestamp - trackPoints[0].timestamp) : 0;
      
      this.addEvent({
        type: RiskType.ALERT_POINT,
        level: level,
        timestamp: closestPoint.timestamp,
        progress: Math.max(0, Math.min(1, trackProgress)),
        pointIndex: closestIndex,
        position: {
          latitude: closestPoint.latitude,
          longitude: closestPoint.longitude,
          altitude: closestPoint.altitude
        },
        details: {
          alertId: alert.id,
          alertName: alert.properties?.name || '未命名告警点',
          alertProperties: alert.properties,
          distance: minDistance,
          alertPosition: alertPoint
        },
        description: `告警点附近: "${alert.properties?.name || '未命名告警点'}"，距离 ${this.geoCalculator.formatDistance(minDistance)}`
      });
    }
  }

  addEvent(event) {
    const eventWithId = {
      id: this.generateId(),
      ...event,
      isManual: false,
      createdAt: Date.now()
    };
    
    this.riskEvents.push(eventWithId);
  }

  addManualAnnotation(annotation) {
    const event = {
      id: this.generateId(),
      type: RiskType.MANUAL,
      level: annotation.level || RiskLevel.INFO,
      timestamp: annotation.timestamp,
      progress: annotation.progress || 0,
      pointIndex: annotation.pointIndex || 0,
      position: annotation.position,
      details: {
        notes: annotation.notes,
        user: annotation.user || 'user'
      },
      description: annotation.description || '人工标注',
      isManual: true,
      createdAt: Date.now()
    };
    
    this.manualAnnotations.push(event);
    return event;
  }

  removeManualAnnotation(eventId) {
    const index = this.manualAnnotations.findIndex(e => e.id === eventId);
    if (index > -1) {
      this.manualAnnotations.splice(index, 1);
      return true;
    }
    return false;
  }

  deduplicateEvents() {
    const typeGroups = new Map();
    
    for (const event of this.riskEvents) {
      const key = `${event.type}-${event.level}-${event.pointIndex}`;
      if (!typeGroups.has(key)) {
        typeGroups.set(key, event);
      }
    }
    
    this.riskEvents = Array.from(typeGroups.values());
    this.riskEvents.sort((a, b) => a.timestamp - b.timestamp);
  }

  getWeatherAtTime(weatherData, targetTimestamp) {
    if (!weatherData || !weatherData.records || weatherData.records.length === 0) {
      return null;
    }
    
    const records = weatherData.records;
    
    if (targetTimestamp <= records[0].timestamp) {
      return records[0];
    }
    
    if (targetTimestamp >= records[records.length - 1].timestamp) {
      return records[records.length - 1];
    }
    
    for (let i = 1; i < records.length; i++) {
      if (targetTimestamp <= records[i].timestamp) {
        const prev = records[i - 1];
        const curr = records[i];
        
        const timeDiff = curr.timestamp - prev.timestamp;
        const progress = (targetTimestamp - prev.timestamp) / timeDiff;
        
        return {
          timestamp: targetTimestamp,
          windSpeed: this.lerp(prev.windSpeed, curr.windSpeed, progress),
          windDirection: this.lerpAngle(prev.windDirection, curr.windDirection, progress)
        };
      }
    }
    
    return records[records.length - 1];
  }

  lerp(a, b, t) {
    return a + (b - a) * t;
  }

  lerpAngle(a, b, t) {
    const diff = ((b - a + 180) % 360) - 180;
    return (a + diff * t + 360) % 360;
  }

  getAllEvents() {
    const allEvents = [...this.riskEvents, ...this.manualAnnotations];
    allEvents.sort((a, b) => a.timestamp - b.timestamp);
    return allEvents;
  }

  getRiskEvents() {
    return [...this.riskEvents];
  }

  getManualAnnotations() {
    return [...this.manualAnnotations];
  }

  getEventsByLevel(level) {
    return this.getAllEvents().filter(e => e.level === level);
  }

  getEventsByType(type) {
    return this.getAllEvents().filter(e => e.type === type);
  }

  getEventStats() {
    const events = this.getAllEvents();
    return {
      total: events.length,
      critical: events.filter(e => e.level === RiskLevel.CRITICAL).length,
      warning: events.filter(e => e.level === RiskLevel.WARNING).length,
      info: events.filter(e => e.level === RiskLevel.INFO).length,
      manual: events.filter(e => e.isManual).length
    };
  }

  findEventAtTimestamp(timestamp, tolerance = 1000) {
    const events = this.getAllEvents();
    return events.find(e => Math.abs(e.timestamp - timestamp) <= tolerance);
  }

  findEventsInTimeRange(startTime, endTime) {
    return this.getAllEvents().filter(e => 
      e.timestamp >= startTime && e.timestamp <= endTime
    );
  }

  getNextEvent(currentTimestamp) {
    const events = this.getAllEvents();
    for (const event of events) {
      if (event.timestamp > currentTimestamp) {
        return event;
      }
    }
    return null;
  }

  getPreviousEvent(currentTimestamp) {
    const events = this.getAllEvents();
    for (let i = events.length - 1; i >= 0; i--) {
      if (events[i].timestamp < currentTimestamp) {
        return events[i];
      }
    }
    return null;
  }

  generateId() {
    return 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  clear() {
    this.riskEvents = [];
    this.manualAnnotations = [];
  }

  export() {
    return {
      config: { ...this.config },
      riskEvents: [...this.riskEvents],
      manualAnnotations: [...this.manualAnnotations]
    };
  }

  import(data) {
    if (data.config) {
      this.config = { ...this.config, ...data.config };
    }
    if (data.riskEvents) {
      this.riskEvents = [...data.riskEvents];
    }
    if (data.manualAnnotations) {
      this.manualAnnotations = [...data.manualAnnotations];
    }
  }
}

export default RiskEngine;
