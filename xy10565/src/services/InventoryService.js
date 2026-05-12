const config = require('../config');
const ReplacementApplication = require('../models/ReplacementApplication');
const Device = require('../models/Device');
const InventoryAllocation = require('../models/InventoryAllocation');
const StatusHistoryService = require('./StatusHistoryService');
const OperationLogService = require('./OperationLogService');
const IdempotencyService = require('./IdempotencyService');

class InventoryService {
  canAllocateInventory(application) {
    const allowedStatuses = [
      config.business.status.FAULT_APPROVED,
      config.business.status.INVENTORY_CHECKING,
      config.business.status.INVENTORY_SHORTAGE
    ];
    return allowedStatuses.includes(application.status);
  }

  checkInventory(productId) {
    const availableCount = Device.countAvailableByProductId(productId);
    const availableDevices = Device.findAll('product_id = ? AND status = ? AND is_new = 1', [productId, 'AVAILABLE']);
    
    return {
      product_id: productId,
      available_count: availableCount,
      available_devices: availableDevices
    };
  }

  startInventoryCheck(applicationId, operator) {
    const application = ReplacementApplication.findById(applicationId);
    if (!application) {
      throw new Error('申请单不存在');
    }

    if (!this.canAllocateInventory(application)) {
      throw new Error(`当前状态 ${application.status} 不允许进行库存检查`);
    }

    const result = StatusHistoryService.updateApplicationStatus(
      applicationId,
      config.business.status.INVENTORY_CHECKING,
      'INVENTORY',
      operator,
      '开始库存检查'
    );

    return result.application;
  }

  allocateInventory(applicationId, operator) {
    const requestKey = IdempotencyService.generateRequestKey('inventory_allocate', applicationId);
    
    return IdempotencyService.checkAndExecute(requestKey, 'inventory_allocate', applicationId, () => {
      const application = ReplacementApplication.findById(applicationId);
      if (!application) {
        throw new Error('申请单不存在');
      }

      if (!this.canAllocateInventory(application)) {
        throw new Error(`当前状态 ${application.status} 不允许分配库存`);
      }

      const existingAllocation = InventoryAllocation.findByApplicationId(applicationId);
      if (existingAllocation) {
        return {
          application,
          allocation: existingAllocation,
          isDuplicate: true,
          message: '库存已分配'
        };
      }

      const availableDevice = Device.findAvailableByProductId(application.target_product_id);
      
      if (!availableDevice) {
        StatusHistoryService.updateApplicationStatus(
          applicationId,
          config.business.status.INVENTORY_SHORTAGE,
          'INVENTORY',
          operator,
          '库存不足，无可用新机'
        );

        OperationLogService.recordOperation(
          applicationId,
          'INVENTORY_SHORTAGE',
          'INVENTORY',
          operator,
          null,
          { product_id: application.target_product_id },
          '库存不足'
        );

        const updatedApplication = ReplacementApplication.findById(applicationId);
        return {
          application: updatedApplication,
          allocation: null,
          inventory_shortage: true,
          message: '库存不足，无可用新机'
        };
      }

      const beforeDevice = { ...availableDevice };
      Device.update(availableDevice.id, {
        status: config.business.inventoryStatus.ALLOCATED
      });

      const allocation = InventoryAllocation.create({
        application_id: applicationId,
        new_device_id: availableDevice.id,
        allocation_status: config.business.inventoryStatus.ALLOCATED,
        allocated_at: new Date().toISOString(),
        operator
      });

      OperationLogService.recordOperation(
        applicationId,
        'INVENTORY_ALLOCATE',
        'INVENTORY',
        operator,
        beforeDevice,
        { ...beforeDevice, status: 'ALLOCATED' },
        `分配新机 ${availableDevice.sn}`
      );

      const result = StatusHistoryService.updateApplicationStatus(
        applicationId,
        config.business.status.INVENTORY_ALLOCATED,
        'INVENTORY',
        operator,
        '库存分配成功',
        {
          device_sn: availableDevice.sn,
          device_id: availableDevice.id
        }
      );

      return {
        application: result.application,
        allocation,
        device: Device.findById(availableDevice.id)
      };
    });
  }

  releaseInventory(applicationId, operator, reason) {
    const allocation = InventoryAllocation.findByApplicationId(applicationId);
    if (!allocation) {
      throw new Error('该申请单没有库存分配记录');
    }

    const device = Device.findById(allocation.new_device_id);
    if (!device) {
      throw new Error('分配的设备不存在');
    }

    const beforeDevice = { ...device };
    Device.update(device.id, {
      status: config.business.inventoryStatus.AVAILABLE
    });

    InventoryAllocation.update(allocation.id, {
      allocation_status: 'RELEASED',
      released_at: new Date().toISOString(),
      operator,
      notes: reason
    });

    OperationLogService.recordOperation(
      applicationId,
      'INVENTORY_RELEASE',
      'INVENTORY',
      operator,
      beforeDevice,
      { ...beforeDevice, status: 'AVAILABLE' },
      reason || '释放库存'
    );

    return true;
  }

  getAllocation(applicationId) {
    return InventoryAllocation.findByApplicationId(applicationId);
  }
}

module.exports = new InventoryService();
