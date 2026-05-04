import Papa from 'papaparse';
import yaml from 'js-yaml';
import { TimeUtils } from '../utils/timeUtils.js';
import { GeoUtils } from '../utils/geoUtils.js';

export const Parsers = {
  parseJson(text) {
    try {
      return JSON.parse(text);
    } catch (e) {
      console.error('JSON 解析错误:', e);
      return null;
    }
  },

  parseCsv(text, options = {}) {
    return new Promise((resolve) => {
      Papa.parse(text, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        ...options,
        complete: (results) => {
          resolve(results.data);
        },
        error: (error) => {
          console.error('CSV 解析错误:', error);
          resolve(null);
        }
      });
    });
  },

  parseYaml(text) {
    try {
      return yaml.load(text);
    } catch (e) {
      console.error('YAML 解析错误:', e);
      return null;
    }
  },

  async parseFile(file) {
    const text = await file.text();
    const name = file.name.toLowerCase();
    
    let data = null;
    let type = null;
    
    if (name.includes('stands') && name.endsWith('.json')) {
      data = this.parseJson(text);
      type = 'stands';
    } else if (name.includes('vehicle') && name.includes('track') && name.endsWith('.csv')) {
      data = await this.parseCsv(text);
      type = 'vehicle_tracks';
    } else if (name.includes('turnaround') && (name.endsWith('.yaml') || name.endsWith('.yml'))) {
      data = this.parseYaml(text);
      type = 'turnarounds';
    } else if (name.includes('safety') && name.includes('rule') && name.endsWith('.json')) {
      data = this.parseJson(text);
      type = 'safety_rules';
    } else {
      if (name.endsWith('.json')) {
        data = this.parseJson(text);
        type = 'json';
      } else if (name.endsWith('.csv')) {
        data = await this.parseCsv(text);
        type = 'csv';
      } else if (name.endsWith('.yaml') || name.endsWith('.yml')) {
        data = this.parseYaml(text);
        type = 'yaml';
      }
    }
    
    return { data, type, filename: file.name };
  },

  processStands(standsData) {
    if (!standsData) return [];
    
    let stands = standsData;
    if (stands.stands && Array.isArray(stands.stands)) {
      stands = stands.stands;
    }
    
    if (!Array.isArray(stands)) {
      console.warn('processStands: stands is not an array', stands);
      return [];
    }
    
    return stands.map(stand => ({
      id: stand.id || stand.name || stand.stand_id,
      name: stand.name || stand.id,
      latitude: stand.latitude || stand.lat,
      longitude: stand.longitude || stand.lon,
      type: stand.type || 'passenger',
      gate: stand.gate,
      polygon: stand.polygon || null,
      restricted: stand.restricted || false
    }));
  },

  processTurnarounds(turnaroundsData) {
    if (!turnaroundsData) return [];
    
    let turnarounds = turnaroundsData;
    if (turnarounds.turnarounds && Array.isArray(turnarounds.turnarounds)) {
      turnarounds = turnarounds.turnarounds;
    } else if (turnarounds.flights && Array.isArray(turnarounds.flights)) {
      turnarounds = turnarounds.flights;
    }
    
    if (!Array.isArray(turnarounds)) {
      console.warn('processTurnarounds: turnarounds is not an array', turnarounds);
      return [];
    }
    
    return turnarounds.map(ta => {
      const arrivalTime = TimeUtils.parseTime(ta.arrival_time || ta.arrival);
      const departureTime = TimeUtils.parseTime(ta.departure_time || ta.departure);
      
      return {
        id: ta.flight_id || ta.id || ta.flight_number,
        flightNumber: ta.flight_number || ta.flight_id,
        aircraftType: ta.aircraft_type || ta.aircraft,
        standId: ta.stand_id || ta.stand,
        arrivalTime,
        departureTime,
        operations: ta.operations || [],
        gate: ta.gate
      };
    });
  },

  processVehicleTracks(tracksData, startTimeMs = null) {
    if (!tracksData) return null;
    
    const vehicles = {};
    
    tracksData.forEach(row => {
      const vehicleId = row.vehicle_id || row.id || row.vehicle;
      if (!vehicleId) return;
      
      if (!vehicles[vehicleId]) {
        vehicles[vehicleId] = {
          id: vehicleId,
          type: row.vehicle_type || row.type || 'unknown',
          tracks: []
        };
      }
      
      const trackPoint = {
        latitude: row.latitude || row.lat,
        longitude: row.longitude || row.lon,
        timestamp: TimeUtils.parseTime(row.timestamp || row.time || row.datetime),
        speed: row.speed,
        heading: row.heading || row.direction,
        status: row.status
      };
      
      if (trackPoint.latitude !== undefined && trackPoint.longitude !== undefined) {
        vehicles[vehicleId].tracks.push(trackPoint);
      }
    });
    
    const vehicleList = Object.values(vehicles);
    
    vehicleList.forEach(vehicle => {
      vehicle.tracks.sort((a, b) => a.timestamp - b.timestamp);
    });
    
    let globalStartTime = startTimeMs;
    if (!globalStartTime) {
      let minTime = Infinity;
      vehicleList.forEach(v => {
        if (v.tracks.length > 0 && v.tracks[0].timestamp < minTime) {
          minTime = v.tracks[0].timestamp;
        }
      });
      globalStartTime = minTime;
    }
    
    vehicleList.forEach(vehicle => {
      vehicle.tracks = TimeUtils.handleMidnightCrossing(vehicle.tracks, globalStartTime);
    });
    
    return vehicleList;
  },

  processSafetyRules(rulesData) {
    if (!rulesData) {
      return {
        speedLimits: [],
        restrictedAreas: [],
        noEntryZones: [],
        fuelingRules: {},
        bridgeRules: {},
        proximityRules: {}
      };
    }
    
    const rules = rulesData.rules || rulesData;
    
    return {
      speedLimits: rules.speed_limits || [],
      restrictedAreas: rules.restricted_areas || [],
      noEntryZones: rules.no_entry_zones || [],
      fuelingRules: rules.fueling_rules || {},
      bridgeRules: rules.bridge_rules || {},
      proximityRules: rules.proximity_rules || {}
    };
  },

  fillGpsGaps(vehicle, maxGapMs = 60000, interpolationSteps = 5) {
    if (!vehicle || !vehicle.tracks || vehicle.tracks.length < 2) {
      return vehicle;
    }
    
    const tracks = vehicle.tracks;
    const filledTracks = [];
    const gapInfo = [];
    
    for (let i = 0; i < tracks.length; i++) {
      filledTracks.push(tracks[i]);
      
      if (i < tracks.length - 1) {
        const current = tracks[i];
        const next = tracks[i + 1];
        const gapMs = next.timestamp - current.timestamp;
        
        if (gapMs > maxGapMs) {
          gapInfo.push({
            startIndex: i,
            endIndex: i + 1,
            startTime: current.timestamp,
            endTime: next.timestamp,
            durationMs: gapMs
          });
          
          const steps = Math.min(interpolationSteps, Math.floor(gapMs / 5000));
          
          for (let j = 1; j <= steps; j++) {
            const factor = j / (steps + 1);
            const interpolated = GeoUtils.interpolatePoint(current, next, factor);
            interpolated.interpolated = true;
            interpolated.gapIndex = gapInfo.length - 1;
            filledTracks.push(interpolated);
          }
        }
      }
    }
    
    filledTracks.sort((a, b) => a.timestamp - b.timestamp);
    
    return {
      ...vehicle,
      tracks: filledTracks,
      gaps: gapInfo,
      hasGaps: gapInfo.length > 0
    };
  },

  calculateVehicleSpeeds(vehicle) {
    if (!vehicle || !vehicle.tracks || vehicle.tracks.length < 2) {
      return vehicle;
    }
    
    const tracks = vehicle.tracks;
    
    for (let i = 0; i < tracks.length; i++) {
      if (i === 0) {
        tracks[i].calculatedSpeed = tracks[i + 1] ? 
          GeoUtils.calculateSpeed(tracks[i], tracks[i + 1]) : 0;
      } else if (i === tracks.length - 1) {
        tracks[i].calculatedSpeed = tracks[i - 1] ? 
          GeoUtils.calculateSpeed(tracks[i - 1], tracks[i]) : 0;
      } else {
        const speed1 = GeoUtils.calculateSpeed(tracks[i - 1], tracks[i]);
        const speed2 = GeoUtils.calculateSpeed(tracks[i], tracks[i + 1]);
        tracks[i].calculatedSpeed = (speed1 + speed2) / 2;
      }
      
      if (tracks[i].speed === undefined || tracks[i].speed === null) {
        tracks[i].speed = tracks[i].calculatedSpeed;
      }
    }
    
    return vehicle;
  }
};

export default Parsers;
