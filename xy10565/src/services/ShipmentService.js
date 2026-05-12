const config = require('../config');
const ReplacementApplication = require('../models/ReplacementApplication');
const Device = require('../models/Device');
const Shipment = require('../models/Shipment');
const InventoryAllocation = require('../models/InventoryAllocation');
const StatusHistoryService = require('./StatusHistoryService');
const OperationLogService = require('./OperationLogService');
const IdempotencyService = require('./IdempotencyService');

class ShipmentService {
  canShip(application) {
    const allowedStatuses = [
      config.business.status.INVENTORY_ALLOCATED,
      config.business.status.SHIPPING
    ];
    return allowedStatuses.includes(application.status);
  }

  startShipping(applicationId, operator) {
    const application = ReplacementApplication.findById(applicationId);
    if (!application) {
      throw new Error('申请单不存在');
    }

    if (!this.canShip(application)) {
      throw new Error(`当前状态 ${application.status} 不允许发货`);
    }

    const allocation = InventoryAllocation.findByApplicationId(applicationId);
    if (!allocation) {
      throw new Error('该申请单没有库存分配记录');
    }

    const result = StatusHistoryService.updateApplicationStatus(
      applicationId,
      config.business.status.SHIPPING,
      'SHIPMENT',
      operator,
      '开始发货流程'
    );

    return result.application;
  }

  createShipment(applicationId, shipmentData, operator) {
    const requestKey = IdempotencyService.generateRequestKey('shipment_create', applicationId);
    
    return IdempotencyService.checkAndExecute(requestKey, 'shipment_create', applicationId, () => {
      const application = ReplacementApplication.findById(applicationId);
      if (!application) {
        throw new Error('申请单不存在');
      }

      if (!this.canShip(application)) {
        throw new Error(`当前状态 ${application.status} 不允许发货`);
      }

      const allocation = InventoryAllocation.findByApplicationId(applicationId);
      if (!allocation) {
        throw new Error('该申请单没有库存分配记录');
      }

      const existingShipment = Shipment.findByApplicationId(applicationId);
      if (existingShipment) {
        return {
          application,
          shipment: existingShipment,
          isDuplicate: true,
          message: '发货单已创建'
        };
      }

      const device = Device.findById(allocation.new_device_id);
      const beforeDevice = { ...device };

      Device.update(device.id, {
        status: config.business.inventoryStatus.SHIPPED,
        current_owner_id: application.customer_id
      });

      const shipment = Shipment.create({
        application_id: applicationId,
        device_id: allocation.new_device_id,
        tracking_no: shipmentData.tracking_no,
        shipping_company: shipmentData.shipping_company,
        shipping_address: shipmentData.shipping_address,
        status: 'SHIPPED',
        shipped_at: shipmentData.shipped_at || new Date().toISOString(),
        operator,
        notes: shipmentData.notes
      });

      OperationLogService.recordOperation(
        applicationId,
        'SHIPMENT_CREATE',
        'SHIPMENT',
        operator,
        beforeDevice,
        { ...beforeDevice, status: 'SHIPPED' },
        `发货单号: ${shipmentData.tracking_no}`
      );

      const result = StatusHistoryService.updateApplicationStatus(
        applicationId,
        config.business.status.SHIPPED,
        'SHIPMENT',
        operator,
        '新机已发货',
        {
          tracking_no: shipmentData.tracking_no,
          shipping_company: shipmentData.shipping_company
        }
      );

      return {
        application: result.application,
        shipment
      };
    });
  }

  confirmDelivery(applicationId, deliveryData, operator) {
    const shipment = Shipment.findByApplicationId(applicationId);
    if (!shipment) {
      throw new Error('该申请单没有发货记录');
    }

    if (shipment.status === 'DELIVERED') {
      return { shipment, isDuplicate: true, message: '已确认收货' };
    }

    const beforeShipment = { ...shipment };

    Shipment.update(shipment.id, {
      status: 'DELIVERED',
      delivered_at: deliveryData.delivered_at || new Date().toISOString(),
      notes: deliveryData.notes || shipment.notes
    });

    const application = ReplacementApplication.findById(applicationId);
    
    OperationLogService.recordOperation(
      applicationId,
      'SHIPMENT_DELIVERED',
      'SHIPMENT',
      operator,
      beforeShipment,
      { ...beforeShipment, status: 'DELIVERED' },
      '确认收货'
    );

    StatusHistoryService.updateApplicationStatus(
      applicationId,
      config.business.status.WAITING_RECYCLE,
      'SHIPMENT',
      operator,
      '新机已送达，等待原机回收',
      {
        delivered_at: deliveryData.delivered_at || new Date().toISOString()
      }
    );

    return {
      shipment: Shipment.findById(shipment.id),
      application: ReplacementApplication.findById(applicationId)
    };
  }

  getShipment(applicationId) {
    return Shipment.findByApplicationId(applicationId);
  }
}

module.exports = new ShipmentService();
