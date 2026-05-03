const _ = require('lodash');

class RiskRules {
  constructor() {
    this.config = {
      accuracyThreshold: 50,
      outlierIqrMultiplier: 1.5,
      minClusterSize: 5,
      clusterDistanceThreshold: 100
    };
  }

  cleanAnomalousLocations(bikeGPS) {
    const anomalies = this.detectLocationAnomalies(bikeGPS);
    
    const cleaned = bikeGPS.filter(point => {
      const isAnomaly = anomalies.some(anomaly => 
        anomaly.bike_id === point.bike_id && 
        anomaly.timestamp === point.timestamp
      );
      return !isAnomaly;
    });
    
    return {
      cleaned,
      anomalies,
      stats: {
        total: bikeGPS.length,
        cleaned: cleaned.length,
        anomalies: anomalies.length
      }
    };
  }

  detectLocationAnomalies(bikeGPS) {
    const anomalies = [];
    
    bikeGPS.forEach(point => {
      const issues = [];
      
      if (point.accuracy !== null && point.accuracy > this.config.accuracyThreshold) {
        issues.push({
          type: 'LOW_ACCURACY',
          description: `GPS精度过低: ${point.accuracy}米 (阈值: ${this.config.accuracyThreshold}米)`,
          value: point.accuracy,
          threshold: this.config.accuracyThreshold
        });
      }
      
      if (Math.abs(point.latitude) > 90 || Math.abs(point.longitude) > 180) {
        issues.push({
          type: 'INVALID_COORDINATES',
          description: '坐标值超出有效范围',
          value: `(${point.latitude}, ${point.longitude})`
        });
      }
      
      if (point.latitude === 0 && point.longitude === 0) {
        issues.push({
          type: 'NULL_ISLAND',
          description: '坐标为(0, 0)，可能是GPS信号丢失'
        });
      }
      
      if (issues.length > 0) {
        anomalies.push({
          ...point,
          anomaly_types: issues.map(i => i.type),
          anomaly_details: issues
        });
      }
    });
    
    const statisticalOutliers = this.detectStatisticalOutliers(bikeGPS);
    anomalies.push(...statisticalOutliers);
    
    return _.uniqBy(anomalies, a => `${a.bike_id}-${a.timestamp}`);
  }

  detectStatisticalOutliers(bikeGPS) {
    const outliers = [];
    
    const bikeGroups = _.groupBy(bikeGPS, 'bike_id');
    
    Object.entries(bikeGroups).forEach(([bikeId, points]) => {
      if (points.length < 3) return;
      
      const latitudes = points.map(p => p.latitude);
      const longitudes = points.map(p => p.longitude);
      
      const latIqr = this.calculateIQR(latitudes);
      const lonIqr = this.calculateIQR(longitudes);
      
      points.forEach(point => {
        const isLatOutlier = point.latitude < latIqr.lowerBound || point.latitude > latIqr.upperBound;
        const isLonOutlier = point.longitude < lonIqr.lowerBound || point.longitude > lonIqr.upperBound;
        
        if (isLatOutlier || isLonOutlier) {
          outliers.push({
            ...point,
            anomaly_types: ['STATISTICAL_OUTLIER'],
            anomaly_details: [{
              type: 'STATISTICAL_OUTLIER',
              description: '位置偏离该车辆历史平均位置过远',
              bike_id: bikeId,
              total_points: points.length,
              lat_iqr: latIqr,
              lon_iqr: lonIqr
            }]
          });
        }
      });
    });
    
    return outliers;
  }

  calculateIQR(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const q1 = this.percentile(sorted, 25);
    const q3 = this.percentile(sorted, 75);
    const iqr = q3 - q1;
    const multiplier = this.config.outlierIqrMultiplier;
    
    return {
      q1,
      q3,
      iqr,
      lowerBound: q1 - multiplier * iqr,
      upperBound: q3 + multiplier * iqr,
      median: this.percentile(sorted, 50)
    };
  }

  percentile(sortedArray, p) {
    const index = (sortedArray.length - 1) * (p / 100);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    
    if (lower === upper) {
      return sortedArray[index];
    }
    
    const weight = index - lower;
    return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
  }

  detectBikeClusters(bikeGPS, stations) {
    const allPoints = [
      ...bikeGPS.map(b => ({ type: 'bike', ...b })),
      ...stations.map(s => ({ type: 'station', latitude: s.latitude, longitude: s.longitude, ...s }))
    ];
    
    const clusters = [];
    const visited = new Set();
    
    bikeGPS.forEach((bike, i) => {
      if (visited.has(i)) return;
      
      const cluster = this.findNeighbors(bike, bikeGPS, visited);
      
      if (cluster.length >= this.config.minClusterSize) {
        const centroid = this.calculateCentroid(cluster);
        
        const hasStationNearby = stations.some(station => {
          const dist = this.haversineDistance(
            centroid.lat, centroid.lon,
            station.latitude, station.longitude
          );
          return dist <= this.config.clusterDistanceThreshold;
        });
        
        clusters.push({
          id: `cluster_${clusters.length}`,
          size: cluster.length,
          centroid: centroid,
          bikes: cluster.map(b => ({
            bike_id: b.bike_id,
            latitude: b.latitude,
            longitude: b.longitude,
            timestamp: b.timestamp
          })),
          is_near_station: hasStationNearby,
          risk_level: hasStationNearby ? 
            (cluster.length > 20 ? 'HIGH' : 'MEDIUM') : 
            (cluster.length > 10 ? 'MEDIUM' : 'LOW')
        });
      }
    });
    
    return clusters.sort((a, b) => b.size - a.size);
  }

  findNeighbors(point, points, visited) {
    const cluster = [point];
    const queue = [point];
    
    while (queue.length > 0) {
      const current = queue.shift();
      
      points.forEach((p, i) => {
        if (visited.has(i)) return;
        
        const dist = this.haversineDistance(
          current.latitude, current.longitude,
          p.latitude, p.longitude
        );
        
        if (dist <= this.config.clusterDistanceThreshold) {
          visited.add(i);
          cluster.push(p);
          queue.push(p);
        }
      });
    }
    
    return cluster;
  }

  calculateCentroid(points) {
    const latSum = points.reduce((sum, p) => sum + p.latitude, 0);
    const lonSum = points.reduce((sum, p) => sum + p.longitude, 0);
    
    return {
      lat: latSum / points.length,
      lon: lonSum / points.length
    };
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

  assessStationRisk(station, bikeGPS) {
    const risks = [];
    
    const bikesNearby = bikeGPS.filter(bike => {
      const dist = this.haversineDistance(
        bike.latitude, bike.longitude,
        station.latitude, station.longitude
      );
      return dist <= 100;
    }).length;
    
    const totalAvailable = (station.current_bikes || 0) + bikesNearby;
    const capacity = station.capacity || 20;
    const utilization = totalAvailable / capacity;
    
    if (utilization >= 0.95) {
      risks.push({
        type: 'CRITICAL_OVERFLOW',
        severity: 'CRITICAL',
        description: `站点严重爆仓风险: ${totalAvailable}/${capacity} (${(utilization * 100).toFixed(1)}%)`,
        bikes_over_capacity: totalAvailable - capacity
      });
    } else if (utilization >= 0.8) {
      risks.push({
        type: 'OVERFLOW',
        severity: 'HIGH',
        description: `站点爆仓风险: ${totalAvailable}/${capacity} (${(utilization * 100).toFixed(1)}%)`,
        bikes_over_capacity: Math.max(0, totalAvailable - capacity)
      });
    }
    
    if (utilization <= 0.1) {
      risks.push({
        type: 'CRITICAL_SHORTAGE',
        severity: 'CRITICAL',
        description: `站点严重缺车: ${totalAvailable}/${capacity} (${(utilization * 100).toFixed(1)}%)`,
        bikes_needed: Math.floor(capacity * 0.5 - totalAvailable)
      });
    } else if (utilization <= 0.2) {
      risks.push({
        type: 'SHORTAGE',
        severity: 'HIGH',
        description: `站点缺车: ${totalAvailable}/${capacity} (${(utilization * 100).toFixed(1)}%)`,
        bikes_needed: Math.max(0, Math.floor(capacity * 0.5 - totalAvailable))
      });
    }
    
    if (bikesNearby > capacity * 0.3) {
      risks.push({
        type: 'STREET_CLUSTER',
        severity: 'MEDIUM',
        description: `站点附近非机动车道有 ${bikesNearby} 辆车堆积`,
        bikes_on_street: bikesNearby
      });
    }
    
    return {
      station_id: station.station_id,
      station_name: station.name,
      risks,
      risk_score: this.calculateRiskScore(risks),
      utilization: utilization,
      total_available: totalAvailable
    };
  }

  calculateRiskScore(risks) {
    let score = 0;
    
    risks.forEach(risk => {
      switch (risk.severity) {
        case 'CRITICAL':
          score += 100;
          break;
        case 'HIGH':
          score += 50;
          break;
        case 'MEDIUM':
          score += 25;
          break;
        case 'LOW':
          score += 10;
          break;
      }
    });
    
    return Math.min(score, 200);
  }
}

module.exports = new RiskRules();
