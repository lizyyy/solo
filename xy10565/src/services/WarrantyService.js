const config = require('../config');
const dayjs = require('dayjs');
const ReplacementApplication = require('../models/ReplacementApplication');
const Device = require('../models/Device');
const Product = require('../models/Product');
const WarrantyRecord = require('../models/WarrantyRecord');
const InventoryAllocation = require('../models/InventoryAllocation');
const StatusHistoryService = require('./StatusHistoryService');
const OperationLogService = require('./OperationLogService');
const IdempotencyService = require('./IdempotencyService');

class WarrantyService {
  canCalculateWarranty(application) {
    const allowedStatuses = [
      config.business.status.RECYCLED,
      config.business.status.WARRANTY_CALCULATING
    ];
    return allowedStatuses.includes(application.status);
  }

  calculateWarranty(originalDevice, targetProduct, mode = config.business.warranty.inheritMode) {
    const today = dayjs();
    
    if (mode === config.business.warranty.inheritMode) {
      const originalEnd = originalDevice.warranty_end_date 
        ? dayjs(originalDevice.warranty_end_date)
        : null;
      
      if (originalEnd && originalEnd.isAfter(today)) {
        return {
          mode: 'inherit',
          start_date: today.format('YYYY-MM-DD'),
          end_date: originalEnd.format('YYYY-MM-DD'),
          days_remaining: originalEnd.diff(today, 'day'),
          notes: '继承原机剩余保修期'
        };
      }
    }

    const extensionDays = config.business.warranty.defaultExtensionDays;
    return {
      mode: 'extend',
      start_date: today.format('YYYY-MM-DD'),
      end_date: today.add(extensionDays, 'day').format('YYYY-MM-DD'),
      extension_days: extensionDays,
      notes: `按新设备计算 ${extensionDays} 天保修期`
    };
  }

  startWarrantyCalculation(applicationId, operator) {
    const application = ReplacementApplication.findById(applicationId);
    if (!application) {
      throw new Error('申请单不存在');
    }

    if (!this.canCalculateWarranty(application)) {
      throw new Error(`当前状态 ${application.status} 不允许计算保修`);
    }

    const result = StatusHistoryService.updateApplicationStatus(
      applicationId,
      config.business.status.WARRANTY_CALCULATING,
      'WARRANTY',
      operator,
      '开始保修期重算'
    );

    return result.application;
  }

  recalculateWarranty(applicationId, options = {}, operator) {
    const requestKey = IdempotencyService.generateRequestKey('warranty_calc', applicationId);
    
    return IdempotencyService.checkAndExecute(requestKey, 'warranty_calc', applicationId, () => {
      const application = ReplacementApplication.findById(applicationId);
      if (!application) {
        throw new Error('申请单不存在');
      }

      if (!this.canCalculateWarranty(application)) {
        throw new Error(`当前状态 ${application.status} 不允许计算保修`);
      }

      const existingWarranty = WarrantyRecord.findByApplicationId(applicationId);
      if (existingWarranty) {
        return {
          application,
          warranty: existingWarranty,
          isDuplicate: true,
          message: '保修期已计算'
        };
      }

      const allocation = InventoryAllocation.findByApplicationId(applicationId);
      if (!allocation) {
        throw new Error('找不到库存分配记录');
      }

      const originalDevice = Device.findById(application.original_device_id);
      const newDevice = Device.findById(allocation.new_device_id);
      const targetProduct = Product.findById(application.target_product_id);

      if (!originalDevice || !newDevice || !targetProduct) {
        throw new Error('必要数据不完整');
      }

      const mode = options.mode || config.business.warranty.inheritMode;
      const warrantyInfo = this.calculateWarranty(originalDevice, targetProduct, mode);

      const beforeNewDevice = { ...newDevice };
      Device.update(newDevice.id, {
        warranty_start_date: warrantyInfo.start_date,
        warranty_end_date: warrantyInfo.end_date
      });

      const warranty = WarrantyRecord.create({
        application_id: applicationId,
        device_id: allocation.new_device_id,
        original_warranty_start: originalDevice.warranty_start_date,
        original_warranty_end: originalDevice.warranty_end_date,
        new_warranty_start: warrantyInfo.start_date,
        new_warranty_end: warrantyInfo.end_date,
        calculation_mode: warrantyInfo.mode,
        extension_days: warrantyInfo.extension_days || 0,
        notes: options.notes || warrantyInfo.notes,
        operator
      });

      OperationLogService.recordOperation(
        applicationId,
        'WARRANTY_CALCULATE',
        'WARRANTY',
        operator,
        beforeNewDevice,
        {
          ...beforeNewDevice,
          warranty_start_date: warrantyInfo.start_date,
          warranty_end_date: warrantyInfo.end_date
        },
        options.notes || warrantyInfo.notes
      );

      StatusHistoryService.updateApplicationStatus(
        applicationId,
        config.business.status.WARRANTY_UPDATED,
        'WARRANTY',
        operator,
        '保修期重算完成',
        {
          mode: warrantyInfo.mode,
          start_date: warrantyInfo.start_date,
          end_date: warrantyInfo.end_date
        }
      );

      StatusHistoryService.updateApplicationStatus(
        applicationId,
        config.business.status.COMPLETED,
        'APPLICATION',
        operator,
        '换新流程完成',
        {
          completed_at: new Date().toISOString()
        }
      );

      ReplacementApplication.update(applicationId, {
        completed_at: new Date().toISOString()
      });

      return {
        application: ReplacementApplication.findById(applicationId),
        warranty,
        device: Device.findById(allocation.new_device_id)
      };
    });
  }

  manualExtendWarranty(applicationId, extendDays, operator, reason) {
    const warranty = WarrantyRecord.findByApplicationId(applicationId);
    if (!warranty) {
      throw new Error('该申请单没有保修记录');
    }

    const device = Device.findById(warranty.device_id);
    if (!device) {
      throw new Error('设备不存在');
    }

    const beforeWarranty = { ...warranty };
    const beforeDevice = { ...device };

    const newEndDate = dayjs(device.warranty_end_date).add(extendDays, 'day').format('YYYY-MM-DD');

    Device.update(device.id, {
      warranty_end_date: newEndDate
    });

    WarrantyRecord.update(warranty.id, {
      new_warranty_end: newEndDate,
      extension_days: warranty.extension_days + extendDays,
      notes: `${warranty.notes || ''} 人工延长 ${extendDays} 天`
    });

    OperationLogService.recordManualCorrection(
      applicationId,
      'WARRANTY',
      operator,
      { warranty: beforeWarranty, device: beforeDevice },
      { 
        warranty: { ...beforeWarranty, new_warranty_end: newEndDate, extension_days: beforeWarranty.extension_days + extendDays },
        device: { ...beforeDevice, warranty_end_date: newEndDate }
      },
      reason || `人工延长保修期 ${extendDays} 天`
    );

    return {
      warranty: WarrantyRecord.findById(warranty.id),
      device: Device.findById(device.id)
    };
  }

  getWarrantyRecord(applicationId) {
    return WarrantyRecord.findByApplicationId(applicationId);
  }
}

module.exports = new WarrantyService();
