const { BatchRepository, ChemicalRepository, AuditLogRepository } = require('../storage/repositories');
const { PermissionValidator } = require('../validation/PermissionValidator');
const AuditLog = require('../models/AuditLog');
const config = require('../config');
const moment = require('moment');

class AlertService {
  constructor() {
    this.batchRepository = new BatchRepository();
    this.chemicalRepository = new ChemicalRepository();
    this.auditLogRepository = new AuditLogRepository();
  }

  async getStockAlerts(user) {
    PermissionValidator.checkIsSafetyOfficer(user.role);
    
    const batches = await this.batchRepository.getLowStockBatches(config.alert.stock_threshold);
    
    const chemicalsMap = new Map();
    for (const batch of batches) {
      if (!chemicalsMap.has(batch.chemical_id)) {
        const chemical = await this.chemicalRepository.findById(batch.chemical_id);
        chemicalsMap.set(batch.chemical_id, chemical);
      }
    }
    
    const alerts = batches.map(batch => ({
      id: batch.id,
      type: 'stock',
      level: 'warning',
      message: `试剂 ${chemicalsMap.get(batch.chemical_id)?.name || '未知'} 库存不足`,
      details: {
        chemical: chemicalsMap.get(batch.chemical_id)?.toJSON(),
        batch: batch.toJSON(),
        current_stock: batch.current_quantity,
        threshold: config.alert.stock_threshold,
        unit: batch.unit
      },
      timestamp: moment().toISOString()
    }));
    
    return {
      data: alerts,
      total: alerts.length,
      threshold: config.alert.stock_threshold
    };
  }

  async getExpiryAlerts(user) {
    PermissionValidator.checkIsSafetyOfficer(user.role);
    
    const batches = await this.batchRepository.getExpiringBatches(config.alert.expiry_days_threshold);
    
    const chemicalsMap = new Map();
    for (const batch of batches) {
      if (!chemicalsMap.has(batch.chemical_id)) {
        const chemical = await this.chemicalRepository.findById(batch.chemical_id);
        chemicalsMap.set(batch.chemical_id, chemical);
      }
    }
    
    const alerts = batches.map(batch => {
      const daysUntilExpiry = batch.getDaysUntilExpiry();
      let level = 'warning';
      if (daysUntilExpiry <= 7) {
        level = 'danger';
      } else if (daysUntilExpiry <= 14) {
        level = 'warning';
      } else {
        level = 'info';
      }
      
      return {
        id: batch.id,
        type: 'expiry',
        level,
        message: `试剂 ${chemicalsMap.get(batch.chemical_id)?.name || '未知'} 即将过期`,
        details: {
          chemical: chemicalsMap.get(batch.chemical_id)?.toJSON(),
          batch: batch.toJSON(),
          expiry_date: batch.expiry_date,
          days_until_expiry: daysUntilExpiry,
          threshold_days: config.alert.expiry_days_threshold
        },
        timestamp: moment().toISOString()
      };
    });
    
    return {
      data: alerts,
      total: alerts.length,
      threshold_days: config.alert.expiry_days_threshold
    };
  }

  async getAllAlerts(user) {
    PermissionValidator.checkIsSafetyOfficer(user.role);
    
    const stockAlerts = await this.getStockAlerts(user);
    const expiryAlerts = await this.getExpiryAlerts(user);
    
    const allAlerts = [
      ...stockAlerts.data,
      ...expiryAlerts.data
    ].sort((a, b) => {
      const priority = { danger: 0, warning: 1, info: 2 };
      return priority[a.level] - priority[b.level];
    });
    
    return {
      data: allAlerts,
      summary: {
        total: allAlerts.length,
        stock_alerts: stockAlerts.total,
        expiry_alerts: expiryAlerts.total,
        danger_alerts: allAlerts.filter(a => a.level === 'danger').length,
        warning_alerts: allAlerts.filter(a => a.level === 'warning').length,
        info_alerts: allAlerts.filter(a => a.level === 'info').length
      },
      thresholds: {
        stock: config.alert.stock_threshold,
        expiry_days: config.alert.expiry_days_threshold
      }
    };
  }

  async acknowledgeAlert(alertType, entityId, user) {
    PermissionValidator.checkIsSafetyOfficer(user.role);
    
    const action = alertType === 'stock' ? AuditLog.actions.STOCK_ALERT : AuditLog.actions.EXPIRY_ALERT;
    const entityType = AuditLog.entityTypes.BATCH;
    
    await this.auditLogRepository.logAction({
      action,
      entity_type: entityType,
      entity_id: entityId,
      description: `用户确认了${alertType === 'stock' ? '库存' : '过期'}预警`,
      user_id: user.id,
      user_role: user.role
    });
    
    return {
      acknowledged: true,
      alert_type: alertType,
      entity_id: entityId,
      acknowledged_at: moment().toISOString()
    };
  }

  async getAlertStatistics(user) {
    PermissionValidator.checkIsSafetyOfficer(user.role);
    
    const stockBatches = await this.batchRepository.getLowStockBatches(config.alert.stock_threshold);
    const expiryBatches = await this.batchRepository.getExpiringBatches(config.alert.expiry_days_threshold);
    
    const criticalExpiry = expiryBatches.filter(b => b.getDaysUntilExpiry() <= 7);
    const warningExpiry = expiryBatches.filter(b => b.getDaysUntilExpiry() > 7 && b.getDaysUntilExpiry() <= 14);
    
    const uniqueChemicals = new Set();
    stockBatches.forEach(b => uniqueChemicals.add(b.chemical_id));
    expiryBatches.forEach(b => uniqueChemicals.add(b.chemical_id));
    
    return {
      stock: {
        total: stockBatches.length,
        unique_chemicals: uniqueChemicals.size
      },
      expiry: {
        total: expiryBatches.length,
        critical: criticalExpiry.length,
        warning: warningExpiry.length
      },
      thresholds: {
        stock_threshold: config.alert.stock_threshold,
        expiry_threshold_days: config.alert.expiry_days_threshold
      },
      generated_at: moment().toISOString()
    };
  }
}

module.exports = AlertService;
