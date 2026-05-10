const express = require('express');
const { PrismaClient } = require('@prisma/client');
const router = express.Router();
const prisma = new PrismaClient();
const { createAuditRecord } = require('../utils/audit');

router.get('/', async (req, res) => {
  try {
    const { shipmentId, hasReceipt } = req.query;
    const where = {};

    if (shipmentId) where.shipmentId = shipmentId;

    if (hasReceipt === 'true') {
      where.receiptNumber = { not: null };
    } else if (hasReceipt === 'false') {
      where.receiptNumber = null;
    }

    const destructions = await prisma.destructionReceipt.findMany({
      where,
      include: {
        shipment: {
          include: {
            batch: true,
            recipient: true,
            institution: true
          }
        }
      },
      orderBy: { destructionDate: 'desc' }
    });

    res.json(destructions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { 
      shipmentId, 
      destructionDate, 
      destructionMethod, 
      witnessName, 
      receiptNumber,
      remark 
    } = req.body;

    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId }
    });

    if (!shipment) {
      return res.status(404).json({ error: '寄送申请不存在' });
    }

    const existingReceipt = await prisma.destructionReceipt.findUnique({
      where: { shipmentId }
    });

    let destruction;
    if (existingReceipt) {
      destruction = await prisma.destructionReceipt.update({
        where: { shipmentId },
        data: {
          destructionDate: new Date(destructionDate),
          destructionMethod,
          witnessName,
          receiptNumber,
          remark
        },
        include: { shipment: true }
      });
    } else {
      destruction = await prisma.destructionReceipt.create({
        data: {
          shipmentId,
          destructionDate: new Date(destructionDate),
          destructionMethod,
          witnessName,
          receiptNumber,
          remark
        },
        include: { shipment: true }
      });
    }

    await prisma.shipment.update({
      where: { id: shipmentId },
      data: { status: 'DESTROYED' }
    });

    await createAuditRecord({
      shipmentId,
      destructionId: destruction.id,
      action: 'DESTROY',
      operator: req.headers['x-operator'] || '系统管理员',
      description: `记录销毁回执，方法: ${destructionMethod}，见证人: ${witnessName}`
    });

    res.status(existingReceipt ? 200 : 201).json(destruction);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/pending', async (req, res) => {
  try {
    const deliveredShipments = await prisma.shipment.findMany({
      where: { status: 'DELIVERED' },
      include: {
        batch: true,
        recipient: true,
        institution: true,
        destruction: true
      },
      orderBy: { applicationDate: 'desc' }
    });

    const pendingShipments = deliveredShipments.filter(s => !s.destruction);

    res.json(pendingShipments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const destruction = await prisma.destructionReceipt.findUnique({
      where: { id },
      include: {
        shipment: {
          include: {
            batch: true,
            recipient: true,
            institution: true,
            tempRecords: true
          }
        }
      }
    });

    if (!destruction) {
      return res.status(404).json({ error: '销毁回执不存在' });
    }

    res.json(destruction);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
