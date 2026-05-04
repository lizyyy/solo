import { Parsers } from './parsers.js';
import { TimeUtils } from '../utils/timeUtils.js';
import { GeoUtils } from '../utils/geoUtils.js';

export class DataManager {
  constructor() {
    this.stands = [];
    this.vehicles = [];
    this.turnarounds = [];
    this.safetyRules = null;
    this.riskEvents = [];
    this.timeRange = { start: 0, end: 0 };
    this.centerCoords = { lat: 0, lon: 0 };
    this.loadedFiles = [];
  }

  async loadFile(file) {
    const result = await Parsers.parseFile(file);
    
    if (!result.data) {
      return { success: false, error: '文件解析失败', filename: result.filename };
    }
    
    this.loadedFiles.push({
      name: result.filename,
      type: result.type,
      size: file.size
    });
    
    switch (result.type) {
      case 'stands':
        this.stands = Parsers.processStands(result.data);
        this.calculateCenterCoords();
        break;
      case 'vehicle_tracks':
        this.vehicles = Parsers.processVehicleTracks(result.data, this.timeRange.start);
        this.vehicles = this.vehicles.map(v => {
          const v1 = Parsers.fillGpsGaps(v);
          return Parsers.calculateVehicleSpeeds(v1);
        });
        this.calculateTimeRange();
        break;
      case 'turnarounds':
        this.turnarounds = Parsers.processTurnarounds(result.data);
        break;
      case 'safety_rules':
        this.safetyRules = Parsers.processSafetyRules(result.data);
        break;
    }
    
    return { success: true, type: result.type, filename: result.filename };
  }

  async loadFiles(files) {
    const results = [];
    for (const file of files) {
      const result = await this.loadFile(file);
      results.push(result);
    }
    return results;
  }

  calculateCenterCoords() {
    if (this.stands.length === 0) {
      if (this.vehicles.length > 0 && this.vehicles[0].tracks.length > 0) {
        const firstTrack = this.vehicles[0].tracks[0];
        this.centerCoords = { lat: firstTrack.latitude, lon: firstTrack.longitude };
      }
      return;
    }
    
    let sumLat = 0;
    let sumLon = 0;
    
    this.stands.forEach(stand => {
      sumLat += stand.latitude;
      sumLon += stand.longitude;
    });
    
    this.centerCoords = {
      lat: sumLat / this.stands.length,
      lon: sumLon / this.stands.length
    };
  }

  calculateTimeRange() {
    let minTime = Infinity;
    let maxTime = -Infinity;
    
    this.vehicles.forEach(vehicle => {
      if (vehicle.tracks.length > 0) {
        const vehicleRange = TimeUtils.getTimeRange(vehicle.tracks);
        if (vehicleRange.start < minTime) minTime = vehicleRange.start;
        if (vehicleRange.end > maxTime) maxTime = vehicleRange.end;
      }
    });
    
    this.turnarounds.forEach(ta => {
      if (ta.arrivalTime !== null && ta.arrivalTime < minTime) {
        minTime = ta.arrivalTime;
      }
      if (ta.departureTime !== null && ta.departureTime > maxTime) {
        maxTime = ta.departureTime;
      }
    });
    
    this.timeRange = {
      start: minTime !== Infinity ? minTime : 0,
      end: maxTime !== -Infinity ? maxTime : 0
    };
  }

  getVehicleById(id) {
    return this.vehicles.find(v => v.id === id);
  }

  getTurnaroundById(id) {
    return this.turnarounds.find(t => t.id === id);
  }

  getStandById(id) {
    return this.stands.find(s => s.id === id);
  }

  getVehicleTypes() {
    const types = new Set();
    this.vehicles.forEach(v => types.add(v.type));
    return Array.from(types);
  }

  getVehiclesAtTime(timeMs) {
    return this.vehicles.filter(vehicle => {
      if (vehicle.tracks.length === 0) return false;
      return timeMs >= vehicle.tracks[0].timestamp && 
             timeMs <= vehicle.tracks[vehicle.tracks.length - 1].timestamp;
    });
  }

  getVehiclePositionAtTime(vehicle, timeMs) {
    if (!vehicle || !vehicle.tracks || vehicle.tracks.length === 0) return null;
    
    const tracks = vehicle.tracks;
    
    if (timeMs <= tracks[0].timestamp) {
      return { ...tracks[0], isInterpolated: false };
    }
    
    if (timeMs >= tracks[tracks.length - 1].timestamp) {
      return { ...tracks[tracks.length - 1], isInterpolated: false };
    }
    
    for (let i = 0; i < tracks.length - 1; i++) {
      const current = tracks[i];
      const next = tracks[i + 1];
      
      if (timeMs >= current.timestamp && timeMs <= next.timestamp) {
        const deltaTime = next.timestamp - current.timestamp;
        if (deltaTime === 0) {
          return { ...current, isInterpolated: false };
        }
        
        const factor = (timeMs - current.timestamp) / deltaTime;
        const interpolated = GeoUtils.interpolatePoint(current, next, factor);
        
        const heading = current.heading !== undefined ? current.heading :
          GeoUtils.calculateBearing(current, next);
        
        return {
          ...interpolated,
          heading,
          isInterpolated: true,
          index: i
        };
      }
    }
    
    return null;
  }

  getActiveTurnaroundsAtTime(timeMs) {
    return this.turnarounds.filter(ta => {
      return TimeUtils.isTimeInRange(timeMs, ta.arrivalTime, ta.departureTime);
    });
  }

  getFlightNumbers() {
    return this.turnarounds.map(t => t.flightNumber || t.id);
  }

  hasAllRequiredData() {
    return this.stands.length > 0 && 
           this.vehicles.length > 0 && 
           this.turnarounds.length > 0;
  }

  getDataSummary() {
    return {
      stands: this.stands.length,
      vehicles: this.vehicles.length,
      turnarounds: this.turnarounds.length,
      hasSafetyRules: this.safetyRules !== null,
      timeRange: {
        start: TimeUtils.formatTime(this.timeRange.start),
        end: TimeUtils.formatTime(this.timeRange.end)
      },
      centerCoords: this.centerCoords,
      loadedFiles: this.loadedFiles
    };
  }
}

export default DataManager;
