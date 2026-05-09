const dayjs = require('dayjs');
const { EXCEPTION_TYPES, TEMPERATURE_THRESHOLDS } = require('../models/types');
const { isTemperatureInZone } = require('../utils/validation');

const TEMPERATURE_GAP_THRESHOLD_MINUTES = 120;

class AnalysisService {
  constructor(dataStore) {
    this.dataStore = dataStore;
  }
  
  runLotMatchingAnalysis(options = {}) {
    const inventory = this.dataStore.getInventory();
    const temperature = this.dataStore.getTemperature();
    
    const results = {
      analysisTime: dayjs().toISOString(),
      type: 'lot_matching',
      matched: [],
      unmatched: [],
      partialMatch: [],
      exceptions: [],
      stats: {
        totalLots: inventory.lots.length,
        lotsWithTemperature: 0,
        lotsWithoutTemperature: 0,
        matchedLots: 0,
        unmatchedLots: 0,
        temperatureRecordsCount: temperature.records.length
      }
    };
    
    const tempRecordMap = new Map();
    for (const record of temperature.records) {
      if (!tempRecordMap.has(record.lotNumber)) {
        tempRecordMap.set(record.lotNumber, []);
      }
      tempRecordMap.get(record.lotNumber).push(record);
    }
    
    for (const lot of inventory.lots) {
      const lotRecords = tempRecordMap.get(lot.lotNumber) || [];
      
      const lotResult = {
        lotNumber: lot.lotNumber,
        productName: lot.productName,
        wmsZone: lot.zone,
        wmsQuantity: lot.quantity,
        temperatureRecordsCount: lotRecords.length,
        zonesFromTemperature: [],
        zoneConflict: false,
        matchStatus: 'unknown'
      };
      
      if (lotRecords.length === 0) {
        results.stats.lotsWithoutTemperature++;
        lotResult.matchStatus = 'unmatched';
        results.unmatched.push(lotResult);
        
        results.exceptions.push(this.dataStore.addException({
          type: EXCEPTION_TYPES.MISSING_LOT,
          lotNumber: lot.lotNumber,
          severity: 'medium',
          reason: `批号 ${lot.lotNumber} 在 WMS 中存在但无温度记录`,
          source: 'lot_matching',
          evidence: {
            wmsData: {
              zone: lot.zone,
              quantity: lot.quantity,
              productName: lot.productName
            }
          }
        }));
      } else {
        results.stats.lotsWithTemperature++;
        
        const zones = [...new Set(lotRecords.map(r => r.zone))];
        lotResult.zonesFromTemperature = zones;
        
        if (zones.length === 1 && zones[0] === lot.zone) {
          lotResult.matchStatus = 'matched';
          results.stats.matchedLots++;
          results.matched.push(lotResult);
        } else if (zones.includes(lot.zone)) {
          lotResult.matchStatus = 'partial';
          lotResult.zoneConflict = true;
          results.partialMatch.push(lotResult);
          results.stats.lotsWithoutTemperature++;
          
          results.exceptions.push(this.dataStore.addException({
            type: EXCEPTION_TYPES.LOT_MISMATCH,
            lotNumber: lot.lotNumber,
            severity: 'high',
            reason: `批号 ${lot.lotNumber} 的温区信息存在冲突: WMS=${lot.zone}, 温度记录=${zones.join(', ')}`,
            source: 'lot_matching',
            evidence: {
              wmsZone: lot.zone,
              tempZones: zones,
              temperatureRecords: lotRecords.length
            }
          }));
        } else {
          lotResult.matchStatus = 'unmatched';
          lotResult.zoneConflict = true;
          results.unmatched.push(lotResult);
          results.stats.unmatchedLots++;
          
          results.exceptions.push(this.dataStore.addException({
            type: EXCEPTION_TYPES.LOT_MISMATCH,
            lotNumber: lot.lotNumber,
            severity: 'critical',
            reason: `批号 ${lot.lotNumber} 的温区完全不匹配: WMS=${lot.zone}, 温度记录=${zones.join(', ')}`,
            source: 'lot_matching',
            evidence: {
              wmsZone: lot.zone,
              tempZones: zones
            }
          }));
        }
      }
    }
    
    const allTempLotNumbers = new Set(temperature.records.map(r => r.lotNumber));
    const wmsLotNumbers = new Set(inventory.lots.map(l => l.lotNumber));
    
    for (const tempLot of allTempLotNumbers) {
      if (!wmsLotNumbers.has(tempLot)) {
        results.exceptions.push(this.dataStore.addException({
          type: EXCEPTION_TYPES.LOT_MISMATCH,
          lotNumber: tempLot,
          severity: 'medium',
          reason: `温度记录中的批号 ${tempLot} 在 WMS 库存中不存在`,
          source: 'lot_matching',
          evidence: {
            source: 'temperature_log'
          }
        }));
      }
    }
    
    return results;
  }
  
  runTemperatureBreakAnalysis(options = {}) {
    const inventory = this.dataStore.getInventory();
    const temperature = this.dataStore.getTemperature();
    
    const results = {
      analysisTime: dayjs().toISOString(),
      type: 'temperature_break',
      gaps: [],
      outOfRange: [],
      exceptions: [],
      stats: {
        totalRecords: temperature.records.length,
        lotsAnalyzed: 0,
        gapsFound: 0,
        outOfRangeFound: 0
      }
    };
    
    const tempByLot = new Map();
    for (const record of temperature.records) {
      if (!tempByLot.has(record.lotNumber)) {
        tempByLot.set(record.lotNumber, []);
      }
      tempByLot.get(record.lotNumber).push(record);
    }
    
    for (const [lotNumber, records] of tempByLot) {
      results.stats.lotsAnalyzed++;
      
      records.sort((a, b) => dayjs(a.recordTime).valueOf() - dayjs(b.recordTime).valueOf());
      
      for (let i = 1; i < records.length; i++) {
        const prev = records[i - 1];
        const curr = records[i];
        const gapMinutes = dayjs(curr.recordTime).diff(dayjs(prev.recordTime), 'minute');
        
        if (gapMinutes > TEMPERATURE_GAP_THRESHOLD_MINUTES) {
          const gapInfo = {
            lotNumber,
            previousRecordTime: prev.recordTime,
            currentRecordTime: curr.recordTime,
            gapMinutes,
            previousZone: prev.zone,
            currentZone: curr.zone,
            zoneChanged: prev.zone !== curr.zone
          };
          
          results.gaps.push(gapInfo);
          results.stats.gapsFound++;
          
          let severity = 'medium';
          let reason = `批号 ${lotNumber} 存在 ${gapMinutes} 分钟的温度记录断点`;
          
          if (gapMinutes > 360) {
            severity = 'high';
          }
          if (gapInfo.zoneChanged) {
            severity = 'high';
            reason += `，并伴随跨温区移动 (${prev.zone} -> ${curr.zone})`;
          }
          if (gapMinutes > 720) {
            severity = 'critical';
          }
          
          results.exceptions.push(this.dataStore.addException({
            type: EXCEPTION_TYPES.TEMPERATURE_BREAK,
            lotNumber,
            severity,
            reason,
            source: 'temperature_analysis',
            evidence: {
              gapMinutes,
              previousRecord: {
                time: prev.recordTime,
                zone: prev.zone,
                temperature: prev.temperature
              },
              currentRecord: {
                time: curr.recordTime,
                zone: curr.zone,
                temperature: curr.temperature
              }
            }
          }));
        }
      }
      
      for (const record of records) {
        const tempValidation = isTemperatureInZone(record.temperature, record.zone);
        if (!tempValidation.valid) {
          const outOfRangeInfo = {
            lotNumber,
            zone: record.zone,
            temperature: record.temperature,
            recordTime: record.recordTime,
            threshold: TEMPERATURE_THRESHOLDS[record.zone]
          };
          
          results.outOfRange.push(outOfRangeInfo);
          results.stats.outOfRangeFound++;
          
          const lot = this.dataStore.findLotByNumber(lotNumber);
          let severity = 'medium';
          const range = TEMPERATURE_THRESHOLDS[record.zone];
          const deviation = record.temperature < range.min 
            ? range.min - record.temperature
            : record.temperature - range.max;
          
          if (deviation > 5) severity = 'high';
          if (deviation > 10) severity = 'critical';
          
          results.exceptions.push(this.dataStore.addException({
            type: EXCEPTION_TYPES.TEMPERATURE_OUT_OF_RANGE,
            lotNumber,
            severity,
            reason: `批号 ${lotNumber} 在 ${record.zone} 的温度 ${record.temperature}°C 超出正常范围 (${range.min} ~ ${range.max}°C)`,
            source: 'temperature_analysis',
            evidence: {
              temperature: record.temperature,
              zone: record.zone,
              threshold: range,
              deviation,
              recordTime: record.recordTime,
              wmsZone: lot?.zone
            }
          }));
        }
      }
    }
    
    return results;
  }
  
  runInventoryDifferenceAnalysis(options = {}) {
    const inventory = this.dataStore.getInventory();
    
    const results = {
      analysisTime: dayjs().toISOString(),
      type: 'inventory_difference',
      differences: [],
      zoneMismatches: [],
      exceptions: [],
      stats: {
        totalLots: inventory.lots.length,
        lotsWithCount: 0,
        lotsWithoutCount: 0,
        quantityDifferences: 0,
        zoneMismatches: 0
      }
    };
    
    for (const lot of inventory.lots) {
      if (!lot.lastCounted) {
        results.stats.lotsWithoutCount++;
        continue;
      }
      
      results.stats.lotsWithCount++;
      
      const quantityDiff = lot.lastCounted.quantity - lot.quantity;
      const zoneDiff = lot.lastCounted.zone !== lot.zone;
      
      if (quantityDiff !== 0) {
        results.stats.quantityDifferences++;
        const diffInfo = {
          lotNumber: lot.lotNumber,
          productName: lot.productName,
          wmsQuantity: lot.quantity,
          countedQuantity: lot.lastCounted.quantity,
          difference: quantityDiff,
          differencePercentage: ((quantityDiff / lot.quantity) * 100).toFixed(2),
          countedBy: lot.lastCounted.countedBy,
          countedAt: lot.lastCounted.countedAt
        };
        
        results.differences.push(diffInfo);
        
        let severity = 'medium';
        if (Math.abs(quantityDiff) > lot.quantity * 0.2) severity = 'high';
        if (Math.abs(quantityDiff) > lot.quantity * 0.5) severity = 'critical';
        
        results.exceptions.push(this.dataStore.addException({
          type: EXCEPTION_TYPES.QUANTITY_DIFFERENCE,
          lotNumber: lot.lotNumber,
          severity,
          reason: `批号 ${lot.lotNumber} 盘点数量差异: WMS=${lot.quantity}, 盘点=${lot.lastCounted.quantity}, 差异=${quantityDiff}`,
          source: 'inventory_analysis',
          evidence: {
            wmsQuantity: lot.quantity,
            countedQuantity: lot.lastCounted.quantity,
            difference: quantityDiff,
            countedBy: lot.lastCounted.countedBy,
            countedAt: lot.lastCounted.countedAt
          }
        }));
      }
      
      if (zoneDiff) {
        results.stats.zoneMismatches++;
        const mismatchInfo = {
          lotNumber: lot.lotNumber,
          productName: lot.productName,
          wmsZone: lot.zone,
          countedZone: lot.lastCounted.zone,
          countedBy: lot.lastCounted.countedBy,
          countedAt: lot.lastCounted.countedAt
        };
        
        results.zoneMismatches.push(mismatchInfo);
        
        results.exceptions.push(this.dataStore.addException({
          type: EXCEPTION_TYPES.CROSS_ZONE_MOVEMENT,
          lotNumber: lot.lotNumber,
          severity: 'high',
          reason: `批号 ${lot.lotNumber} 温区位置不匹配: WMS=${lot.zone}, 实际盘点=${lot.lastCounted.zone}`,
          source: 'inventory_analysis',
          evidence: {
            wmsZone: lot.zone,
            countedZone: lot.lastCounted.zone,
            countedBy: lot.lastCounted.countedBy,
            countedAt: lot.lastCounted.countedAt
          }
        }));
      }
    }
    
    return results;
  }
  
  runFullAnalysis(options = {}) {
    const lotMatching = this.runLotMatchingAnalysis(options);
    const temperatureBreak = this.runTemperatureBreakAnalysis(options);
    const inventoryDiff = this.runInventoryDifferenceAnalysis(options);
    
    const openExceptions = this.dataStore.getOpenExceptions();
    
    return {
      analysisTime: dayjs().toISOString(),
      lotMatching,
      temperatureBreak,
      inventoryDiff,
      openExceptions,
      summary: {
        totalExceptions: openExceptions.length,
        critical: openExceptions.filter(e => e.severity === 'critical').length,
        high: openExceptions.filter(e => e.severity === 'high').length,
        medium: openExceptions.filter(e => e.severity === 'medium').length,
        low: openExceptions.filter(e => e.severity === 'low').length
      }
    };
  }
  
  resolveException(exceptionId, resolver, resolution, note = '') {
    const exceptions = this.dataStore.getExceptions();
    const exception = exceptions.records.find(e => e.id === exceptionId);
    
    if (!exception) {
      throw new Error(`异常记录不存在: ${exceptionId}`);
    }
    
    exception.status = 'resolved';
    exception.resolvedAt = dayjs().toISOString();
    exception.resolvedBy = resolver;
    exception.resolution = resolution;
    exception.resolutionNote = note;
    
    this.dataStore.saveExceptions(exceptions);
    return exception;
  }
}

module.exports = AnalysisService;
