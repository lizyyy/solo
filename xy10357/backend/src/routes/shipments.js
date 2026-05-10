const express = require('express');
const { PrismaClient } = require('@prisma/client');
const router = express.Router();
const prisma = new PrismaClient();
const { createAuditRecord } = require('../utils/audit');
const { validateShipmentCreation, validateShipmentClosure } = require('../utils/compliance');

const generateShipmentNumber = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `SP-${year}${month}${day}-${random}`;
};

router.get('/', async (req, res) => {
  try {
    const { status, statusGroup, batchId, institutionId, applicant } = req.query;
    const where = {};

    if (status) where.status = status;
    if (statusGroup) {
      const statusMap = {
        pending: ['PENDING'],
        approved: ['APPROVED', 'SHIPPED', 'DELIVERED', 'DESTROYED'],
        rejected: ['REJECTED', 'CLOSED']
      };
      where.status = { in: statusMap[statusGroup] || [] };
    }
    if (batchId) where.batchId = batchId;
    if (institutionId) where.institutionId = institutionId;
    if (applicant) where.applicant = { contains: applicant };

    const shipments = await prisma.shipment.findMany({
      where,
      include: {
        batch: true,
        institution: true,
        recipient: true,
        tempRecords: true,
        destruction: true
      },
      orderBy: { applicationDate: 'desc' }
    });

    res.json(shipments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { batchId, institutionId, recipientId, applicant, purpose, remark } = req.body;

    const validation = await validateShipmentCreation({
      batchId,
      institutionId,
      recipientId
    });

    if (!validation.valid) {
      return res.status(400).json({
        error: '合规校验失败',
        details: validation.errors
      });
    }

    const shipment = await prisma.shipment.create({
      data: {
        shipmentNumber: generateShipmentNumber(),
        batchId,
        institutionId,
        recipientId,
        applicant: applicant || '系统管理员',
        applicationDate: new Date(),
        status: 'PENDING',
        purpose,
        remark
      },
      include: {
        batch: true,
        institution: true,
        recipient: true
      }
    });

    await createAuditRecord({
      shipmentId: shipment.id,
      batchId,
      recipientId,
      action: 'CREATE',
      operator: req.headers['x-operator'] || '系统管理员',
      description: `创建寄送申请: ${shipment.shipmentNumber}`,
      afterSnapshot: shipment
    });

    res.status(201).json(shipment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const { operator, remark } = req.body;

    const oldShipment = await prisma.shipment.findUnique({
      where: { id },
      include: { batch: true, recipient: true }
    });

    if (!oldShipment) {
      return res.status(404).json({ error: '寄送申请不存在' });
    }

    if (oldShipment.status !== 'PENDING') {
      return res.status(400).json({ error: '只有待处理状态的申请可以审批' });
    }

    const recipientValidation = await prisma.recipient.findUnique({
      where: { id: oldShipment.recipientId }
    });

    const today = new Date();
    if (!recipientValidation.isActive || new Date(recipientValidation.expiryDate) <= today) {
      return res.status(400).json({
        error: '合规校验失败',
        details: ['接收人资质已过期或已禁用']
      });
    }

    const shipment = await prisma.shipment.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedBy: operator || '系统管理员',
        approvedAt: new Date(),
        remark: remark || oldShipment.remark
      },
      include: {
        batch: true,
        institution: true,
        recipient: true
      }
    });

    await createAuditRecord({
      shipmentId: id,
      action: 'APPROVE',
      operator: operator || '系统管理员',
      description: `审批通过寄送申请: ${shipment.shipmentNumber}`,
      beforeSnapshot: oldShipment,
      afterSnapshot: shipment
    });

    res.json(shipment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { operator, reason } = req.body;

    const oldShipment = await prisma.shipment.findUnique({
      where: { id },
      include: { batch: true, recipient: true }
    });

    if (!oldShipment) {
      return res.status(404).json({ error: '寄送申请不存在' });
    }

    if (oldShipment.status !== 'PENDING') {
      return res.status(400).json({ error: '只有待处理状态的申请可以驳回' });
    }

    const shipment = await prisma.shipment.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectReason: reason,
        approvedBy: operator || '系统管理员',
        approvedAt: new Date()
      },
      include: {
        batch: true,
        institution: true,
        recipient: true
      }
    });

    await createAuditRecord({
      shipmentId: id,
      action: 'REJECT',
      operator: operator || '系统管理员',
      description: `审批驳回寄送申请: ${shipment.shipmentNumber}，原因: ${reason || '未说明'}`,
      beforeSnapshot: oldShipment,
      afterSnapshot: shipment
    });

    res.json(shipment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/ship', async (req, res) => {
  try {
    const { id } = req.params;
    const { operator } = req.body;

    const oldShipment = await prisma.shipment.findUnique({ where: { id } });

    if (!oldShipment) {
      return res.status(404).json({ error: '寄送申请不存在' });
    }

    if (oldShipment.status !== 'APPROVED') {
      return res.status(400).json({ error: '只有已通过状态的申请可以发出' });
    }

    const shipment = await prisma.shipment.update({
      where: { id },
      data: { status: 'SHIPPED' },
      include: {
        batch: true,
        institution: true,
        recipient: true
      }
    });

    await createAuditRecord({
      shipmentId: id,
      action: 'SHIP',
      operator: operator || '系统管理员',
      description: `发出样本: ${shipment.shipmentNumber}`,
      beforeSnapshot: oldShipment,
      afterSnapshot: shipment
    });

    res.json(shipment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/deliver', async (req, res) => {
  try {
    const { id } = req.params;
    const { operator } = req.body;

    const oldShipment = await prisma.shipment.findUnique({ where: { id } });

    if (!oldShipment) {
      return res.status(404).json({ error: '寄送申请不存在' });
    }

    if (oldShipment.status !== 'SHIPPED') {
      return res.status(400).json({ error: '只有已寄送状态的申请可以签收' });
    }

    const shipment = await prisma.shipment.update({
      where: { id },
      data: { status: 'DELIVERED' },
      include: {
        batch: true,
        institution: true,
        recipient: true
      }
    });

    await createAuditRecord({
      shipmentId: id,
      action: 'DELIVER',
      operator: operator || '系统管理员',
      description: `签收样本: ${shipment.shipmentNumber}`,
      beforeSnapshot: oldShipment,
      afterSnapshot: shipment
    });

    res.json(shipment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/close', async (req, res) => {
  try {
    const { id } = req.params;
    const { operator } = req.body;

    const oldShipment = await prisma.shipment.findUnique({ where: { id } });

    if (!oldShipment) {
      return res.status(404).json({ error: '寄送申请不存在' });
    }

    if (oldShipment.status !== 'DELIVERED') {
      return res.status(400).json({ error: '只有已签收状态的申请可以关闭' });
    }

    const validation = await validateShipmentClosure(id);

    if (!validation.valid) {
      return res.status(400).json({
        error: '合规校验失败',
        details: validation.errors
      });
    }

    const shipment = await prisma.shipment.update({
      where: { id },
      data: { 
        status: 'CLOSED',
        closedAt: new Date()
      },
      include: {
        batch: true,
        institution: true,
        recipient: true
      }
    });

    await createAuditRecord({
      shipmentId: id,
      action: 'CLOSE',
      operator: operator || '系统管理员',
      description: `关闭寄送申请: ${shipment.shipmentNumber}`,
      beforeSnapshot: oldShipment,
      afterSnapshot: shipment
    });

    res.json(shipment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const shipment = await prisma.shipment.findUnique({
      where: { id },
      include: {
        batch: true,
        institution: true,
        recipient: true,
        tempRecords: {
          orderBy: { recordTime: 'asc' }
        },
        destruction: true,
        histories: {
          orderBy: { actionTime: 'asc' }
        }
      }
    });

    if (!shipment) {
      return res.status(404).json({ error: '寄送申请不存在' });
    }

    res.json(shipment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
