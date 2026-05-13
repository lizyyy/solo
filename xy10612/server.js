const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

let prescriptions = [];
let reviewHistory = [];

const initialPrescriptions = [
  {
    id: 'RX001',
    patientName: '张三',
    patientIdCard: '110101199001011234',
    doctor: '李医生',
    pharmacist: null,
    drugs: ['阿莫西林', '布洛芬'],
    attachment: 'prescription_001.pdf',
    attachmentVersion: 1,
    status: 'pending_review',
    salesLocked: false,
    refundReview: false,
    desensitized: false,
    exported: false,
    createdAt: '2024-01-15T09:00:00',
    reviewedAt: null,
    lockedAt: null,
    refundAt: null,
    desensitizedAt: null,
    exportedAt: null,
    handler: null,
    previousValues: {}
  },
  {
    id: 'RX002',
    patientName: '李四',
    patientIdCard: '310101198505055678',
    doctor: '王医生',
    pharmacist: '赵药师',
    drugs: ['头孢克肟', '氨溴索'],
    attachment: 'prescription_002_v2.pdf',
    attachmentVersion: 2,
    status: 'reviewed',
    salesLocked: true,
    refundReview: false,
    desensitized: false,
    exported: false,
    createdAt: '2024-01-14T14:30:00',
    reviewedAt: '2024-01-14T15:00:00',
    lockedAt: '2024-01-14T15:30:00',
    refundAt: null,
    desensitizedAt: null,
    exportedAt: null,
    handler: '赵药师',
    previousValues: {
      attachment: ['prescription_002.pdf', 'prescription_002_v2.pdf'],
      attachmentVersion: [1, 2]
    }
  },
  {
    id: 'RX003',
    patientName: '王五',
    patientIdCard: '440101197808089012',
    doctor: '张医生',
    pharmacist: '孙药师',
    drugs: ['奥美拉唑', '多潘立酮'],
    attachment: 'prescription_003.pdf',
    attachmentVersion: 1,
    status: 'refund_pending',
    salesLocked: true,
    refundReview: true,
    desensitized: false,
    exported: false,
    createdAt: '2024-01-13T10:00:00',
    reviewedAt: '2024-01-13T11:00:00',
    lockedAt: '2024-01-13T11:30:00',
    refundAt: '2024-01-15T08:00:00',
    desensitizedAt: null,
    exportedAt: null,
    handler: '孙药师',
    previousValues: {}
  },
  {
    id: 'RX004',
    patientName: '赵六',
    patientIdCard: '510101199212123456',
    doctor: '刘医生',
    pharmacist: '周药师',
    drugs: ['二甲双胍', '格列美脲'],
    attachment: 'prescription_004.pdf',
    attachmentVersion: 1,
    status: 'archived',
    salesLocked: true,
    refundReview: true,
    desensitized: true,
    exported: true,
    createdAt: '2024-01-10T08:00:00',
    reviewedAt: '2024-01-10T09:00:00',
    lockedAt: '2024-01-10T09:30:00',
    refundAt: '2024-01-11T10:00:00',
    desensitizedAt: '2024-01-12T14:00:00',
    exportedAt: '2024-01-12T16:00:00',
    handler: '周药师',
    previousValues: {}
  },
  {
    id: 'RX005',
    patientName: '钱七',
    patientIdCard: '330101198003037890',
    doctor: '陈医生',
    pharmacist: '吴药师',
    drugs: ['氯雷他定', '糠酸莫米松'],
    attachment: 'prescription_005_v3.pdf',
    attachmentVersion: 3,
    status: 'reviewed',
    salesLocked: true,
    refundReview: false,
    desensitized: true,
    exported: false,
    createdAt: '2024-01-12T11:00:00',
    reviewedAt: '2024-01-12T12:00:00',
    lockedAt: '2024-01-12T12:30:00',
    refundAt: null,
    desensitizedAt: '2024-01-14T09:00:00',
    exportedAt: null,
    handler: '吴药师',
    previousValues: {
      attachment: ['prescription_005.pdf', 'prescription_005_v2.pdf', 'prescription_005_v3.pdf'],
      attachmentVersion: [1, 2, 3],
      desensitized: [false, true],
      desensitizedAt: [null, '2024-01-14T09:00:00']
    }
  }
];

function initData() {
  prescriptions = JSON.parse(JSON.stringify(initialPrescriptions));
  reviewHistory = [];
}

initData();

app.get('/api/prescriptions', (req, res) => {
  const { status, handler, startDate, endDate, keyword } = req.query;
  let result = [...prescriptions];
  
  if (status) {
    result = result.filter(p => p.status === status);
  }
  if (handler) {
    result = result.filter(p => p.handler && p.handler.includes(handler));
  }
  if (startDate) {
    result = result.filter(p => p.createdAt >= startDate);
  }
  if (endDate) {
    result = result.filter(p => p.createdAt <= endDate + 'T23:59:59');
  }
  if (keyword) {
    const kw = keyword.toLowerCase();
    result = result.filter(p => 
      p.id.toLowerCase().includes(kw) ||
      p.patientName.includes(kw) ||
      p.doctor.includes(kw)
    );
  }
  
  res.json({ success: true, data: result });
});

app.get('/api/prescriptions/:id', (req, res) => {
  const prescription = prescriptions.find(p => p.id === req.params.id);
  if (!prescription) {
    return res.status(404).json({ success: false, message: '处方不存在' });
  }
  res.json({ success: true, data: prescription });
});

app.post('/api/prescriptions/:id/review', (req, res) => {
  const { pharmacist, approved } = req.body;
  const prescription = prescriptions.find(p => p.id === req.params.id);
  
  if (!prescription) {
    return res.status(404).json({ success: false, message: '处方不存在' });
  }
  
  if (prescription.status !== 'pending_review') {
    return res.status(400).json({ success: false, message: '处方状态不允许复核' });
  }
  
  if (!pharmacist) {
    return res.status(400).json({ success: false, message: '药师信息不能为空' });
  }
  
  const previousStatus = prescription.status;
  const previousPharmacist = prescription.pharmacist;
  const previousReviewedAt = prescription.reviewedAt;
  const previousHandler = prescription.handler;
  
  prescription.pharmacist = pharmacist;
  prescription.reviewedAt = new Date().toISOString();
  prescription.handler = pharmacist;
  
  if (approved) {
    prescription.status = 'reviewed';
  } else {
    prescription.status = 'rejected';
  }
  
  prescription.previousValues.status = [...(prescription.previousValues.status || []), previousStatus];
  prescription.previousValues.pharmacist = [...(prescription.previousValues.pharmacist || []), previousPharmacist];
  prescription.previousValues.reviewedAt = [...(prescription.previousValues.reviewedAt || []), previousReviewedAt];
  prescription.previousValues.handler = [...(prescription.previousValues.handler || []), previousHandler];
  
  reviewHistory.push({
    prescriptionId: prescription.id,
    action: 'review',
    pharmacist,
    approved,
    timestamp: new Date().toISOString()
  });
  
  res.json({ success: true, data: prescription });
});

app.post('/api/prescriptions/:id/lock', (req, res) => {
  const prescription = prescriptions.find(p => p.id === req.params.id);
  
  if (!prescription) {
    return res.status(404).json({ success: false, message: '处方不存在' });
  }
  
  if (prescription.status !== 'reviewed') {
    return res.status(400).json({ success: false, message: '只有已复核的处方才能锁定销售' });
  }
  
  if (prescription.salesLocked) {
    return res.json({ success: true, data: prescription, message: '销售已锁定' });
  }
  
  const previousLocked = prescription.salesLocked;
  const previousLockedAt = prescription.lockedAt;
  
  prescription.salesLocked = true;
  prescription.lockedAt = new Date().toISOString();
  
  prescription.previousValues.salesLocked = [...(prescription.previousValues.salesLocked || []), previousLocked];
  prescription.previousValues.lockedAt = [...(prescription.previousValues.lockedAt || []), previousLockedAt];
  
  res.json({ success: true, data: prescription });
});

app.post('/api/prescriptions/:id/refund', (req, res) => {
  const prescription = prescriptions.find(p => p.id === req.params.id);
  
  if (!prescription) {
    return res.status(404).json({ success: false, message: '处方不存在' });
  }
  
  if (!prescription.salesLocked) {
    return res.status(400).json({ success: false, message: '请先锁定销售' });
  }
  
  if (prescription.status === 'refund_pending' || prescription.status === 'archived') {
    return res.json({ success: true, data: prescription, message: '退药审核已在进行中或已完成' });
  }
  
  const previousStatus = prescription.status;
  const previousRefund = prescription.refundReview;
  const previousRefundAt = prescription.refundAt;
  
  prescription.refundReview = true;
  prescription.refundAt = new Date().toISOString();
  prescription.status = 'refund_pending';
  
  prescription.previousValues.status = [...(prescription.previousValues.status || []), previousStatus];
  prescription.previousValues.refundReview = [...(prescription.previousValues.refundReview || []), previousRefund];
  prescription.previousValues.refundAt = [...(prescription.previousValues.refundAt || []), previousRefundAt];
  
  res.json({ success: true, data: prescription });
});

app.post('/api/prescriptions/:id/desensitize', (req, res) => {
  const prescription = prescriptions.find(p => p.id === req.params.id);
  
  if (!prescription) {
    return res.status(404).json({ success: false, message: '处方不存在' });
  }
  
  if (!prescription.refundReview) {
    return res.status(400).json({ success: false, message: '请先完成退药审核' });
  }
  
  if (prescription.desensitized) {
    return res.json({ success: true, data: prescription, message: '已脱敏归档' });
  }
  
  const previousDesensitized = prescription.desensitized;
  const previousDesensitizedAt = prescription.desensitizedAt;
  const previousStatus = prescription.status;
  
  prescription.desensitized = true;
  prescription.desensitizedAt = new Date().toISOString();
  prescription.status = 'archived';
  
  prescription.previousValues.desensitized = [...(prescription.previousValues.desensitized || []), previousDesensitized];
  prescription.previousValues.desensitizedAt = [...(prescription.previousValues.desensitizedAt || []), previousDesensitizedAt];
  prescription.previousValues.status = [...(prescription.previousValues.status || []), previousStatus];
  
  res.json({ success: true, data: prescription });
});

app.post('/api/prescriptions/:id/export', (req, res) => {
  const prescription = prescriptions.find(p => p.id === req.params.id);
  
  if (!prescription) {
    return res.status(404).json({ success: false, message: '处方不存在' });
  }
  
  if (!prescription.desensitized) {
    return res.status(400).json({ success: false, message: '请先完成脱敏归档' });
  }
  
  const previousExported = prescription.exported;
  const previousExportedAt = prescription.exportedAt;
  
  prescription.exported = true;
  prescription.exportedAt = new Date().toISOString();
  
  prescription.previousValues.exported = [...(prescription.previousValues.exported || []), previousExported];
  prescription.previousValues.exportedAt = [...(prescription.previousValues.exportedAt || []), previousExportedAt];
  
  res.json({ success: true, data: prescription });
});

app.put('/api/prescriptions/:id/attachment', (req, res) => {
  const { attachment } = req.body;
  const prescription = prescriptions.find(p => p.id === req.params.id);
  
  if (!prescription) {
    return res.status(404).json({ success: false, message: '处方不存在' });
  }
  
  if (!attachment) {
    return res.status(400).json({ success: false, message: '附件信息不能为空' });
  }
  
  const previousAttachment = prescription.attachment;
  const previousVersion = prescription.attachmentVersion;
  
  prescription.attachment = attachment;
  prescription.attachmentVersion += 1;
  
  if (!prescription.previousValues.attachment) {
    prescription.previousValues.attachment = [];
  }
  if (!prescription.previousValues.attachmentVersion) {
    prescription.previousValues.attachmentVersion = [];
  }
  prescription.previousValues.attachment.push(previousAttachment);
  prescription.previousValues.attachmentVersion.push(previousVersion);
  
  res.json({ success: true, data: prescription });
});

app.get('/api/stats', (req, res) => {
  const stats = {
    total: prescriptions.length,
    pendingReview: prescriptions.filter(p => p.status === 'pending_review').length,
    reviewed: prescriptions.filter(p => p.status === 'reviewed').length,
    refundPending: prescriptions.filter(p => p.status === 'refund_pending').length,
    archived: prescriptions.filter(p => p.status === 'archived').length,
    salesLocked: prescriptions.filter(p => p.salesLocked).length,
    desensitized: prescriptions.filter(p => p.desensitized).length,
    exported: prescriptions.filter(p => p.exported).length
  };
  res.json({ success: true, data: stats });
});

app.get('/api/export', (req, res) => {
  const { handler, startDate, endDate } = req.query;
  let result = [...prescriptions];
  
  if (handler) {
    result = result.filter(p => p.handler && p.handler.includes(handler));
  }
  if (startDate) {
    result = result.filter(p => {
      const processDate = p.exportedAt || p.desensitizedAt || p.refundAt || p.lockedAt || p.reviewedAt || p.createdAt;
      return processDate >= startDate;
    });
  }
  if (endDate) {
    result = result.filter(p => {
      const processDate = p.exportedAt || p.desensitizedAt || p.refundAt || p.lockedAt || p.reviewedAt || p.createdAt;
      return processDate <= endDate + 'T23:59:59';
    });
  }
  
  const exportData = result.map(p => ({
    处方编号: p.id,
    患者姓名: p.patientName,
    身份证号: p.patientIdCard,
    医生: p.doctor,
    药师: p.pharmacist || '-',
    药品: p.drugs.join(', '),
    附件: p.attachment,
    附件版本: p.attachmentVersion,
    状态: p.status,
    销售锁定: p.salesLocked ? '是' : '否',
    退药审核: p.refundReview ? '是' : '否',
    脱敏归档: p.desensitized ? '是' : '否',
    监管导出: p.exported ? '是' : '否',
    创建时间: p.createdAt,
    复核时间: p.reviewedAt || '-',
    锁定时间: p.lockedAt || '-',
    退药时间: p.refundAt || '-',
    脱敏时间: p.desensitizedAt || '-',
    导出时间: p.exportedAt || '-',
    责任人: p.handler || '-',
    修改记录: JSON.stringify(p.previousValues)
  }));
  
  res.json({ success: true, data: exportData });
});

app.post('/api/reset', (req, res) => {
  initData();
  res.json({ success: true, message: '数据已重置' });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
