const { prepareTraces } = require('./sorter');
const { validatePackage } = require('./validator');
const { attributeAnomalies } = require('./attribution');
const { formatDate, formatDuration } = require('./utils');
const { VALIDATION_RESULT } = require('./constants');

class LogisticsAnalyzer {
  constructor(database) {
    this.db = database;
  }
  
  analyzePackage(traces, options = {}) {
    const startTime = Date.now();
    
    const prepResult = prepareTraces(traces);
    const sortedTraces = prepResult.sorted;
    
    const validationSorted = validatePackage(sortedTraces);
    const validationOriginal = validatePackage(traces);
    
    const allAnomalies = [];
    const seenAnomalies = new Set();
    
    for (const anomaly of [...validationOriginal.anomalies, ...validationSorted.anomalies]) {
      const key = JSON.stringify({
        type: anomaly.type,
        message: anomaly.message
      });
      
      if (!seenAnomalies.has(key)) {
        seenAnomalies.add(key);
        allAnomalies.push(anomaly);
      }
    }
    
    const high = allAnomalies.filter(a => a.severity === 'high').length;
    const medium = allAnomalies.filter(a => a.severity === 'medium').length;
    const low = allAnomalies.filter(a => a.severity === 'low').length;
    
    let result = VALIDATION_RESULT.VALID;
    if (high > 0) {
      result = VALIDATION_RESULT.ERROR;
    } else if (medium > 0) {
      result = VALIDATION_RESULT.WARNING;
    }
    
    const attributed = allAnomalies.length > 0 
      ? attributeAnomalies(allAnomalies, sortedTraces)
      : [];
    
    const durationMs = Date.now() - startTime;
    
    return {
      result,
      anomalies: attributed,
      summary: {
        total: allAnomalies.length,
        high,
        medium,
        low
      },
      traceCount: validationSorted.traceCount || traces.length,
      firstTrace: validationSorted.firstTrace,
      lastTrace: validationSorted.lastTrace,
      prepared: prepResult,
      durationMs,
      sortedTraces,
      originalTraces: traces
    };
  }
  
  importAndValidatePackage(trackingNumber, traces, data = {}, options = {}) {
    const runId = options.runId || this.db.createRun({ name: 'single_package' }).id;
    
    const pkgResult = this.db.upsertPackage(trackingNumber, {
      source: data.source,
      carrier: data.carrier
    });
    
    if (!options.force && !pkgResult.updated && !pkgResult.isNew) {
      const validations = this.db.getPackageValidations(trackingNumber, 1);
      if (validations.length > 0) {
        return {
          trackingNumber,
          packageId: pkgResult.id,
          skipped: true,
          reason: 'no_changes',
          existingValidation: validations[0]
        };
      }
    }
    
    if (options.replace || options.force) {
      this.db.deletePackageTraces(pkgResult.id);
    }
    
    this.db.insertTraces(pkgResult.id, traces);
    
    const analysis = this.analyzePackage(traces, options);
    
    const validationId = this.db.createValidation(pkgResult.id, runId, {
      result: analysis.result,
      traceCount: analysis.traceCount,
      summary: analysis.summary
    }).id;
    
    this.db.insertAnomalies(validationId, pkgResult.id, analysis.anomalies);
    this.db.completeValidation(validationId, analysis.durationMs);
    
    return {
      trackingNumber,
      packageId: pkgResult.id,
      isNew: pkgResult.isNew,
      updated: pkgResult.updated,
      validationId,
      runId,
      result: analysis.result,
      summary: analysis.summary,
      anomalies: analysis.anomalies,
      durationMs: analysis.durationMs
    };
  }
  
  analyzeBatch(packages, options = {}) {
    const startTime = Date.now();
    const runName = options.name || `batch_${formatDate(new Date())}`;
    const runId = this.db.createRun({ name: runName, source: options.source }).id;
    
    const results = {
      total: packages.length,
      valid: 0,
      warning: 0,
      error: 0,
      skipped: 0,
      totalAnomalies: 0,
      byType: {},
      bySeverity: { high: 0, medium: 0, low: 0 },
      packages: []
    };
    
    for (const pkg of packages) {
      const result = this.importAndValidatePackage(
        pkg.trackingNumber,
        pkg.traces,
        { source: pkg.source, carrier: pkg.carrier },
        { runId, ...options }
      );
      
      if (result.skipped) {
        results.skipped++;
        results.packages.push({
          trackingNumber: pkg.trackingNumber,
          skipped: true,
          reason: result.reason
        });
        continue;
      }
      
      results.packages.push(result);
      
      if (result.result === VALIDATION_RESULT.VALID) {
        results.valid++;
      } else if (result.result === VALIDATION_RESULT.WARNING) {
        results.warning++;
      } else {
        results.error++;
      }
      
      for (const anomaly of result.anomalies || []) {
        results.totalAnomalies++;
        results.byType[anomaly.type] = (results.byType[anomaly.type] || 0) + 1;
        results.bySeverity[anomaly.severity]++;
      }
    }
    
    const durationMs = Date.now() - startTime;
    this.db.completeRun(runId, { packageCount: packages.length });
    
    return {
      runId,
      runName,
      durationMs,
      durationFormatted: formatDuration(durationMs),
      ...results
    };
  }
  
  revalidatePackage(trackingNumber, options = {}) {
    const pkg = this.db.getPackage(trackingNumber);
    if (!pkg) {
      return { error: 'package_not_found', trackingNumber };
    }
    
    const traces = this.db.getPackageTraces(pkg.id);
    if (traces.length === 0) {
      return { error: 'no_traces', trackingNumber };
    }
    
    return this.importAndValidatePackage(trackingNumber, traces, {}, {
      ...options,
      force: true
    });
  }
  
  revalidateAll(options = {}) {
    const history = this.db.getValidationHistory(1000);
    const trackingNumbers = [...new Set(history.map(h => h.tracking_number))];
    
    const results = [];
    for (const trackingNumber of trackingNumbers) {
      results.push(this.revalidatePackage(trackingNumber, options));
    }
    
    return {
      total: results.length,
      results
    };
  }
}

module.exports = LogisticsAnalyzer;
