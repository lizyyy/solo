const { MATCHING_WEIGHTS } = require('../utils/constants');

const LOCATION_ALIASES = {
  '1号楼': { lat: 39.9042, lng: 116.4074, alias: 'building_1' },
  '2号楼': { lat: 39.9045, lng: 116.4078, alias: 'building_2' },
  '3号楼': { lat: 39.9048, lng: 116.4082, alias: 'building_3' },
  '前台': { lat: 39.9040, lng: 116.4070, alias: 'reception' },
  '星巴克': { lat: 39.9041, lng: 116.4071, alias: 'starbucks' },
  '便利店': { lat: 39.9039, lng: 116.4069, alias: 'convenience_store' },
  '地铁口': { lat: 39.9035, lng: 116.4065, alias: 'metro_entrance' },
  '园区东门': { lat: 39.9050, lng: 116.4090, alias: 'east_gate' },
  '停车场': { lat: 39.9030, lng: 116.4060, alias: 'parking_lot' },
  '快递柜': { lat: 39.9043, lng: 116.4073, alias: 'package_locker' }
};

class MatchingEngine {
  static calculateMatchScore(request, trip) {
    const breakdown = {
      total_score: 0,
      components: {},
      filters_passed: [],
      filters_failed: []
    };

    const routeCheck = this.checkRouteProximity(request, trip);
    if (!routeCheck.passed) {
      breakdown.filters_failed.push({
        filter: 'route_proximity',
        reason: routeCheck.reason
      });
      return {
        matched: false,
        ...breakdown
      };
    }
    breakdown.filters_passed.push('route_proximity');
    breakdown.components.route_proximity = {
      score: routeCheck.score,
      weight: MATCHING_WEIGHTS.ROUTE_PROXIMITY,
      description: routeCheck.description
    };

    const timeCheck = this.checkTimeWindow(request, trip);
    if (!timeCheck.passed) {
      breakdown.filters_failed.push({
        filter: 'time_window',
        reason: timeCheck.reason
      });
      return {
        matched: false,
        ...breakdown
      };
    }
    breakdown.filters_passed.push('time_window');
    breakdown.components.time_window = {
      score: timeCheck.score,
      weight: MATCHING_WEIGHTS.TIME_WINDOW,
      description: timeCheck.description
    };

    const capacityCheck = this.checkCapacity(request, trip);
    if (!capacityCheck.passed) {
      breakdown.filters_failed.push({
        filter: 'capacity',
        reason: capacityCheck.reason
      });
      return {
        matched: false,
        ...breakdown
      };
    }
    breakdown.filters_passed.push('capacity');
    breakdown.components.capacity = {
      score: capacityCheck.score,
      weight: MATCHING_WEIGHTS.CAPACITY,
      description: capacityCheck.description
    };

    const forbiddenCheck = this.checkForbiddenItems(request, trip);
    if (!forbiddenCheck.passed) {
      breakdown.filters_failed.push({
        filter: 'forbidden_items',
        reason: forbiddenCheck.reason
      });
      return {
        matched: false,
        ...breakdown
      };
    }
    breakdown.filters_passed.push('forbidden_items');
    breakdown.components.forbidden_items = {
      score: 1.0,
      weight: MATCHING_WEIGHTS.FORBIDDEN_ITEMS,
      description: '物品类型不在禁带品列表中'
    };

    const tipScore = this.calculateTipScore(request.tip_amount || 0);
    breakdown.components.tip_amount = {
      score: tipScore,
      weight: MATCHING_WEIGHTS.TIP_AMOUNT,
      description: `小费金额: ¥${request.tip_amount || 0}`
    };

    let totalScore = 0;
    for (const [key, component] of Object.entries(breakdown.components)) {
      totalScore += component.score * component.weight;
    }
    breakdown.total_score = Math.round(totalScore * 100) / 100;

    return {
      matched: true,
      request_id: request.id,
      trip_id: trip.id,
      ...breakdown
    };
  }

  static checkRouteProximity(request, trip) {
    const pickup = request.pickup_location;
    const dropoff = request.dropoff_location;
    const start = trip.start_location;
    const destination = trip.destination;
    const waypoints = trip.waypoints || [];

    const allTripLocations = [start, ...waypoints, destination];

    const pickupInTrip = allTripLocations.some(loc => this.areLocationsClose(pickup, loc));
    if (!pickupInTrip) {
      return {
        passed: false,
        reason: `取货点"${pickup}"不在顺路人的行程路线上。行程经过: ${allTripLocations.join(' → ')}`
      };
    }

    const dropoffInTrip = allTripLocations.some(loc => this.areLocationsClose(dropoff, loc));
    if (!dropoffInTrip) {
      return {
        passed: false,
        reason: `送达点"${dropoff}"不在顺路人的行程路线上。行程经过: ${allTripLocations.join(' → ')}`
      };
    }

    const pickupIndex = allTripLocations.findIndex(loc => this.areLocationsClose(pickup, loc));
    const dropoffIndex = allTripLocations.findIndex(loc => this.areLocationsClose(dropoff, loc));

    if (pickupIndex >= dropoffIndex) {
      return {
        passed: false,
        reason: `取货点"${pickup}"在送达点"${dropoff}"之后（方向相反）。行程顺序: ${allTripLocations.join(' → ')}`
      };
    }

    const totalStops = allTripLocations.length;
    const detourFactor = (dropoffIndex - pickupIndex + 1) / totalStops;
    const routeScore = 0.5 + detourFactor * 0.5;

    return {
      passed: true,
      score: routeScore,
      description: `取货点"${pickup}"和送达点"${dropoff}"在行程路线上，方向正确`
    };
  }

  static checkTimeWindow(request, trip) {
    const requestLatestTime = new Date(request.latest_delivery_time);
    const tripDeparture = new Date(trip.departure_time);
    const tripArrival = new Date(trip.arrival_time);

    if (requestLatestTime < tripDeparture) {
      return {
        passed: false,
        reason: `最晚送达时间(${this.formatTime(requestLatestTime)})早于顺路人出发时间(${this.formatTime(tripDeparture)})`
      };
    }

    if (requestLatestTime > tripArrival) {
      const diffHours = (requestLatestTime - tripArrival) / (1000 * 60 * 60);
      if (diffHours > 2) {
        return {
          passed: false,
          reason: `最晚送达时间(${this.formatTime(requestLatestTime)})比顺路人预计到达时间(${this.formatTime(tripArrival)})晚${diffHours.toFixed(1)}小时，时间窗口不匹配`
        };
      }
    }

    const timeDiff = Math.abs(requestLatestTime - tripArrival);
    const maxDiff = 2 * 60 * 60 * 1000;
    const timeScore = Math.max(0, 1 - timeDiff / maxDiff);

    return {
      passed: true,
      score: timeScore,
      description: `最晚送达时间(${this.formatTime(requestLatestTime)})与行程时间窗口(${this.formatTime(tripDeparture)} - ${this.formatTime(tripArrival)})匹配`
    };
  }

  static checkCapacity(request, trip) {
    const requestWeight = request.weight || 0;
    const requestVolume = request.volume || 0;
    const availableWeight = trip.available_capacity_weight || 0;
    const availableVolume = trip.available_capacity_volume || 0;

    if (requestWeight > availableWeight) {
      return {
        passed: false,
        reason: `物品重量(${requestWeight}kg)超过顺路人可带重量(${availableWeight}kg)`
      };
    }

    if (requestVolume > availableVolume) {
      return {
        passed: false,
        reason: `物品体积(${requestVolume}L)超过顺路人可带体积(${availableVolume}L)`
      };
    }

    const weightRatio = 1 - (requestWeight / availableWeight);
    const volumeRatio = 1 - (requestVolume / availableVolume);
    const capacityScore = (weightRatio + volumeRatio) / 2;

    return {
      passed: true,
      score: capacityScore,
      description: `物品(${requestWeight}kg/${requestVolume}L)在可用容量(${availableWeight}kg/${availableVolume}L)范围内`
    };
  }

  static checkForbiddenItems(request, trip) {
    const itemType = request.item_type?.toLowerCase() || '';
    const forbiddenItems = (trip.forbidden_items || []).map(item => item.toLowerCase());

    if (forbiddenItems.length === 0) {
      return { passed: true };
    }

    const isForbidden = forbiddenItems.some(forbidden => {
      return itemType.includes(forbidden) || forbidden.includes(itemType);
    });

    if (isForbidden) {
      return {
        passed: false,
        reason: `物品类型"${request.item_type}"属于顺路人禁带品列表: ${trip.forbidden_items.join(', ')}`
      };
    }

    return { passed: true };
  }

  static calculateTipScore(tipAmount) {
    if (tipAmount >= 50) return 1.0;
    if (tipAmount >= 30) return 0.9;
    if (tipAmount >= 20) return 0.8;
    if (tipAmount >= 10) return 0.7;
    if (tipAmount >= 5) return 0.5;
    if (tipAmount > 0) return 0.3;
    return 0.1;
  }

  static areLocationsClose(loc1, loc2) {
    const loc1Clean = loc1?.toLowerCase().trim() || '';
    const loc2Clean = loc2?.toLowerCase().trim() || '';

    if (loc1Clean === loc2Clean) return true;

    if (loc1Clean.includes(loc2Clean) || loc2Clean.includes(loc1Clean)) return true;

    const loc1Alias = LOCATION_ALIASES[loc1];
    const loc2Alias = LOCATION_ALIASES[loc2];
    if (loc1Alias && loc2Alias && loc1Alias.alias === loc2Alias.alias) {
      return true;
    }

    return false;
  }

  static formatTime(date) {
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  static findMatchingTrips(request, trips) {
    const results = [];

    for (const trip of trips) {
      const matchResult = this.calculateMatchScore(request, trip);
      results.push(matchResult);
    }

    const matched = results.filter(r => r.matched);
    const unmatched = results.filter(r => !r.matched);

    matched.sort((a, b) => b.total_score - a.total_score);

    return {
      request_id: request.id,
      best_matches: matched,
      unmatched_trips: unmatched,
      match_count: matched.length,
      total_trip_count: trips.length
    };
  }

  static findMatchingRequests(trip, requests) {
    const results = [];

    for (const request of requests) {
      const matchResult = this.calculateMatchScore(request, trip);
      results.push(matchResult);
    }

    const matched = results.filter(r => r.matched);
    const unmatched = results.filter(r => !r.matched);

    matched.sort((a, b) => b.total_score - a.total_score);

    return {
      trip_id: trip.id,
      best_matches: matched,
      unmatched_requests: unmatched,
      match_count: matched.length,
      total_request_count: requests.length
    };
  }
}

module.exports = MatchingEngine;
