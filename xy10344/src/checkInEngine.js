const { CheckInStatus } = require('./models');

class CheckInEngine {
  constructor(dataStore) {
    this.store = dataStore;
  }
  
  validateBibScan(bib) {
    const athlete = this.store.athletes.get(bib);
    const alreadyScanned = this.store.hasBibScan(bib);
    
    return {
      valid: !!athlete,
      exists: !!athlete,
      duplicate: alreadyScanned,
      athlete
    };
  }
  
  validateSupplyScan(bib) {
    const athlete = this.store.athletes.get(bib);
    const alreadyScanned = this.store.hasSupplyScan(bib);
    
    return {
      valid: !!athlete,
      exists: !!athlete,
      duplicate: alreadyScanned,
      athlete
    };
  }
  
  getAthleteCheckInStatus(bib) {
    const athlete = this.store.athletes.get(bib);
    if (!athlete) {
      return {
        bib,
        athlete: null,
        status: 'unknown',
        issues: ['选手不存在']
      };
    }
    
    const issues = [];
    const warnings = [];
    
    const hasBib = this.store.hasBibScan(bib);
    const hasSupply = this.store.hasSupplyScan(bib);
    const missingEquipment = this.store.getMissingEquipment(bib);
    const rawMissingEquipment = this.store.getRawMissingEquipment(bib);
    const hasWaiving = this.store.waivings.some(w => w.bib === bib);
    const isAllRawMissingWaived = rawMissingEquipment.length > 0 && 
                                  this._isAllMissingWaived(bib, rawMissingEquipment);
    
    if (!hasBib) {
      issues.push('号码布未发放');
    }
    
    if (hasSupply && !hasBib) {
      warnings.push('补给包已发放但未完成检录');
    }
    
    if (missingEquipment.length > 0) {
      issues.push(`缺少装备: ${missingEquipment.map(e => e.name).join(', ')}`);
    }
    
    let status;
    if (hasWaiving && isAllRawMissingWaived) {
      status = CheckInStatus.VALUES.WAIVED;
    } else if (issues.length > 0) {
      if (!hasBib) {
        status = CheckInStatus.VALUES.PENDING;
      } else {
        status = CheckInStatus.VALUES.PENDING_EQUIPMENT;
      }
    } else {
      status = CheckInStatus.VALUES.APPROVED;
    }
    
    return {
      bib,
      athlete,
      status,
      hasBib,
      hasSupply,
      missingEquipment,
      hasWaiving,
      issues,
      warnings
    };
  }
  
  _isAllMissingWaived(bib, missingEquipment) {
    return missingEquipment.every(e => 
      this.store.waivings.some(w => w.bib === bib && w.equipmentId === e.id)
    );
  }
  
  getAllCheckInStatuses() {
    const result = [];
    this.store.athletes.forEach((athlete, bib) => {
      result.push(this.getAthleteCheckInStatus(bib));
    });
    return result;
  }
  
  getStatistics() {
    const statuses = this.getAllCheckInStatuses();
    const total = statuses.length;
    
    const stats = {
      total,
      byStatus: {
        approved: 0,
        pending: 0,
        pendingEquipment: 0,
        waived: 0,
        rejected: 0
      },
      bibIssued: 0,
      supplyIssued: 0,
      hasWaiving: 0,
      withMissingEquipment: 0,
      anomalies: []
    };
    
    statuses.forEach(s => {
      switch (s.status) {
        case CheckInStatus.VALUES.APPROVED:
          stats.byStatus.approved++;
          break;
        case CheckInStatus.VALUES.PENDING:
          stats.byStatus.pending++;
          break;
        case CheckInStatus.VALUES.PENDING_EQUIPMENT:
          stats.byStatus.pendingEquipment++;
          break;
        case CheckInStatus.VALUES.WAIVED:
          stats.byStatus.waived++;
          break;
        case CheckInStatus.VALUES.REJECTED:
          stats.byStatus.rejected++;
          break;
      }
      
      if (s.hasBib) stats.bibIssued++;
      if (s.hasSupply) stats.supplyIssued++;
      if (s.hasWaiving) stats.hasWaiving++;
      if (s.missingEquipment.length > 0) stats.withMissingEquipment++;
      
      if (s.warnings.length > 0 || s.status === CheckInStatus.VALUES.PENDING) {
        stats.anomalies.push(s);
      }
    });
    
    stats.approvalRate = total > 0 
      ? ((stats.byStatus.approved + stats.byStatus.waived) / total * 100).toFixed(1) 
      : '0.0';
    
    return stats;
  }
  
  canCheckIn(bib) {
    const status = this.getAthleteCheckInStatus(bib);
    return status.status === CheckInStatus.VALUES.APPROVED || 
           status.status === CheckInStatus.VALUES.WAIVED;
  }
}

module.exports = CheckInEngine;
