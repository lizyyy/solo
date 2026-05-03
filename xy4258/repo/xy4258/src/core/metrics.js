const _ = require('lodash');
const dayjs = require('dayjs');

class MetricsCalculator {
  calculateSupplyDemandGap(stations, bikeGPS, timeWindowHours = 1) {
    const stationBikeCounts = this.aggregateBikesByStation(bikeGPS, stations);
    
    return stations.map(station => {
      const bikesNearby = stationBikeCounts[station.station_id] || 0;
      const stationBikes = station.current_bikes || 0;
      const totalAvailable = stationBikes + bikesNearby;
      
      const capacity = station.capacity || 20;
      const utilizationRate = totalAvailable / capacity;
      
      const gap = {
        station_id: station.station_id,
        station_name: station.name,
        latitude: station.latitude,
        longitude: station.longitude,
        capacity: capacity,
        current_bikes: stationBikes,
        bikes_nearby: bikesNearby,
        total_available: totalAvailable,
        utilization_rate: utilizationRate,
        gap_type: this.classifyGap(utilizationRate, totalAvailable, capacity),
        gap_value: totalAvailable - (capacity * 0.5)
      };
      
      return gap;
    });
  }

  aggregateBikesByStation(bikeGPS, stations, radiusMeters = 100) {
    const bikeCountByStation = {};
    
    stations.forEach(station => {
      bikeCountByStation[station.station_id] = 0;
    });
    
    bikeGPS.forEach(bike => {
      let nearestStation = null;
      let minDistance = Infinity;
      
      stations.forEach(station => {
        const distance = this.haversineDistance(
          bike.latitude, bike.longitude,
          station.latitude, station.longitude
        );
        
        if (distance < minDistance && distance <= radiusMeters) {
          minDistance = distance;
          nearestStation = station;
        }
      });
      
      if (nearestStation) {
        bikeCountByStation[nearestStation.station_id]++;
      }
    });
    
    return bikeCountByStation;
  }

  haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c;
  }

  toRad(deg) {
    return deg * (Math.PI / 180);
  }

  classifyGap(utilizationRate, totalAvailable, capacity) {
    if (utilizationRate >= 0.95) {
      return 'CRITICAL_OVERFLOW';
    } else if (utilizationRate >= 0.8) {
      return 'OVERFLOW';
    } else if (utilizationRate >= 0.6) {
      return 'NORMAL_HIGH';
    } else if (utilizationRate >= 0.3) {
      return 'NORMAL';
    } else if (utilizationRate >= 0.1) {
      return 'LOW';
    } else {
      return 'CRITICAL_SHORTAGE';
    }
  }

  aggregateByTimeWindow(bikeGPS, windowMinutes = 30) {
    const grouped = _.groupBy(bikeGPS, bike => {
      const timestamp = bike.timestamp;
      const windowStart = Math.floor(timestamp / (windowMinutes * 60 * 1000)) * (windowMinutes * 60 * 1000);
      return windowStart;
    });
    
    return Object.entries(grouped).map(([windowStart, bikes]) => ({
      window_start: parseInt(windowStart),
      window_end: parseInt(windowStart) + windowMinutes * 60 * 1000,
      bike_count: bikes.length,
      unique_bikes: _.uniqBy(bikes, 'bike_id').length
    })).sort((a, b) => a.window_start - b.window_start);
  }

  calculateStationRisks(stationGaps, bikeGPS) {
    return stationGaps.map(gap => {
      const riskScore = this.calculateRiskScore(gap);
      const abandonedBikes = this.findAbandonedBikesNearStation(gap, bikeGPS);
      
      return {
        ...gap,
        risk_score: riskScore,
        risk_level: this.classifyRiskLevel(riskScore),
        abandoned_bikes_count: abandonedBikes.length,
        abandoned_bikes: abandonedBikes
      };
    }).sort((a, b) => b.risk_score - a.risk_score);
  }

  calculateRiskScore(gap) {
    let score = 0;
    
    switch (gap.gap_type) {
      case 'CRITICAL_OVERFLOW':
        score += 100;
        break;
      case 'OVERFLOW':
        score += 60;
        break;
      case 'CRITICAL_SHORTAGE':
        score += 80;
        break;
      case 'LOW':
        score += 30;
        break;
      case 'NORMAL_HIGH':
        score += 15;
        break;
      default:
        score += 0;
    }
    
    const overflowAmount = gap.total_available - gap.capacity;
    if (overflowAmount > 0) {
      score += overflowAmount * 5;
    }
    
    const shortageAmount = gap.capacity * 0.3 - gap.total_available;
    if (shortageAmount > 0) {
      score += shortageAmount * 3;
    }
    
    return Math.min(score, 200);
  }

  classifyRiskLevel(score) {
    if (score >= 100) return 'CRITICAL';
    if (score >= 60) return 'HIGH';
    if (score >= 30) return 'MEDIUM';
    return 'LOW';
  }

  findAbandonedBikesNearStation(station, bikeGPS, radiusMeters = 200, idleHours = 24) {
    const now = Date.now();
    const idleThreshold = idleHours * 60 * 60 * 1000;
    
    const bikeLatestPositions = {};
    bikeGPS.forEach(bike => {
      if (!bikeLatestPositions[bike.bike_id] || 
          bike.timestamp > bikeLatestPositions[bike.bike_id].timestamp) {
        bikeLatestPositions[bike.bike_id] = bike;
      }
    });
    
    return Object.values(bikeLatestPositions).filter(bike => {
      const distance = this.haversineDistance(
        bike.latitude, bike.longitude,
        station.latitude, station.longitude
      );
      
      const timeSinceLastSeen = now - bike.timestamp;
      
      return distance <= radiusMeters && timeSinceLastSeen >= idleThreshold;
    }).map(bike => ({
      bike_id: bike.bike_id,
      latitude: bike.latitude,
      longitude: bike.longitude,
      last_seen: bike.timestamp,
      idle_hours: Math.round((now - bike.timestamp) / (60 * 60 * 1000))
    }));
  }

  generateSchedulingSuggestions(riskStations) {
    const suggestions = [];
    const overflowStations = riskStations.filter(s => 
      ['CRITICAL_OVERFLOW', 'OVERFLOW'].includes(s.gap_type)
    );
    const shortageStations = riskStations.filter(s => 
      ['CRITICAL_SHORTAGE', 'LOW'].includes(s.gap_type)
    );
    
    overflowStations.forEach(fromStation => {
      const bikesToMove = Math.floor(fromStation.total_available - fromStation.capacity * 0.7);
      
      if (bikesToMove > 0) {
        const nearbyShortage = shortageStations
          .filter(s => {
            const dist = this.haversineDistance(
              fromStation.latitude, fromStation.longitude,
              s.latitude, s.longitude
            );
            return dist < 3000;
          })
          .sort((a, b) => {
            const distA = this.haversineDistance(
              fromStation.latitude, fromStation.longitude,
              a.latitude, a.longitude
            );
            const distB = this.haversineDistance(
              fromStation.latitude, fromStation.longitude,
              b.latitude, b.longitude
            );
            return distA - distB;
          });

        if (nearbyShortage.length > 0) {
          const targetStation = nearbyShortage[0];
          const bikesNeeded = Math.floor(targetStation.capacity * 0.5 - targetStation.total_available);
          const actualTransfer = Math.min(bikesToMove, Math.max(bikesNeeded, 3));
          
          suggestions.push({
            type: 'TRANSFER',
            priority: fromStation.risk_level,
            from_station: {
              id: fromStation.station_id,
              name: fromStation.station_name,
              latitude: fromStation.latitude,
              longitude: fromStation.longitude
            },
            to_station: {
              id: targetStation.station_id,
              name: targetStation.station_name,
              latitude: targetStation.latitude,
              longitude: targetStation.longitude
            },
            bikes_to_transfer: actualTransfer,
            reason: `${fromStation.station_name} 爆仓风险 (${fromStation.total_available}/${fromStation.capacity})，${targetStation.station_name} 缺车`,
            estimated_distance: Math.round(this.haversineDistance(
              fromStation.latitude, fromStation.longitude,
              targetStation.latitude, targetStation.longitude
            ))
          });
        } else {
          suggestions.push({
            type: 'REMOVE',
            priority: fromStation.risk_level,
            station: {
              id: fromStation.station_id,
              name: fromStation.station_name,
              latitude: fromStation.latitude,
              longitude: fromStation.longitude
            },
            bikes_to_remove: bikesToMove,
            reason: `${fromStation.station_name} 爆仓风险，附近无缺车站点，建议移至车场`
          });
        }
      }
    });

    shortageStations.forEach(station => {
      const hasTransfer = suggestions.some(s => 
        s.type === 'TRANSFER' && s.to_station.id === station.station_id
      );
      
      if (!hasTransfer) {
        const bikesNeeded = Math.floor(station.capacity * 0.5 - station.total_available);
        if (bikesNeeded > 0) {
          suggestions.push({
            type: 'SUPPLY',
            priority: station.risk_level,
            station: {
              id: station.station_id,
              name: station.station_name,
              latitude: station.latitude,
              longitude: station.longitude
            },
            bikes_needed: bikesNeeded,
            reason: `${station.station_name} 缺车严重 (${station.total_available}/${station.capacity})，建议从车场调车`
          });
        }
      }
    });

    riskStations.forEach(station => {
      if (station.abandoned_bikes_count > 0) {
        suggestions.push({
          type: 'ABANDONED',
          priority: station.abandoned_bikes_count > 5 ? 'HIGH' : 'MEDIUM',
          station: {
            id: station.station_id,
            name: station.station_name,
            latitude: station.latitude,
            longitude: station.longitude
          },
          abandoned_bikes: station.abandoned_bikes,
          reason: `${station.station_name} 附近发现 ${station.abandoned_bikes_count} 辆疑似遗弃车辆`
        });
      }
    });

    return suggestions.sort((a, b) => {
      const priorityOrder = { 'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }
}

module.exports = new MetricsCalculator();
