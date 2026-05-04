const moment = require('moment');
const { Op } = require('sequelize');
const { 
  Store, 
  WeighingRecord, 
  Waybill, 
  GPSTrack, 
  RiskRecord,
  Batch
} = require('../models');
const { isTrackNearStore, calculateDistance } = require('../utils/geoUtils');

const RISK_TYPES = {
  DUPLICATE_WEIGHING: 'duplicate_weighing',
  STORE_MISMATCH: 'store_mismatch',
  GPS_NOT_AT_STORE: 'gps_not_at_store',
  TIME_OVERDUE: 'time_overdue',
  SUSPICIOUS_DUMPING: 'suspicious_dumping',
  WEIGHT_ANOMALY: 'weight_anomaly'
};

const SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

class RiskEngine {
  constructor(batchId) {
    this.batchId = batchId;
    this.risks = [];
  }

  async analyze() {
    this.risks = [];
    
    await Promise.all([
      this.checkDuplicateWeighing(),
      this.checkStoreMismatch(),
      this.checkGPSNotAtStore(),
      this.checkTimeOverdue(),
      this.checkSuspiciousDumping(),
      this.checkWeightAnomaly()
    ]);

    await this.saveRisks();
    await this.updateBatchStatus();
    
    return this.risks;
  }

  async checkDuplicateWeighing() {
    const weighingRecords = await WeighingRecord.findAll({
      where: { batchId: this.batchId },
      order: [['storeName', 'ASC'], ['weight', 'ASC'], ['weighingTime', 'ASC']]
    });

    if (weighingRecords.length < 2) return;

    const seen = new Map();

    for (const record of weighingRecords) {
      const key = this.generateDuplicateKey(record);
      
      if (seen.has(key)) {
        const originalRecord = seen.get(key);
        
        const risk = this.createRisk(RISK_TYPES.DUPLICATE_WEIGHING, SEVERITY.HIGH, {
          description: `检测到重复称重记录`,
          details: {
            storeName: record.storeName,
            weight: record.weight,
            weighingTime: record.weighingTime,
            originalRecordId: originalRecord.id,
            duplicateRecordId: record.id
          }
        });
        this.risks.push(risk);

        await record.update({ isDuplicate: true, duplicateWith: originalRecord.id, status: 'duplicate' });
      } else {
        seen.set(key, record);
      }
    }
  }

  async checkStoreMismatch() {
    const [weighingRecords, waybills, activeStores] = await Promise.all([
      WeighingRecord.findAll({ where: { batchId: this.batchId } }),
      Waybill.findAll({ where: { batchId: this.batchId } }),
      Store.findAll({ where: { status: 'active' } })
    ]);

    const activeStoreNames = new Set(activeStores.map(s => s.name.trim().toLowerCase()));
    const activeStoreCodes = new Set(activeStores.map(s => s.code.trim().toLowerCase()));

    for (const record of weighingRecords) {
      const storeName = record.storeName?.trim().toLowerCase();
      
      if (storeName && !activeStoreNames.has(storeName)) {
        const matchedByCode = activeStores.some(store => 
          record.rawLine?.toLowerCase().includes(store.code.toLowerCase())
        );
        
        if (!matchedByCode) {
          const risk = this.createRisk(RISK_TYPES.STORE_MISMATCH, SEVERITY.MEDIUM, {
            description: `称重记录中的门店"${record.storeName}"不在合同门店列表中`,
            details: {
              storeName: record.storeName,
              weighingRecordId: record.id,
              activeStores: activeStores.map(s => s.name)
            }
          });
          this.risks.push(risk);
        }
      }
    }

    for (const waybill of waybills) {
      const storeName = waybill.storeName?.trim().toLowerCase();
      const storeCode = waybill.storeCode?.trim().toLowerCase();
      
      const isInStores = (storeName && activeStoreNames.has(storeName)) ||
                         (storeCode && activeStoreCodes.has(storeCode));
      
      if (!isInStores && waybill.storeName) {
        const risk = this.createRisk(RISK_TYPES.STORE_MISMATCH, SEVERITY.MEDIUM, {
          description: `联单中的门店"${waybill.storeName}"不在合同门店列表中`,
          details: {
            storeName: waybill.storeName,
            storeCode: waybill.storeCode,
            waybillId: waybill.id
          }
        });
        this.risks.push(risk);
      }
    }
  }

  async checkGPSNotAtStore() {
    const [gpsTracks, waybills, weighingRecords] = await Promise.all([
      GPSTrack.findAll({ 
        where: { batchId: this.batchId },
        order: [['sequence', 'ASC']]
      }),
      Waybill.findAll({ where: { batchId: this.batchId } }),
      WeighingRecord.findAll({ where: { batchId: this.batchId } })
    ]);

    if (gpsTracks.length === 0) return;

    const storeNamesFromRecords = new Set([
      ...waybills.map(w => w.storeName).filter(Boolean),
      ...weighingRecords.map(w => w.storeName).filter(Boolean)
    ]);

    if (storeNamesFromRecords.size === 0) return;

    const stores = await Store.findAll({
      where: {
        name: { [Op.in]: Array.from(storeNamesFromRecords) }
      }
    });

    const storeMap = new Map(stores.map(s => [s.name.trim().toLowerCase(), s]));

    const thresholdKm = 0.5;

    for (const storeName of storeNamesFromRecords) {
      const store = storeMap.get(storeName.toLowerCase());
      
      if (!store) continue;

      const isNearStore = isTrackNearStore(gpsTracks, store.latitude, store.longitude, thresholdKm);
      
      if (!isNearStore) {
        const nearestPoint = this.findNearestPoint(gpsTracks, store.latitude, store.longitude);
        const distance = nearestPoint ? 
          calculateDistance(nearestPoint.latitude, nearestPoint.longitude, store.latitude, store.longitude) : null;

        const risk = this.createRisk(RISK_TYPES.GPS_NOT_AT_STORE, SEVERITY.HIGH, {
          description: `GPS轨迹未到达门店"${storeName}"`,
          details: {
            storeName: storeName,
            storeLocation: { lat: store.latitude, lon: store.longitude },
            nearestDistanceKm: distance?.toFixed(2),
            thresholdKm: thresholdKm
          }
        });
        this.risks.push(risk);
      }
    }
  }

  async checkTimeOverdue() {
    const batch = await Batch.findByPk(this.batchId);
    if (!batch) return;

    const waybills = await Waybill.findAll({ 
      where: { batchId: this.batchId },
      include: [{ model: Store, as: 'store' }]
    });

    const standardStartTime = moment(batch.date).set({ hour: 6, minute: 0, second: 0 });
    const standardEndTime = moment(batch.date).set({ hour: 18, minute: 0, second: 0 });

    for (const waybill of waybills) {
      if (!waybill.collectionTime) continue;

      const collectionTime = moment(waybill.collectionTime);
      const isOverdue = collectionTime.isBefore(standardStartTime) || 
                        collectionTime.isAfter(standardEndTime);

      if (isOverdue) {
        const risk = this.createRisk(RISK_TYPES.TIME_OVERDUE, SEVERITY.MEDIUM, {
          description: `联单回收时间异常`,
          details: {
            waybillNumber: waybill.waybillNumber,
            collectionTime: waybill.collectionTime,
            standardWindow: {
              start: standardStartTime.format(),
              end: standardEndTime.format()
            },
            isEarly: collectionTime.isBefore(standardStartTime),
            isLate: collectionTime.isAfter(standardEndTime)
          }
        });
        this.risks.push(risk);
      }
    }
  }

  async checkSuspiciousDumping() {
    const [gpsTracks, batch] = await Promise.all([
      GPSTrack.findAll({ 
        where: { batchId: this.batchId },
        order: [['sequence', 'ASC']]
      }),
      Batch.findByPk(this.batchId)
    ]);

    if (gpsTracks.length < 10) return;

    const stations = await Store.findAll({ where: { status: 'active' } });
    const stationLocations = stations.map(s => ({
      lat: s.latitude,
      lon: s.longitude,
      name: s.name
    }));

    const stopClusters = this.identifyStops(gpsTracks, stationLocations);

    for (const cluster of stopClusters) {
      if (!cluster.isNearStation) {
        const risk = this.createRisk(RISK_TYPES.SUSPICIOUS_DUMPING, SEVERITY.CRITICAL, {
          description: `检测到疑似非法倾倒行为: 在非合同站点停留`,
          details: {
            location: { lat: cluster.avgLat, lon: cluster.avgLon },
            durationMinutes: cluster.durationMinutes,
            startTime: cluster.startTime,
            endTime: cluster.endTime,
            nearestStationDistance: cluster.nearestStationDistance
          }
        });
        this.risks.push(risk);
      }
    }
  }

  async checkWeightAnomaly() {
    const [weighingRecords, batch] = await Promise.all([
      WeighingRecord.findAll({ where: { batchId: this.batchId } }),
      Batch.findByPk(this.batchId)
    ]);

    if (weighingRecords.length === 0) return;

    const weights = weighingRecords.map(r => r.weight).filter(w => w > 0);
    if (weights.length < 3) return;

    const avgWeight = weights.reduce((a, b) => a + b, 0) / weights.length;
    const variance = weights.reduce((sum, w) => sum + Math.pow(w - avgWeight, 2), 0) / weights.length;
    const stdDev = Math.sqrt(variance);

    const thresholdMultiplier = 2.5;

    for (const record of weighingRecords) {
      if (record.weight <= 0) continue;
      
      const zScore = stdDev > 0 ? Math.abs(record.weight - avgWeight) / stdDev : 0;
      
      if (zScore > thresholdMultiplier) {
        const isTooHigh = record.weight > avgWeight;
        const risk = this.createRisk(RISK_TYPES.WEIGHT_ANOMALY, SEVERITY.MEDIUM, {
          description: `称重重量异常: ${isTooHigh ? '远高于' : '远低于'}平均值`,
          details: {
            storeName: record.storeName,
            weight: record.weight,
            averageWeight: avgWeight.toFixed(2),
            zScore: zScore.toFixed(2),
            threshold: thresholdMultiplier
          }
        });
        this.risks.push(risk);
      }
    }
  }

  async saveRisks() {
    await RiskRecord.destroy({ where: { batchId: this.batchId } });

    for (const risk of this.risks) {
      await RiskRecord.create({
        ...risk,
        batchId: this.batchId,
        details: JSON.stringify(risk.details)
      });
    }
  }

  async updateBatchStatus() {
    const hasRisks = this.risks.length > 0;
    const hasHighRisk = this.risks.some(r => 
      r.severity === SEVERITY.HIGH || r.severity === SEVERITY.CRITICAL
    );

    const riskLevel = hasHighRisk ? SEVERITY.HIGH : 
                      hasRisks ? SEVERITY.MEDIUM : SEVERITY.LOW;

    await Batch.update(
      {
        hasRisks,
        riskLevel,
        status: hasRisks ? 'flagged' : 'processing'
      },
      { where: { id: this.batchId } }
    );
  }

  createRisk(riskType, severity, data) {
    return {
      riskType,
      severity,
      description: data.description,
      details: data.details,
      detectedAt: new Date()
    };
  }

  generateDuplicateKey(record) {
    const timeStr = record.weighingTime ? 
      moment(record.weighingTime).format('YYYY-MM-DD-HH') : '';
    return `${record.storeName || ''}:${record.weight || 0}:${timeStr}`;
  }

  findNearestPoint(points, targetLat, targetLon) {
    let nearest = null;
    let minDistance = Infinity;

    for (const point of points) {
      const dist = calculateDistance(point.latitude, point.longitude, targetLat, targetLon);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = point;
      }
    }

    return nearest;
  }

  identifyStops(gpsTracks, stations) {
    const stops = [];
    const stopThresholdMinutes = 5;
    const distanceThresholdKm = 0.1;

    if (gpsTracks.length < 2) return stops;

    let currentCluster = null;

    for (let i = 0; i < gpsTracks.length; i++) {
      const point = gpsTracks[i];

      if (!currentCluster) {
        currentCluster = {
          points: [point],
          startTime: point.timestamp,
          endTime: point.timestamp
        };
      } else {
        const lastPoint = currentCluster.points[currentCluster.points.length - 1];
        const dist = calculateDistance(
          lastPoint.latitude, lastPoint.longitude,
          point.latitude, point.longitude
        );

        if (dist <= distanceThresholdKm) {
          currentCluster.points.push(point);
          currentCluster.endTime = point.timestamp;
        } else {
          const durationMinutes = this.calculateDurationMinutes(
            currentCluster.startTime, currentCluster.endTime
          );

          if (durationMinutes >= stopThresholdMinutes) {
            const clusterInfo = this.analyzeCluster(currentCluster, stations);
            stops.push(clusterInfo);
          }

          currentCluster = {
            points: [point],
            startTime: point.timestamp,
            endTime: point.timestamp
          };
        }
      }
    }

    if (currentCluster) {
      const durationMinutes = this.calculateDurationMinutes(
        currentCluster.startTime, currentCluster.endTime
      );

      if (durationMinutes >= stopThresholdMinutes) {
        const clusterInfo = this.analyzeCluster(currentCluster, stations);
        stops.push(clusterInfo);
      }
    }

    return stops;
  }

  analyzeCluster(cluster, stations) {
    const lats = cluster.points.map(p => p.latitude);
    const lons = cluster.points.map(p => p.longitude);
    const avgLat = lats.reduce((a, b) => a + b, 0) / lats.length;
    const avgLon = lons.reduce((a, b) => a + b, 0) / lons.length;

    let nearestStationDistance = Infinity;
    let isNearStation = false;
    const stationThreshold = 0.5;

    for (const station of stations) {
      const dist = calculateDistance(avgLat, avgLon, station.lat, station.lon);
      if (dist < nearestStationDistance) {
        nearestStationDistance = dist;
      }
      if (dist <= stationThreshold) {
        isNearStation = true;
      }
    }

    return {
      avgLat,
      avgLon,
      durationMinutes: this.calculateDurationMinutes(cluster.startTime, cluster.endTime),
      startTime: cluster.startTime,
      endTime: cluster.endTime,
      isNearStation,
      nearestStationDistance
    };
  }

  calculateDurationMinutes(startTime, endTime) {
    if (!startTime || !endTime) return 0;
    const start = moment(startTime);
    const end = moment(endTime);
    return end.diff(start, 'minutes');
  }
}

module.exports = {
  RiskEngine,
  RISK_TYPES,
  SEVERITY
};
