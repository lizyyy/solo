const config = require('../config');
const dbManager = require('../db/database');
const ReplacementApplication = require('../models/ReplacementApplication');
const Device = require('../models/Device');
const Customer = require('../models/Customer');
const Product = require('../models/Product');
const StatusHistoryService = require('./StatusHistoryService');
const OperationLogService = require('./OperationLogService');
const IdempotencyService = require('./IdempotencyService');
const FaultAuditService = require('./FaultAuditService');
const InventoryService = require('./InventoryService');
const ShipmentService = require('./ShipmentService');
const RecycleService = require('./RecycleService');
const WarrantyService = require('./WarrantyService');

class ReplacementService {
  checkDuplicateApplication(originalDeviceId) {
    return ReplacementApplication.findByOriginalDeviceId(originalDeviceId);
  }

  createApplication(data, operator) {
    const requestKey = IdempotencyService.generateRequestKey(
      'create_application',
      data.original_device_id,
      data.customer_id
    );
    
    return IdempotencyService.checkAndExecute(requestKey, 'create_application', null, () => {
      const device = Device.findById(data.original_device_id);
      if (!device) {
        throw new Error('原设备不存在');
      }

      const customer = Customer.findById(data.customer_id);
      if (!customer) {
        throw new Error('客户不存在');
      }

      const product = Product.findById(data.target_product_id);
      if (!product) {
        throw new Error('目标产品不存在');
      }

      if (device.current_owner_id && device.current_owner_id !== data.customer_id) {
        throw new Error('设备不属于该客户');
      }

      const existingApplication = this.checkDuplicateApplication(data.original_device_id);
      if (existingApplication) {
        return {
          isDuplicate: true,
          application: existingApplication,
          message: '该设备已有进行中的换新申请'
        };
      }

      const application = ReplacementApplication.createApplication({
        customer_id: data.customer_id,
        original_device_id: data.original_device_id,
        target_product_id: data.target_product_id,
        replacement_reason: data.replacement_reason,
        application_source: data.application_source || 'CUSTOMER',
        applicant: data.applicant || operator,
        status: config.business.status.APPLICATION_PENDING
      });

      StatusHistoryService.recordStatusChange(
        application.id,
        'APPLICATION',
        null,
        config.business.status.APPLICATION_PENDING,
        operator,
        '创建换新申请'
      );

      OperationLogService.recordOperation(
        application.id,
        'CREATE',
        'APPLICATION',
        operator,
        null,
        application,
        data.replacement_reason || '客户申请换新'
      );

      return {
        isDuplicate: false,
        application,
        message: '换新申请创建成功'
      };
    });
  }

  getApplicationDetail(applicationId) {
    const application = ReplacementApplication.findById(applicationId);
    if (!application) {
      throw new Error('申请单不存在');
    }

    const customer = Customer.findById(application.customer_id);
    const originalDevice = Device.findById(application.original_device_id);
    const targetProduct = Product.findById(application.target_product_id);

    const faultAudit = FaultAuditService.getFaultAudit(applicationId);
    const allocation = InventoryService.getAllocation(applicationId);
    const shipment = ShipmentService.getShipment(applicationId);
    const recycle = RecycleService.getRecycleRecord(applicationId);
    const warranty = WarrantyService.getWarrantyRecord(applicationId);

    const history = StatusHistoryService.getHistory(applicationId);
    const logs = OperationLogService.getLogsByApplication(applicationId);

    let newDevice = null;
    if (allocation) {
      newDevice = Device.findById(allocation.new_device_id);
    }

    return {
      application: {
        ...application,
        customer,
        original_device: originalDevice,
        target_product: targetProduct,
        new_device: newDevice
      },
      fault_audit: faultAudit,
      allocation,
      shipment,
      recycle,
      warranty,
      status_history: history,
      operation_logs: logs
    };
  }

  listApplications(filter = {}) {
    let where = '1=1';
    const params = [];

    if (filter.status) {
      where += ' AND status = ?';
      params.push(filter.status);
    }

    if (filter.customer_id) {
      where += ' AND customer_id = ?';
      params.push(filter.customer_id);
    }

    if (filter.application_no) {
      where += ' AND application_no LIKE ?';
      params.push(`%${filter.application_no}%`);
    }

    const applications = ReplacementApplication.findAll(where, params);
    
    return applications.map(app => {
      const customer = Customer.findById(app.customer_id);
      const device = Device.findById(app.original_device_id);
      return {
        ...app,
        customer_name: customer?.name,
        original_device_sn: device?.sn
      };
    });
  }

  cancelApplication(applicationId, operator, reason) {
    const application = ReplacementApplication.findById(applicationId);
    if (!application) {
      throw new Error('申请单不存在');
    }

    const terminatedStatuses = ['COMPLETED', 'CANCELLED', 'FAILED'];
    if (terminatedStatuses.includes(application.status)) {
      throw new Error(`当前状态 ${application.status} 无法取消`);
    }

    const allocation = InventoryService.getAllocation(applicationId);
    if (allocation && allocation.allocation_status === 'ALLOCATED') {
      InventoryService.releaseInventory(applicationId, operator, '取消申请，释放库存');
    }

    const beforeApp = { ...application };

    ReplacementApplication.update(applicationId, {
      status: config.business.status.CANCELLED
    });

    OperationLogService.recordOperation(
      applicationId,
      'CANCEL',
      'APPLICATION',
      operator,
      beforeApp,
      { ...beforeApp, status: 'CANCELLED' },
      reason || '取消换新申请'
    );

    StatusHistoryService.updateApplicationStatus(
      applicationId,
      config.business.status.CANCELLED,
      'APPLICATION',
      operator,
      reason || '取消换新申请'
    );

    return ReplacementApplication.findById(applicationId);
  }

  getStatistics() {
    const allApplications = ReplacementApplication.findAll();
    const stats = {
      total: allApplications.length,
      by_status: {},
      risk_summary: {
        recycle_overdue: 0,
        inventory_shortage: 0,
        awaiting_recycle: 0
      }
    };

    for (const app of allApplications) {
      if (!stats.by_status[app.status]) {
        stats.by_status[app.status] = 0;
      }
      stats.by_status[app.status]++;

      if (app.status === config.business.status.RECYCLE_OVERDUE) {
        stats.risk_summary.recycle_overdue++;
      }
      if (app.status === config.business.status.INVENTORY_SHORTAGE) {
        stats.risk_summary.inventory_shortage++;
      }
      if (['WAITING_RECYCLE', 'RECYCLING'].includes(app.status)) {
        stats.risk_summary.awaiting_recycle++;
      }
    }

    return stats;
  }

  getRiskReport() {
    const overdueApplications = ReplacementApplication.findByStatus(config.business.status.RECYCLE_OVERDUE);
    const shortageApplications = ReplacementApplication.findByStatus(config.business.status.INVENTORY_SHORTAGE);
    const pendingRecycle = ReplacementApplication.findAll(
      `status IN (?, ?)`,
      ['WAITING_RECYCLE', 'RECYCLING']
    );

    return {
      generated_at: new Date().toISOString(),
      risks: {
        recycle_overdue: overdueApplications.map(app => {
          const recycle = RecycleService.getRecycleRecord(app.id);
          const customer = Customer.findById(app.customer_id);
          return {
            application_id: app.id,
            application_no: app.application_no,
            customer_name: customer?.name,
            expected_receive_date: recycle?.expected_receive_date,
            status: app.status
          };
        }),
        inventory_shortage: shortageApplications.map(app => {
          const product = Product.findById(app.target_product_id);
          const customer = Customer.findById(app.customer_id);
          return {
            application_id: app.id,
            application_no: app.application_no,
            customer_name: customer?.name,
            target_product: product?.name,
            product_sku: product?.sku
          };
        }),
        awaiting_recycle: pendingRecycle.map(app => {
          const recycle = RecycleService.getRecycleRecord(app.id);
          const customer = Customer.findById(app.customer_id);
          return {
            application_id: app.id,
            application_no: app.application_no,
            customer_name: customer?.name,
            expected_receive_date: recycle?.expected_receive_date,
            status: app.status
          };
        })
      },
      summary: {
        recycle_overdue_count: overdueApplications.length,
        inventory_shortage_count: shortageApplications.length,
        awaiting_recycle_count: pendingRecycle.length
      }
    };
  }

  getDeviceRelationReport(applicationId) {
    const detail = this.getApplicationDetail(applicationId);
    
    return {
      application_no: detail.application.application_no,
      customer: {
        id: detail.application.customer?.id,
        name: detail.application.customer?.name,
        phone: detail.application.customer?.phone
      },
      original_device: detail.application.original_device ? {
        sn: detail.application.original_device.sn,
        product_id: detail.application.original_device.product_id,
        is_new: detail.application.original_device.is_new,
        warranty_start: detail.application.original_device.warranty_start_date,
        warranty_end: detail.application.original_device.warranty_end_date
      } : null,
      new_device: detail.application.new_device ? {
        sn: detail.application.new_device.sn,
        product_id: detail.application.new_device.product_id,
        is_new: detail.application.new_device.is_new,
        status: detail.application.new_device.status,
        warranty_start: detail.application.new_device.warranty_start_date,
        warranty_end: detail.application.new_device.warranty_end_date
      } : null,
      inventory_status: detail.allocation ? {
        allocated: detail.allocation.allocation_status === 'ALLOCATED',
        allocation_status: detail.allocation.allocation_status,
        allocated_at: detail.allocation.allocated_at
      } : null,
      recycle_status: detail.recycle ? {
        status: detail.recycle.status,
        expected_receive_date: detail.recycle.expected_receive_date,
        actual_receive_date: detail.recycle.actual_receive_date
      } : null,
      warranty_status: detail.warranty ? {
        mode: detail.warranty.calculation_mode,
        original_end: detail.warranty.original_warranty_end,
        new_end: detail.warranty.new_warranty_end,
        extension_days: detail.warranty.extension_days
      } : null,
      application_status: detail.application.status,
      completed: detail.application.status === 'COMPLETED'
    };
  }
}

module.exports = new ReplacementService();
