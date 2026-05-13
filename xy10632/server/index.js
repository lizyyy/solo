const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const ExcelJS = require('exceljs');
const path = require('path');
const dataStore = require('./data');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../public')));

const getIdFromRequest = (req) => req.headers['x-handler'] || '未知用户';

app.get('/api/overview', (req, res) => {
  const stats = {
    totalWarrantyChecks: dataStore.warrantyChecks.length,
    totalInspectionReports: dataStore.inspectionReports.length,
    totalLoanerDevices: dataStore.loanerDevices.length,
    activeLoaners: dataStore.loanerDevices.filter(l => l.loanStatus === '借用中').length,
    pendingApprovals: dataStore.replacementApprovals.filter(a => a.approvalStatus === '待审批').length,
    pendingRecoveries: dataStore.oldDeviceRecoveries.filter(r => r.recoveryStatus === '待回收').length,
    totalCosts: dataStore.afterSalesCosts.reduce((sum, c) => sum + c.amount, 0),
    warrantyPassRate: Math.round((dataStore.warrantyChecks.filter(w => w.checkResult === '通过').length / dataStore.warrantyChecks.length) * 100)
  };
  res.json({ success: true, data: stats });
});

app.get('/api/warranty-checks', (req, res) => {
  const { orderNo, handler, status } = req.query;
  let result = [...dataStore.warrantyChecks];
  
  if (orderNo) result = result.filter(w => w.orderNo.includes(orderNo));
  if (handler) result = result.filter(w => w.handler === handler);
  if (status) result = result.filter(w => w.checkResult === status);
  
  res.json({ success: true, data: result });
});

app.get('/api/inspection-reports', (req, res) => {
  const { orderNo, status, inspector } = req.query;
  let result = [...dataStore.inspectionReports];
  
  if (orderNo) result = result.filter(r => r.orderNo.includes(orderNo));
  if (status) result = result.filter(r => r.status === status);
  if (inspector) result = result.filter(r => r.inspector === inspector);
  
  res.json({ success: true, data: result });
});

app.post('/api/inspection-reports/:id/verify', (req, res) => {
  const { id } = req.params;
  const { status, comments } = req.body;
  const handler = getIdFromRequest(req);
  
  if (!['已通过', '已拒绝'].includes(status)) {
    return res.json({ success: false, message: '状态只能是"已通过"或"已拒绝"' });
  }
  
  const report = dataStore.inspectionReports.find(r => r.id === id);
  if (!report) {
    return res.json({ success: false, message: '检测报告不存在' });
  }
  
  if (report.status !== '待审核') {
    return res.json({ success: false, message: '该报告已审核，不可重复操作' });
  }
  
  const updated = dataStore.updateInspectionReport(id, {
    status,
    verificationComments: comments || '',
    verifier: handler,
    verificationTime: new Date().toISOString()
  }, handler);
  
  res.json({ success: true, data: updated });
});

app.get('/api/loaner-devices', (req, res) => {
  const { orderNo, status, handler } = req.query;
  let result = [...dataStore.loanerDevices];
  
  if (orderNo) result = result.filter(l => l.orderNo.includes(orderNo));
  if (status) result = result.filter(l => l.loanStatus === status);
  if (handler) result = result.filter(l => l.handler === handler);
  
  res.json({ success: true, data: result });
});

app.get('/api/replacement-approvals', (req, res) => {
  const { orderNo, status, applicant } = req.query;
  let result = [...dataStore.replacementApprovals];
  
  if (orderNo) result = result.filter(a => a.orderNo.includes(orderNo));
  if (status) result = result.filter(a => a.approvalStatus === status);
  if (applicant) result = result.filter(a => a.applicant === applicant);
  
  res.json({ success: true, data: result });
});

app.post('/api/replacement-approvals/:id/advance', (req, res) => {
  const { id } = req.params;
  const { status, comments } = req.body;
  const handler = getIdFromRequest(req);
  
  if (!['已通过', '已拒绝'].includes(status)) {
    return res.json({ success: false, message: '审批状态只能是"已通过"或"已拒绝"' });
  }
  
  const approval = dataStore.replacementApprovals.find(a => a.id === id);
  if (!approval) {
    return res.json({ success: false, message: '换新审批不存在' });
  }
  
  if (approval.approvalStatus !== '待审批') {
    return res.json({ success: false, message: '该审批已完成，不可重复操作' });
  }
  
  const inspectionReport = dataStore.inspectionReports.find(r => r.orderNo === approval.orderNo);
  if (!inspectionReport || inspectionReport.status !== '已通过') {
    return res.json({ success: false, message: '关联的检测报告未通过审核，无法推进审批' });
  }
  
  const updatedIndex = dataStore.replacementApprovals.findIndex(a => a.id === id);
  const oldValue = JSON.parse(JSON.stringify(dataStore.replacementApprovals[updatedIndex]));
  const newValue = {
    ...dataStore.replacementApprovals[updatedIndex],
    approvalStatus: status,
    approvalComments: comments || '',
    approver: handler,
    approvalTime: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  dataStore.replacementApprovals[updatedIndex] = newValue;
  dataStore.recordModification('replacementApproval', id, oldValue, newValue, handler);
  
  res.json({ success: true, data: newValue });
});

app.get('/api/old-device-recoveries', (req, res) => {
  const { orderNo, status, handler } = req.query;
  let result = [...dataStore.oldDeviceRecoveries];
  
  if (orderNo) result = result.filter(r => r.orderNo.includes(orderNo));
  if (status) result = result.filter(r => r.recoveryStatus === status);
  if (handler) result = result.filter(r => r.handler === handler);
  
  res.json({ success: true, data: result });
});

app.post('/api/old-device-recoveries/:id/save', (req, res) => {
  const { id } = req.params;
  const updateData = req.body;
  const handler = getIdFromRequest(req);
  
  const recovery = dataStore.oldDeviceRecoveries.find(r => r.id === id);
  if (!recovery) {
    return res.json({ success: false, message: '旧机回收记录不存在' });
  }
  
  const updatedIndex = dataStore.oldDeviceRecoveries.findIndex(r => r.id === id);
  const oldValue = JSON.parse(JSON.stringify(dataStore.oldDeviceRecoveries[updatedIndex]));
  const newValue = {
    ...dataStore.oldDeviceRecoveries[updatedIndex],
    ...updateData,
    updatedAt: new Date().toISOString()
  };
  dataStore.oldDeviceRecoveries[updatedIndex] = newValue;
  dataStore.recordModification('oldDeviceRecovery', id, oldValue, newValue, handler);
  
  res.json({ success: true, data: newValue });
});

app.get('/api/after-sales-costs', (req, res) => {
  const { orderNo, costType, handler } = req.query;
  let result = [...dataStore.afterSalesCosts];
  
  if (orderNo) result = result.filter(c => c.orderNo.includes(orderNo));
  if (costType) result = result.filter(c => c.costType === costType);
  if (handler) result = result.filter(c => c.handler === handler);
  
  res.json({ success: true, data: result });
});

app.get('/api/modification-history/:type/:recordId', (req, res) => {
  const { type, recordId } = req.params;
  const history = dataStore.getModificationHistory(type, recordId);
  res.json({ success: true, data: history });
});

app.get('/api/export-report', async (req, res) => {
  const { handler, startTime, endTime, type } = req.query;
  
  let data = [];
  let columns = [];
  let fileName = '';
  
  switch (type) {
    case 'warranty':
      data = dataStore.warrantyChecks;
      fileName = '保修校验记录.xlsx';
      columns = [
        { header: '工单号', key: 'orderNo', width: 15 },
        { header: '客户姓名', key: 'customerName', width: 12 },
        { header: '设备型号', key: 'deviceModel', width: 15 },
        { header: '序列号', key: 'serialNo', width: 20 },
        { header: '保修状态', key: 'warrantyStatus', width: 10 },
        { header: '校验结果', key: 'checkResult', width: 12 },
        { header: '处理人', key: 'handler', width: 10 },
        { header: '校验时间', key: 'checkTime', width: 25 }
      ];
      break;
    case 'inspection':
      data = dataStore.inspectionReports;
      fileName = '检测报告记录.xlsx';
      columns = [
        { header: '工单号', key: 'orderNo', width: 15 },
        { header: '设备型号', key: 'deviceModel', width: 15 },
        { header: '故障描述', key: 'faultDescription', width: 20 },
        { header: '维修建议', key: 'repairSuggestion', width: 15 },
        { header: '预估费用', key: 'estimatedCost', width: 12 },
        { header: '状态', key: 'status', width: 10 },
        { header: '检测员', key: 'inspector', width: 10 },
        { header: '检测时间', key: 'inspectionTime', width: 25 }
      ];
      break;
    case 'loaner':
      data = dataStore.loanerDevices;
      fileName = '备机借用记录.xlsx';
      columns = [
        { header: '工单号', key: 'orderNo', width: 15 },
        { header: '借用人', key: 'borrower', width: 12 },
        { header: '备机型号', key: 'loanerDeviceModel', width: 15 },
        { header: '借出日期', key: 'loanDate', width: 25 },
        { header: '预计归还', key: 'expectedReturnDate', width: 25 },
        { header: '实际归还', key: 'actualReturnDate', width: 25 },
        { header: '状态', key: 'loanStatus', width: 10 },
        { header: '处理人', key: 'handler', width: 10 }
      ];
      break;
    case 'all':
    default:
      fileName = '售后综合报表.xlsx';
      const workbook = new ExcelJS.Workbook();
      
      const warrantySheet = workbook.addWorksheet('保修校验');
      warrantySheet.columns = [
        { header: '工单号', key: 'orderNo', width: 15 },
        { header: '客户姓名', key: 'customerName', width: 12 },
        { header: '设备型号', key: 'deviceModel', width: 15 },
        { header: '保修状态', key: 'warrantyStatus', width: 10 },
        { header: '校验结果', key: 'checkResult', width: 12 },
        { header: '处理人', key: 'handler', width: 10 },
        { header: '校验时间', key: 'checkTime', width: 25 }
      ];
      
      let warrantyData = dataStore.warrantyChecks;
      if (handler) warrantyData = warrantyData.filter(w => w.handler === handler);
      if (startTime) warrantyData = warrantyData.filter(w => new Date(w.checkTime) >= new Date(startTime));
      if (endTime) warrantyData = warrantyData.filter(w => new Date(w.checkTime) <= new Date(endTime));
      warrantySheet.addRows(warrantyData);
      
      const inspectionSheet = workbook.addWorksheet('检测报告');
      inspectionSheet.columns = [
        { header: '工单号', key: 'orderNo', width: 15 },
        { header: '设备型号', key: 'deviceModel', width: 15 },
        { header: '故障描述', key: 'faultDescription', width: 20 },
        { header: '维修建议', key: 'repairSuggestion', width: 15 },
        { header: '状态', key: 'status', width: 10 },
        { header: '检测员', key: 'inspector', width: 10 },
        { header: '检测时间', key: 'inspectionTime', width: 25 }
      ];
      
      let inspectionData = dataStore.inspectionReports;
      if (handler) inspectionData = inspectionData.filter(r => r.inspector === handler);
      if (startTime) inspectionData = inspectionData.filter(r => new Date(r.inspectionTime) >= new Date(startTime));
      if (endTime) inspectionData = inspectionData.filter(r => new Date(r.inspectionTime) <= new Date(endTime));
      inspectionSheet.addRows(inspectionData);
      
      const loanerSheet = workbook.addWorksheet('备机借用');
      loanerSheet.columns = [
        { header: '工单号', key: 'orderNo', width: 15 },
        { header: '借用人', key: 'borrower', width: 12 },
        { header: '备机型号', key: 'loanerDeviceModel', width: 15 },
        { header: '借出日期', key: 'loanDate', width: 25 },
        { header: '状态', key: 'loanStatus', width: 10 },
        { header: '处理人', key: 'handler', width: 10 }
      ];
      
      let loanerData = dataStore.loanerDevices;
      if (handler) loanerData = loanerData.filter(l => l.handler === handler);
      if (startTime) loanerData = loanerData.filter(l => new Date(l.loanDate) >= new Date(startTime));
      if (endTime) loanerData = loanerData.filter(l => new Date(l.loanDate) <= new Date(endTime));
      loanerSheet.addRows(loanerData);
      
      const approvalSheet = workbook.addWorksheet('换新审批');
      approvalSheet.columns = [
        { header: '工单号', key: 'orderNo', width: 15 },
        { header: '设备型号', key: 'deviceModel', width: 15 },
        { header: '换新原因', key: 'replacementReason', width: 15 },
        { header: '审批状态', key: 'approvalStatus', width: 10 },
        { header: '申请人', key: 'applicant', width: 10 },
        { header: '审批人', key: 'approver', width: 10 },
        { header: '申请时间', key: 'applicationTime', width: 25 }
      ];
      approvalSheet.addRows(dataStore.replacementApprovals);
      
      const recoverySheet = workbook.addWorksheet('旧机回收');
      recoverySheet.columns = [
        { header: '工单号', key: 'orderNo', width: 15 },
        { header: '设备型号', key: 'deviceModel', width: 15 },
        { header: '回收状态', key: 'recoveryStatus', width: 10 },
        { header: '回收方式', key: 'recoveryMethod', width: 12 },
        { header: '收货人', key: 'receiver', width: 10 },
        { header: '处理人', key: 'handler', width: 10 }
      ];
      recoverySheet.addRows(dataStore.oldDeviceRecoveries);
      
      const costSheet = workbook.addWorksheet('售后成本');
      costSheet.columns = [
        { header: '工单号', key: 'orderNo', width: 15 },
        { header: '费用类型', key: 'costType', width: 12 },
        { header: '金额', key: 'amount', width: 10 },
        { header: '费用说明', key: 'costDescription', width: 20 },
        { header: '承担方', key: 'costBearer', width: 10 },
        { header: '结算状态', key: 'settlementStatus', width: 10 },
        { header: '处理人', key: 'handler', width: 10 }
      ];
      costSheet.addRows(dataStore.afterSalesCosts);
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=${encodeURIComponent(fileName)}`);
      
      await workbook.xlsx.write(res);
      return;
  }
  
  if (handler) data = data.filter(item => item.handler === handler);
  if (startTime && data[0]?.checkTime) data = data.filter(item => new Date(item.checkTime) >= new Date(startTime));
  if (endTime && data[0]?.checkTime) data = data.filter(item => new Date(item.checkTime) <= new Date(endTime));
  
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('数据');
  sheet.columns = columns;
  sheet.addRows(data);
  
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=${encodeURIComponent(fileName)}`);
  
  await workbook.xlsx.write(res);
});

app.get('/api/handlers', (req, res) => {
  const handlers = new Set();
  dataStore.warrantyChecks.forEach(w => handlers.add(w.handler));
  dataStore.inspectionReports.forEach(r => handlers.add(r.inspector));
  dataStore.loanerDevices.forEach(l => handlers.add(l.handler));
  res.json({ success: true, data: Array.from(handlers) });
});

app.get('/api/order-detail/:orderNo', (req, res) => {
  const { orderNo } = req.params;
  const detail = {
    orderNo,
    warrantyCheck: dataStore.warrantyChecks.find(w => w.orderNo === orderNo),
    inspectionReport: dataStore.inspectionReports.find(r => r.orderNo === orderNo),
    loanerDevice: dataStore.loanerDevices.find(l => l.orderNo === orderNo),
    replacementApproval: dataStore.replacementApprovals.find(a => a.orderNo === orderNo),
    oldDeviceRecovery: dataStore.oldDeviceRecoveries.find(r => r.orderNo === orderNo),
    afterSalesCosts: dataStore.afterSalesCosts.filter(c => c.orderNo === orderNo)
  };
  res.json({ success: true, data: detail });
});

app.listen(PORT, () => {
  console.log(`售后换新备机回收管理系统已启动: http://localhost:${PORT}`);
});
