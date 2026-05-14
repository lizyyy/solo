import express from 'express';
import StateMachineService from '../services/StateMachineService';
import AfterSalesOrderModel from '../models/AfterSalesOrder';
import XLSX from 'xlsx';

const router = express.Router();

router.post('/orders', async (req, res) => {
  try {
    const result = await StateMachineService.createOrder(req.body);
    res.json({
      success: true,
      data: result.order,
      isNew: result.isNew,
      message: result.isNew ? '创建成功' : '幂等返回已有数据',
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get('/orders', async (req, res) => {
  try {
    const orders = await AfterSalesOrderModel.findAll({
      order: [['createdAt', 'DESC']],
    });
    res.json({ success: true, data: orders });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get('/orders/:id', async (req, res) => {
  try {
    const detail = await StateMachineService.getOrderDetail(req.params.id);
    res.json({ success: true, data: detail });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post('/orders/:id/start-qa', async (req, res) => {
  try {
    const { inspectorId, inspectorName } = req.body;
    const order = await StateMachineService.startQa(req.params.id, inspectorId, inspectorName);
    res.json({ success: true, data: order, message: '质检开始' });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post('/orders/:id/submit-qa', async (req, res) => {
  try {
    const order = await StateMachineService.submitQaResult(req.params.id, req.body);
    res.json({ success: true, data: order, message: '质检结果已提交' });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post('/orders/:id/start-refund', async (req, res) => {
  try {
    const { method, operator } = req.body;
    const order = await StateMachineService.startRefund(req.params.id, method, operator);
    res.json({ success: true, data: order, message: '退款已开始' });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post('/orders/:id/process-refund', async (req, res) => {
  try {
    const { success, transactionId, errorMessage } = req.body;
    const order = await StateMachineService.processRefund(req.params.id, success, transactionId, errorMessage);
    res.json({ success: true, data: order, message: success ? '退款成功' : '退款失败' });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post('/orders/:id/start-compensation', async (req, res) => {
  try {
    const { operator } = req.body;
    const order = await StateMachineService.startCompensation(req.params.id, operator);
    res.json({ success: true, data: order, message: '补偿券发放已开始' });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post('/orders/:id/process-compensation', async (req, res) => {
  try {
    const { success, errorMessage } = req.body;
    const order = await StateMachineService.processCompensation(req.params.id, success, errorMessage);
    res.json({ success: true, data: order, message: success ? '补偿券发放成功' : '补偿券发放失败' });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post('/orders/:id/correct-compensation', async (req, res) => {
  try {
    const order = await StateMachineService.correctCompensation(req.params.id, req.body);
    res.json({ success: true, data: order, message: '补偿券修正成功' });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post('/orders/:id/review', async (req, res) => {
  try {
    const order = await StateMachineService.reviewRejectReason(req.params.id, req.body);
    res.json({ success: true, data: order, message: '复核完成' });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post('/orders/:id/close', async (req, res) => {
  try {
    const { operator } = req.body;
    const order = await StateMachineService.closeOrder(req.params.id, operator);
    res.json({ success: true, data: order, message: '订单已关闭' });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post('/orders/:id/recalculate', async (req, res) => {
  try {
    const order = await StateMachineService.recalculateAfterQaChange(req.params.id);
    res.json({ success: true, data: order, message: '重新计算完成' });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get('/statistics', async (req, res) => {
  try {
    const stats = await StateMachineService.getStatistics();
    res.json({ success: true, data: stats });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get('/ledger/export', async (req, res) => {
  try {
    const ledger = await StateMachineService.exportLedger();
    const data = ledger.map(item => ({
      '售后单号': item.orderNo,
      '操作类型': item.type,
      '金额': item.amount,
      '状态': item.status,
      '操作人': item.operator,
      '操作时间': item.operationTime,
      '备注': item.remarks,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '售后账本');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="after-sales-ledger.xlsx"');
    res.send(buffer);
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

export default router;