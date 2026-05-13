const express = require('express');
const moment = require('moment');

module.exports = function(db) {
  const router = express.Router();

  const withIdempotency = async (req, res, next) => {
    const idempotencyKey = req.headers['x-idempotency-key'];
    if (!idempotencyKey) {
      return next();
    }

    const existing = await db.checkIdempotency(idempotencyKey);
    if (existing) {
      return res.status(200).json({
        success: true,
        idempotent: true,
        data: JSON.parse(existing.response)
      });
    }

    res.sendResponse = res.json;
    res.json = async (body) => {
      await db.saveIdempotency(idempotencyKey, req.path, req.body, body);
      res.sendResponse(body);
    };

    next();
  };

  const handleError = (res, error, statusCode = 400) => {
    res.status(statusCode).json({
      success: false,
      error: error.message || error
    });
  };

  router.get('/statistics', async (req, res) => {
    try {
      const stats = await db.getStatistics();
      res.json({ success: true, data: stats });
    } catch (error) {
      handleError(res, error, 500);
    }
  });

  router.get('/contracts', async (req, res) => {
    try {
      const contracts = await db.getAllContracts();
      res.json({ success: true, data: contracts });
    } catch (error) {
      handleError(res, error, 500);
    }
  });

  router.get('/contracts/:id', async (req, res) => {
    try {
      const contract = await db.getContract(req.params.id);
      if (!contract) {
        return res.status(404).json({ success: false, error: '合同不存在' });
      }
      res.json({ success: true, data: contract });
    } catch (error) {
      handleError(res, error, 500);
    }
  });

  router.post('/contracts', withIdempotency, async (req, res) => {
    try {
      const required = ['contract_no', 'vendor_name', 'base_price'];
      for (const field of required) {
        if (!req.body[field]) {
          return handleError(res, `缺少必填字段: ${field}`);
        }
      }

      const existing = await db.getContractByNo(req.body.contract_no);
      if (existing) {
        return handleError(res, '合同编号已存在');
      }

      const contract = await db.createContract(req.body);
      res.json({ success: true, data: contract });
    } catch (error) {
      handleError(res, error, 500);
    }
  });

  router.put('/contracts/:id', async (req, res) => {
    try {
      const { modified_by, reason, ...updates } = req.body;
      if (!modified_by) {
        return handleError(res, '缺少修改人');
      }
      if (!reason) {
        return handleError(res, '缺少修改原因');
      }

      const contract = await db.updateContract(req.params.id, updates, modified_by, reason);
      if (!contract) {
        return res.status(404).json({ success: false, error: '合同不存在' });
      }
      res.json({ success: true, data: contract });
    } catch (error) {
      handleError(res, error, 500);
    }
  });

  router.get('/contracts/:id/history', async (req, res) => {
    try {
      const history = await db.getContractHistory(req.params.id);
      res.json({ success: true, data: history });
    } catch (error) {
      handleError(res, error, 500);
    }
  });

  router.get('/work-orders', async (req, res) => {
    try {
      const orders = await db.getAllWorkOrders();
      res.json({ success: true, data: orders });
    } catch (error) {
      handleError(res, error, 500);
    }
  });

  router.get('/work-orders/:id', async (req, res) => {
    try {
      const order = await db.getWorkOrder(req.params.id);
      if (!order) {
        return res.status(404).json({ success: false, error: '工单不存在' });
      }
      res.json({ success: true, data: order });
    } catch (error) {
      handleError(res, error, 500);
    }
  });

  router.post('/work-orders', withIdempotency, async (req, res) => {
    try {
      const required = ['order_no', 'contract_id', 'asset_name', 'vendor_name', 'created_by'];
      for (const field of required) {
        if (!req.body[field]) {
          return handleError(res, `缺少必填字段: ${field}`);
        }
      }

      const existing = await db.getWorkOrderByNo(req.body.order_no);
      if (existing) {
        return handleError(res, '工单号已存在');
      }

      const contract = await db.getContract(req.body.contract_id);
      if (!contract) {
        return handleError(res, '关联的合同不存在');
      }

      const order = await db.createWorkOrder(req.body);
      res.json({ success: true, data: order });
    } catch (error) {
      handleError(res, error, 500);
    }
  });

  router.patch('/work-orders/:id/status', async (req, res) => {
    try {
      const { status, changed_by, remark } = req.body;
      if (!status) {
        return handleError(res, '缺少状态');
      }
      if (!changed_by) {
        return handleError(res, '缺少操作人');
      }

      const validStatuses = ['pending', 'in_progress', 'completed', 'reviewed', 'exception', 'rejected'];
      if (!validStatuses.includes(status)) {
        return handleError(res, '无效的状态值');
      }

      const order = await db.updateWorkOrderStatus(req.params.id, status, changed_by, remark || '状态变更');
      if (!order) {
        return res.status(404).json({ success: false, error: '工单不存在' });
      }
      res.json({ success: true, data: order });
    } catch (error) {
      handleError(res, error, 500);
    }
  });

  router.put('/work-orders/:id', async (req, res) => {
    try {
      const { modified_by, reason, ...updates } = req.body;
      if (!modified_by) {
        return handleError(res, '缺少修改人');
      }
      if (!reason) {
        return handleError(res, '缺少修改原因');
      }

      const order = await db.updateWorkOrder(req.params.id, updates, modified_by, reason);
      if (!order) {
        return res.status(404).json({ success: false, error: '工单不存在' });
      }
      res.json({ success: true, data: order });
    } catch (error) {
      handleError(res, error, 500);
    }
  });

  router.get('/work-orders/:id/status-history', async (req, res) => {
    try {
      const history = await db.getStatusHistory(req.params.id);
      res.json({ success: true, data: history });
    } catch (error) {
      handleError(res, error, 500);
    }
  });

  router.get('/work-orders/:id/history', async (req, res) => {
    try {
      const history = await db.getWorkOrderHistory(req.params.id);
      res.json({ success: true, data: history });
    } catch (error) {
      handleError(res, error, 500);
    }
  });

  router.get('/work-orders/:id/photos', async (req, res) => {
    try {
      const photos = await db.getArrivalPhotosByWorkOrder(req.params.id);
      res.json({ success: true, data: photos });
    } catch (error) {
      handleError(res, error, 500);
    }
  });

  router.post('/work-orders/:id/photos', withIdempotency, async (req, res) => {
    try {
      const { photo_url, photo_name, uploaded_by } = req.body;
      if (!photo_url) {
        return handleError(res, '缺少照片URL');
      }
      if (!uploaded_by) {
        return handleError(res, '缺少上传人');
      }

      const photo = await db.addArrivalPhoto({
        work_order_id: req.params.id,
        photo_url,
        photo_name,
        uploaded_by
      });
      res.json({ success: true, data: photo });
    } catch (error) {
      handleError(res, error, 500);
    }
  });

  router.put('/photos/:id', async (req, res) => {
    try {
      const { modified_by, reason, ...updates } = req.body;
      if (!modified_by) {
        return handleError(res, '缺少修改人');
      }
      if (!reason) {
        return handleError(res, '缺少修改原因');
      }

      const photo = await db.updateArrivalPhoto(req.params.id, updates, modified_by, reason);
      if (!photo) {
        return res.status(404).json({ success: false, error: '照片记录不存在' });
      }
      res.json({ success: true, data: photo });
    } catch (error) {
      handleError(res, error, 500);
    }
  });

  router.get('/photos/:id/history', async (req, res) => {
    try {
      const history = await db.getArrivalPhotosHistory(req.params.id);
      res.json({ success: true, data: history });
    } catch (error) {
      handleError(res, error, 500);
    }
  });

  router.get('/work-orders/:id/overtime-deductions', async (req, res) => {
    try {
      const deductions = await db.getOvertimeDeductionsByWorkOrder(req.params.id);
      res.json({ success: true, data: deductions });
    } catch (error) {
      handleError(res, error, 500);
    }
  });

  router.post('/work-orders/:id/overtime-deductions', withIdempotency, async (req, res) => {
    try {
      const { overtime_hours, overtime_rate, deduction_amount, deduction_reason, verified_by } = req.body;
      if (!overtime_hours || !deduction_amount) {
        return handleError(res, '缺少必要的扣款信息');
      }

      const deduction = await db.createOvertimeDeduction({
        work_order_id: req.params.id,
        overtime_hours,
        overtime_rate,
        deduction_amount,
        deduction_reason,
        verified_by
      });
      res.json({ success: true, data: deduction });
    } catch (error) {
      handleError(res, error, 500);
    }
  });

  router.get('/evidence-missing', async (req, res) => {
    try {
      const records = await db.getAllEvidenceMissing();
      res.json({ success: true, data: records });
    } catch (error) {
      handleError(res, error, 500);
    }
  });

  router.get('/work-orders/:id/evidence-missing', async (req, res) => {
    try {
      const records = await db.getEvidenceMissingByWorkOrder(req.params.id);
      res.json({ success: true, data: records });
    } catch (error) {
      handleError(res, error, 500);
    }
  });

  router.post('/evidence-missing', withIdempotency, async (req, res) => {
    try {
      const { work_order_id, missing_type, description, severity, responsible_person } = req.body;
      if (!work_order_id || !missing_type || !description) {
        return handleError(res, '缺少必要的证据缺失信息');
      }

      const record = await db.createEvidenceMissing({
        work_order_id,
        missing_type,
        description,
        severity: severity || 'medium',
        responsible_person
      });
      res.json({ success: true, data: record });
    } catch (error) {
      handleError(res, error, 500);
    }
  });

  router.put('/evidence-missing/:id', async (req, res) => {
    try {
      const record = await db.updateEvidenceMissing(req.params.id, req.body);
      if (!record) {
        return res.status(404).json({ success: false, error: '证据缺失记录不存在' });
      }
      res.json({ success: true, data: record });
    } catch (error) {
      handleError(res, error, 500);
    }
  });

  router.get('/rework-relations', async (req, res) => {
    try {
      const relations = await db.getAllReworkRelations();
      res.json({ success: true, data: relations });
    } catch (error) {
      handleError(res, error, 500);
    }
  });

  router.get('/work-orders/:id/rework-relations', async (req, res) => {
    try {
      const relations = await db.getReworkRelationsByWorkOrder(req.params.id);
      res.json({ success: true, data: relations });
    } catch (error) {
      handleError(res, error, 500);
    }
  });

  router.post('/rework-relations', withIdempotency, async (req, res) => {
    try {
      const { original_work_order_id, rework_work_order_id, reason, created_by } = req.body;
      if (!original_work_order_id || !rework_work_order_id) {
        return handleError(res, '缺少关联的工单ID');
      }
      if (!created_by) {
        return handleError(res, '缺少创建人');
      }

      const result = await db.createReworkRelation({
        original_work_order_id,
        rework_work_order_id,
        reason,
        created_by
      });

      if (result.error) {
        return handleError(res, result.error);
      }

      res.json({ success: true, data: result });
    } catch (error) {
      handleError(res, error, 500);
    }
  });

  router.get('/outsourcing-bills', async (req, res) => {
    try {
      const bills = await db.getAllOutsourcingBills();
      res.json({ success: true, data: bills });
    } catch (error) {
      handleError(res, error, 500);
    }
  });

  router.get('/outsourcing-bills/:id', async (req, res) => {
    try {
      const bill = await db.getOutsourcingBill(req.params.id);
      if (!bill) {
        return res.status(404).json({ success: false, error: '账单不存在' });
      }
      res.json({ success: true, data: bill });
    } catch (error) {
      handleError(res, error, 500);
    }
  });

  router.get('/outsourcing-bills/by-no/:billNo', async (req, res) => {
    try {
      const bill = await db.getOutsourcingBillByNo(req.params.billNo);
      if (!bill) {
        return res.status(404).json({ success: false, error: '账单不存在' });
      }
      res.json({ success: true, data: bill });
    } catch (error) {
      handleError(res, error, 500);
    }
  });

  router.post('/outsourcing-bills', withIdempotency, async (req, res) => {
    try {
      const { bill_no, contract_id, work_order_ids, vendor_name, vendor_id, created_by, items } = req.body;
      if (!bill_no || !work_order_ids || !work_order_ids.length) {
        return handleError(res, '缺少必要的账单信息');
      }
      if (!created_by) {
        return handleError(res, '缺少创建人');
      }

      const existing = await db.getOutsourcingBillByNo(bill_no);
      if (existing) {
        return handleError(res, '账单编号已存在');
      }

      let baseTotal = 0;
      let overtimeTotal = 0;
      let deductionTotal = 0;
      const billItems = [];

      for (const orderId of work_order_ids) {
        const order = await db.getWorkOrder(orderId);
        if (order) {
          baseTotal += order.base_amount || 0;
          overtimeTotal += order.overtime_amount || 0;
          deductionTotal += order.deduction_amount || 0;
          billItems.push({
            work_order_id: orderId,
            base_amount: order.base_amount || 0,
            overtime_amount: order.overtime_amount || 0,
            deduction_amount: order.deduction_amount || 0,
            total_amount: (order.base_amount || 0) + (order.overtime_amount || 0) - (order.deduction_amount || 0)
          });
        }
      }

      const bill = await db.createOutsourcingBill({
        bill_no,
        contract_id,
        work_order_ids,
        vendor_name,
        vendor_id,
        base_total: baseTotal,
        overtime_total: overtimeTotal,
        deduction_total: deductionTotal,
        final_amount: baseTotal + overtimeTotal - deductionTotal,
        created_by,
        items: billItems
      });

      res.json({ success: true, data: bill });
    } catch (error) {
      handleError(res, error, 500);
    }
  });

  router.get('/export/work-orders', async (req, res) => {
    try {
      const { responsible_person, start_date, end_date } = req.query;
      const orders = await db.getWorkOrdersForExport({
        responsible_person,
        start_date,
        end_date
      });
      res.json({ success: true, data: orders });
    } catch (error) {
      handleError(res, error, 500);
    }
  });

  return router;
};
