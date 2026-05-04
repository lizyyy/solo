const timeUtils = require('../utils/time');

class TravelTimeService {
  constructor(travelTimesData, roadRulesData) {
    this.travelTimes = travelTimesData || { times: {}, locations: [] };
    this.roadRules = roadRulesData || {};
    this.locationIndex = this.buildLocationIndex();
  }

  buildLocationIndex() {
    const index = {};
    if (this.travelTimes.locations) {
      this.travelTimes.locations.forEach(loc => {
        index[loc.id] = loc;
      });
    }
    return index;
  }

  getTravelTime(fromId, toId, vehicleType = 'electric_bike', timeOfDay = null) {
    const times = this.travelTimes.times || {};
    
    if (!times[fromId] || times[fromId][toId] === undefined) {
      return this.estimateTravelTime(fromId, toId, vehicleType);
    }
    
    let baseTime = times[fromId][toId];
    
    if (timeOfDay) {
      baseTime = this.applyTimeSlotMultiplier(baseTime, timeOfDay, vehicleType);
    }
    
    return Math.ceil(baseTime);
  }

  estimateTravelTime(fromId, toId, vehicleType = 'electric_bike') {
    const fromLoc = this.locationIndex[fromId];
    const toLoc = this.locationIndex[toId];
    
    if (!fromLoc || !toLoc) {
      return 15;
    }
    
    const distanceKm = this.haversineDistance(
      fromLoc.lat, fromLoc.lng,
      toLoc.lat, toLoc.lng
    );
    
    const speeds = {
      car: 30,
      electric_bike: 15,
      bicycle: 10
    };
    
    const speed = speeds[vehicleType] || 15;
    const timeMinutes = (distanceKm / speed) * 60;
    
    return Math.ceil(timeMinutes + 2);
  }

  haversineDistance(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c;
  }

  toRad(deg) {
    return deg * (Math.PI / 180);
  }

  applyTimeSlotMultiplier(timeMinutes, timeOfDay, vehicleType) {
    const timeSlots = this.roadRules.time_slots || [];
    const timeMinutesVal = typeof timeOfDay === 'string' 
      ? timeUtils.timeToMinutes(timeOfDay) 
      : timeOfDay;
    
    for (const slot of timeSlots) {
      const slotStart = timeUtils.timeToMinutes(slot.start_time);
      const slotEnd = timeUtils.timeToMinutes(slot.end_time);
      
      if (timeMinutesVal >= slotStart && timeMinutesVal < slotEnd) {
        if (slot.affected_vehicle_types.includes(vehicleType)) {
          return timeMinutes * slot.travel_time_multiplier;
        }
      }
    }
    
    return timeMinutes;
  }

  checkRestriction(lat, lng, vehicleType, timeOfDay, dayOfWeek) {
    const zones = this.roadRules.restriction_zones || [];
    const timeMinutes = typeof timeOfDay === 'string' 
      ? timeUtils.timeToMinutes(timeOfDay) 
      : timeOfDay;
    const weekday = dayOfWeek || timeUtils.getDayOfWeek();
    
    for (const zone of zones) {
      if (lat >= zone.lat_min && lat <= zone.lat_max &&
          lng >= zone.lng_min && lng <= zone.lng_max) {
        
        for (const restriction of zone.restrictions) {
          if (restriction.vehicle_type === vehicleType) {
            const weekdayRules = restriction.weekday_restrictions || {};
            const timeRanges = weekdayRules[weekday] || [];
            
            for (const range of timeRanges) {
              const [start, end] = range.split('-');
              const rangeStart = timeUtils.timeToMinutes(start);
              const rangeEnd = timeUtils.timeToMinutes(end);
              
              if (timeMinutes >= rangeStart && timeMinutes < rangeEnd) {
                return {
                  restricted: true,
                  zone: zone.name,
                  restriction: restriction.description,
                  timeRange: range
                };
              }
            }
          }
        }
      }
    }
    
    return { restricted: false };
  }

  getLocation(id) {
    return this.locationIndex[id];
  }

  getAllLocations() {
    return this.travelTimes.locations || [];
  }
}

module.exports = TravelTimeService;
