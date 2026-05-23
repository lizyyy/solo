const depositService = require('../services/DepositService');
const exportService = require('../services/ExportService');

class DepositController {
  async createCustomer(req, res) {
    try {
      const { name, phone, address } = req.body;
      if (!name || !phone) {
        return res.status(400).json({ 
          success: false, 
          message: '姓名和手机号不能为空' 
        });
      }

      const existing = await depositService.getCustomerByPhone(phone);
      if (existing) {
        return res.status(400).json({ 
          success: false, 
          message: '该手机号已存在' 
        });
      }

      const customer = await depositService.createCustomer({ name, phone, address });
      res.json({ success: true, data: customer });
    } catch (error) {
      await depositService.logException('/api/customers', req.body, 'create_customer_error', error.message);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getCustomer(req, res) {
    try {
      const { id } = req.params;
      const customer = await depositService.getCustomerById(id);
      if (!customer) {
        return res.status(404).json({ success: false, message: '客户不存在' });
      }
      res.json({ success: true, data: customer });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async listCustomers(req, res) {
    try {
      const result = await depositService.listCustomers(req.query);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async createDeliveryOrder(req, res) {
    try {
      const { customer_id, bucket_count, bucket_nos, deposit_amount, delivery_address, order_no, created_by, remark } = req.body;

      if (!customer_id || !bucket_count) {
        return res.status(400).json({ 
          success: false, 
          message: '客户ID和桶数量不能为空' 
        });
      }

      const order = await depositService.createDeliveryOrder({
        customer_id,
        bucket_count,
        bucket_nos,
        deposit_amount,
        delivery_address,
        order_no,
        created_by,
        remark
      });

      res.json({ success: true, data: order });
    } catch (error) {
      if (error.message.includes('重复提交')) {
        await depositService.logException('/api/delivery-orders', req.body, 'duplicate_submission', error.message);
      } else {
        await depositService.logException('/api/delivery-orders', req.body, 'create_delivery_error', error.message);
      }
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async getDeliveryOrder(req, res) {
    try {
      const { id } = req.params;
      const order = await depositService.getDeliveryOrderById(id);
      if (!order) {
        return res.status(404).json({ success: false, message: '配送单不存在' });
      }
      res.json({ success: true, data: order });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async confirmDeliveryOrder(req, res) {
    try {
      const { id } = req.params;
      const { operator } = req.body;

      if (!operator) {
        return res.status(400).json({ 
          success: false, 
          message: '操作人不能为空' 
        });
      }

      const order = await depositService.confirmDeliveryOrder(id, operator);
      res.json({ success: true, data: order });
    } catch (error) {
      await depositService.logException(`/api/delivery-orders/${id}/confirm`, req.body, 'confirm_delivery_error', error.message);
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async cancelDeliveryOrder(req, res) {
    try {
      const { id } = req.params;
      const { operator } = req.body;

      if (!operator) {
        return res.status(400).json({ 
          success: false, 
          message: '操作人不能为空' 
        });
      }

      const order = await depositService.cancelDeliveryOrder(id, operator);
      res.json({ success: true, data: order });
    } catch (error) {
      await depositService.logException(`/api/delivery-orders/${id}/cancel`, req.body, 'cancel_delivery_error', error.message);
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async createReturnRecord(req, res) {
    try {
      const { customer_id, bucket_nos, deduction_amount, deduction_reason, operator, remark } = req.body;

      if (!customer_id || !bucket_nos || bucket_nos.length === 0) {
        return res.status(400).json({ 
          success: false, 
          message: '客户ID和桶编号不能为空' 
        });
      }

      const returnRecord = await depositService.createReturnRecord({
        customer_id,
        bucket_nos,
        deduction_amount,
        deduction_reason,
        operator,
        remark
      });

      res.json({ success: true, data: returnRecord });
    } catch (error) {
      await depositService.logException('/api/return-records', req.body, 'create_return_error', error.message);
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async getStatusHistory(req, res) {
    try {
      const { entityType, entityId } = req.params;
      const history = await depositService.getStatusHistory(entityType, entityId);
      res.json({ success: true, data: history });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async listExceptions(req, res) {
    try {
      const exceptions = await depositService.listExceptions(req.query);
      res.json({ success: true, data: exceptions });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async handleException(req, res) {
    try {
      const { id } = req.params;
      const { handling_result, handled_by } = req.body;

      if (!handling_result || !handled_by) {
        return res.status(400).json({ 
          success: false, 
          message: '处理结果和处理人不能为空' 
        });
      }

      const exception = await depositService.handleException(id, handling_result, handled_by);
      res.json({ success: true, data: exception });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async createManualCorrection(req, res) {
    try {
      const { customer_id, correction_type, after_value, reason, operator, related_exception_id } = req.body;

      if (!customer_id || !correction_type || after_value === undefined || !reason || !operator) {
        return res.status(400).json({ 
          success: false, 
          message: '参数不完整' 
        });
      }

      const correction = await depositService.createManualCorrection({
        customer_id,
        correction_type,
        after_value,
        reason,
        operator,
        related_exception_id
      });

      res.json({ success: true, data: correction });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async getDepositReport(req, res) {
    try {
      const report = await depositService.getDepositReport(req.query);
      res.json({ success: true, data: report });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async exportDepositReport(req, res) {
    try {
      const result = await exportService.exportDepositReport(req.query);
      res.json({ 
        success: true, 
        data: {
          fileName: result.fileName,
          downloadUrl: `/api/exports/${result.fileName}`,
          totalRecords: result.totalRecords,
          summary: result.summary
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async exportCustomerReport(req, res) {
    try {
      const result = await exportService.exportCustomerReport();
      res.json({ 
        success: true, 
        data: {
          fileName: result.fileName,
          downloadUrl: `/api/exports/${result.fileName}`,
          totalRecords: result.totalRecords
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async exportExceptionLog(req, res) {
    try {
      const result = await exportService.exportExceptionLog();
      res.json({ 
        success: true, 
        data: {
          fileName: result.fileName,
          downloadUrl: `/api/exports/${result.fileName}`,
          totalRecords: result.totalRecords
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async listBuckets(req, res) {
    try {
      const buckets = await depositService.listBuckets(req.query);
      res.json({ success: true, data: buckets });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async healthCheck(req, res) {
    res.json({ 
      success: true, 
      message: '水站桶押金流转API服务运行正常',
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = new DepositController();
