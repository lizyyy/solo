const crypto = require('crypto');
const dayjs = require('dayjs');
const { EXCEPTION_TYPES, TEMPERATURE_THRESHOLDS } = require('../models/types');
const { isTemperatureInZone } = require('../utils/validation');

const TEMPERATURE_GAP_THRESHOLD_MINUTES = 120;

function generateExceptionFingerprint(exception) {
  const evidenceStr = JSON.stringify(exception.evidence || {});
  const fingerprint = `${exception.lotNumber}|${exception.type}|${evidenceStr}`;
  return crypto.createHash('sha256').update(fingerprint).digest('hex').substring(0, 16);
}

class AnalysisService {
  constructor(dataStore) {
    this.dataStore = dataStore;
  }
  
  buildLotMatchingExceptions() {
    const exceptions = [];
    const inventory = this.dataStore.getInventory();
    const temperature = this.dataStore.getTemperature();
    
    const tempRecordMap = new Map();
    for (const record of temperature.records) {
      if (!tempRecordMap.has(record.lotNumber)) {
        tempRecordMap.set(record.lotNumber, []);
      }
      tempRecordMap.get(record.lotNumber).push(record);
    }
    
    for (const lot of inventory.lots) {
      const lotRecords = tempRecordMap.get(lot.lotNumber) || [];
      
      if (lotRecords.length === 0) {
        exceptions.push({
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
        });
      } else {
        const zones = [...new Set(lotRecords.map(r => r.zone))];
        
        if (zones.length === 1 && zones[0] === lot.zone) {
          continue;
        } else if (zones.includes(lot.zone)) {
          exceptions.push({
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
          });
        } else {
          exceptions.push({
            type: EXCEPTION_TYPES.LOT_MISMATCH,
            lotNumber: lot.lotNumber,
            severity: 'critical',
            reason: `批号 ${lot.lotNumber} 的温区完全不匹配: WMS=${lot.zone}, 温度记录=${zones.join(', ')}`,
            source: 'lot_matching',
            evidence: {
              wmsZone: lot.zone,
              tempZones: zones
            }
          });
        }
      }
    }
    
    const allTempLotNumbers = new Set(temperature.records.map(r => r.lotNumber));
    const wmsLotNumbers = new Set(inventory.lots.map(l => l.lotNumber));
    
    for (const tempLot of allTempLotNumbers) {
      if (!wmsLotNumbers.has(tempLot)) {
        exceptions.push({
          type: EXCEPTION_TYPES.LOT_MISMATCH,
          lotNumber: tempLot,
          severity: 'medium',
          reason: `温度记录中的批号 ${tempLot} 在 WMS 库存中不存在`,
          source: 'lot_matching',
          evidence: {
            source: 'temperature_log'
          }
        });
      }
    }
    
    return exceptions;
  }
  
  buildTemperatureBreakExceptions() {
    const exceptions = [];
    const inventory = this.dataStore.getInventory();
    const temperature = this.dataStore.getTemperature();
    
    const tempByLot = new Map();
    for (const record of temperature.records) {
      if (!tempByLot.has(record.lotNumber)) {
        tempByLot.set(record.lotNumber, []);
      }
      tempByLot.get(record.lotNumber).push(record);
    }
    
    for (const [lotNumber, records] of tempByLot) {
      records.sort((a, b) => dayjs(a.recordTime).valueOf() - dayjs(b.recordTime).valueOf());
      
      for (let i = 1; i < records.length; i++) {
        const prev = records[i - 1];
        const curr = records[i];
        const gapMinutes = dayjs(curr.recordTime).diff(dayjs(prev.recordTime), 'minute');
        
        if (gapMinutes > TEMPERATURE_GAP_THRESHOLD_MINUTES) {
          let severity = 'medium';
          let reason = `批号 ${lotNumber} 存在 ${gapMinutes} 分钟的温度记录断点`;
          
          if (gapMinutes > 360) {
            severity = 'high';
          }
          if (prev.zone !== curr.zone) {
            severity = 'high';
            reason += `，并伴随跨温区移动 (${prev.zone} -> ${curr.zone})`;
          }
          if (gapMinutes > 720) {
            severity = 'critical';
          }
          
          exceptions.push({
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
          });
        }
      }
      
      for (const record of records) {
        const tempValidation = isTemperatureInZone(record.temperature, record.zone);
        if (!tempValidation.valid) {
          const lot = this.dataStore.findLotByNumber(lotNumber);
          const range = TEMPERATURE_THRESHOLDS[record.zone];
          const deviation = record.temperature < range.min 
            ? range.min - record.temperature
            : record.temperature - range.max;
          
          let severity = 'medium';
          if (deviation > 5) severity = 'high';
          if (deviation > 10) severity = 'critical';
          
          exceptions.push({
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
          });
        }
      }
    }
    
    return exceptions;
  }
  
  buildInventoryDifferenceExceptions() {
    const exceptions = [];
    const inventory = this.dataStore.getInventory();
    
    for (const lot of inventory.lots) {
      if (!lot.lastCounted) {
        continue;
      }
      
      const quantityDiff = lot.lastCounted.quantity - lot.quantity;
      const zoneDiff = lot.lastCounted.zone !== lot.zone;
      
      if (quantityDiff !== 0) {
        let severity = 'medium';
        if (Math.abs(quantityDiff) > lot.quantity * 0.2) severity = 'high';
        if (Math.abs(quantityDiff) > lot.quantity * 0.5) severity = 'critical';
        
        exceptions.push({
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
        });
      }
      
      if (zoneDiff) {
        exceptions.push({
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
        });
      }
    }
    
    return exceptions;
  }
  
  updateExceptionLedger(options = {}) {
    const allExceptions = this.dataStore.getExceptions();
    const now = dayjs().toISOString();
    
    const newExceptionsRaw = [
      ...this.buildLotMatchingExceptions(),
      ...this.buildTemperatureBreakExceptions(),
      ...this.buildInventoryDifferenceExceptions()
    ];
    
    const newFingerprints = new Map();
    for (const ex of newExceptionsRaw) {
      const fp = generateExceptionFingerprint(ex);
      newFingerprints.set(fp, ex);
    }
    
    const existingByFingerprint = new Map();
    for (const ex of allExceptions.records) {
      if (ex.fingerprint) {
        existingByFingerprint.set(ex.fingerprint, ex);
      }
    }
    
    let newExceptions = 0;
    let unchangedExceptions = 0;
    let supercededExceptions = 0;
    
    for (const ex of allExceptions.records) {
      if (ex.status === 'resolved') {
        continue;
      }
      
      const hasMatchingNew = ex.fingerprint && newFingerprints.has(ex.fingerprint);
      
      if (!hasMatchingNew) {
        ex.status = 'superseded';
        ex.supersededAt = now;
        ex.supersededReason = 'new_analysis';
        supercededExceptions++;
      } else {
        unchangedExceptions++;
      }
    }
    
    for (const [fp, rawEx] of newFingerprints) {
      if (!existingByFingerprint.has(fp)) {
        const newRecord = {
          id: require('uuid').v4(),
          timestamp: now,
          status: 'open',
          fingerprint: fp,
          firstDetectedAt: now,
          ...rawEx
        };
        allExceptions.records.push(newRecord);
        newExceptions++;
      }
    }
    
    this.dataStore.saveExceptions(allExceptions);
    
    return {
      updatedAt: now,
      newExceptions,
      unchangedExceptions,
      supercededExceptions,
      totalOpen: allExceptions.records.filter(e => e.status === 'open').length,
      totalResolved: allExceptions.records.filter(e => e.status === 'resolved').length,
      totalSuperseded: allExceptions.records.filter(e => e.status === 'superseded').length
    };
  }
  
  runLotMatchingAnalysis(options = {}) {
    const inventory = this.dataStore.getInventory();
    const temperature = this.dataStore.getTemperature();
    const exceptions = this.buildLotMatchingExceptions();
    
    const tempRecordMap = new Map();
    for (const record of temperature.records) {
      if (!tempRecordMap.has(record.lotNumber)) {
        tempRecordMap.set(record.lotNumber, []);
      }
      tempRecordMap.get(record.lotNumber).push(record);
    }
    
    const results = {
      analysisTime: dayjs().toISOString(),
      type: 'lot_matching',
      matched: [],
      unmatched: [],
      partialMatch: [],
      detectedExceptions: exceptions,
      stats: {
        totalLots: inventory.lots.length,
        lotsWithTemperature: 0,
        lotsWithoutTemperature: 0,
        matchedLots: 0,
        unmatchedLots: 0,
        temperatureRecordsCount: temperature.records.length
      }
    };
    
    for (const lot of inventory.lots) {
      const lotRecords = tempRecordMap.get(lot.lotNumber) || [];
      const zones = [...new Set(lotRecords.map(r => r.zone))];
      
      const lotResult = {
        lotNumber: lot.lotNumber,
        productName: lot.productName,
        wmsZone: lot.zone,
        wmsQuantity: lot.quantity,
        temperatureRecordsCount: lotRecords.length,
        zonesFromTemperature: zones,
        zoneConflict: zones.length > 1 || (zones.length === 1 && zones[0] !== lot.zone),
        matchStatus: 'unknown'
      };
      
      if (lotRecords.length === 0) {
        results.stats.lotsWithoutTemperature++;
        lotResult.matchStatus = 'unmatched';
        results.unmatched.push(lotResult);
      } else if (zones.length === 1 && zones[0] === lot.zone) {
        results.stats.lotsWithTemperature++;
        results.stats.matchedLots++;
        lotResult.matchStatus = 'matched';
        results.matched.push(lotResult);
      } else if (zones.includes(lot.zone)) {
        results.stats.lotsWithTemperature++;
        lotResult.matchStatus = 'partial';
        results.partialMatch.push(lotResult);
      } else {
        results.stats.lotsWithTemperature++;
        results.stats.unmatchedLots++;
        lotResult.matchStatus = 'unmatched';
        results.unmatched.push(lotResult);
      }
    }
    
    return results;
  }
  
  runTemperatureBreakAnalysis(options = {}) {
    const temperature = this.dataStore.getTemperature();
    const exceptions = this.buildTemperatureBreakExceptions();
    
    const gaps = exceptions.filter(e => e.type === EXCEPTION_TYPES.TEMPERATURE_BREAK);
    const outOfRange = exceptions.filter(e => e.type === EXCEPTION_TYPES.TEMPERATURE_OUT_OF_RANGE);
    
    const tempByLot = new Map();
    for (const record of temperature.records) {
      if (!tempByLot.has(record.lotNumber)) {
        tempByLot.set(record.lotNumber, []);
      }
      tempByLot.get(record.lotNumber).push(record);
    }
    
    return {
      analysisTime: dayjs().toISOString(),
      type: 'temperature_break',
      gaps: gaps.map(g => ({
        lotNumber: g.lotNumber,
        previousRecordTime: g.evidence?.previousRecord?.time,
        currentRecordTime: g.evidence?.currentRecord?.time,
        gapMinutes: g.evidence?.gapMinutes,
        previousZone: g.evidence?.previousRecord?.zone,
        currentZone: g.evidence?.currentRecord?.zone,
        zoneChanged: g.evidence?.previousRecord?.zone !== g.evidence?.currentRecord?.zone
      })),
      outOfRange: outOfRange.map(o => ({
        lotNumber: o.lotNumber,
        zone: o.evidence?.zone,
        temperature: o.evidence?.temperature,
        recordTime: o.evidence?.recordTime,
        threshold: o.evidence?.threshold
      })),
      detectedExceptions: exceptions,
      stats: {
        totalRecords: temperature.records.length,
        lotsAnalyzed: tempByLot.size,
        gapsFound: gaps.length,
        outOfRangeFound: outOfRange.length
      }
    };
  }
  
  runInventoryDifferenceAnalysis(options = {}) {
    const inventory = this.dataStore.getInventory();
    const exceptions = this.buildInventoryDifferenceExceptions();
    
    const differences = exceptions.filter(e => e.type === EXCEPTION_TYPES.QUANTITY_DIFFERENCE);
    const zoneMismatches = exceptions.filter(e => e.type === EXCEPTION_TYPES.CROSS_ZONE_MOVEMENT);
    
    let lotsWithCount = 0;
    for (const lot of inventory.lots) {
      if (lot.lastCounted) lotsWithCount++;
    }
    
    return {
      analysisTime: dayjs().toISOString(),
      type: 'inventory_difference',
      differences: differences.map(d => ({
        lotNumber: d.lotNumber,
        wmsQuantity: d.evidence?.wmsQuantity,
        countedQuantity: d.evidence?.countedQuantity,
        difference: d.evidence?.difference,
        differencePercentage: ((d.evidence?.difference / d.evidence?.wmsQuantity) * 100).toFixed(2),
        countedBy: d.evidence?.countedBy,
        countedAt: d.evidence?.countedAt
      })),
      zoneMismatches: zoneMismatches.map(z => ({
        lotNumber: z.lotNumber,
        wmsZone: z.evidence?.wmsZone,
        countedZone: z.evidence?.countedZone,
        countedBy: z.evidence?.countedBy,
        countedAt: z.evidence?.countedAt
      })),
      detectedExceptions: exceptions,
      stats: {
        totalLots: inventory.lots.length,
        lotsWithCount,
        lotsWithoutCount: inventory.lots.length - lotsWithCount,
        quantityDifferences: differences.length,
        zoneMismatches: zoneMismatches.length
      }
    };
  }
  
  runFullAnalysis(options = {}) {
    const lotMatching = this.runLotMatchingAnalysis(options);
    const temperatureBreak = this.runTemperatureBreakAnalysis(options);
    const inventoryDiff = this.runInventoryDifferenceAnalysis(options);
    
    const ledgerUpdate = this.updateExceptionLedger(options);
    
    const allExceptions = this.dataStore.getExceptions();
    const openExceptions = allExceptions.records.filter(e => e.status === 'open');
    
    return {
      analysisTime: dayjs().toISOString(),
      ledgerUpdate,
      lotMatching,
      temperatureBreak,
      inventoryDiff,
      openExceptions,
      summary: {
        totalExceptions: allExceptions.records.length,
        totalOpen: openExceptions.length,
        totalResolved: allExceptions.records.filter(e => e.status === 'resolved').length,
        totalSuperseded: allExceptions.records.filter(e => e.status === 'superseded').length,
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
