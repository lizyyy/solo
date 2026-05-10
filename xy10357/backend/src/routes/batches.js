const express = require('express');
const { PrismaClient } = require('@prisma/client');
const router = express.Router();
const prisma = new PrismaClient();
const { createAuditRecord } = require('../utils/audit');

router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    const where = {};

    if (status === 'expired') {
      where.expiryDate = { lte: new Date() };
    } else if (status === 'active') {
      where.expiryDate = { gt: new Date() };
    }

    const batches = await prisma.sampleBatch.findMany({
      where,
      include: {
        shipments: {
          select: { id: true, shipmentNumber: true, status: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const today = new Date();
    const result = batches.map(b => ({
      ...b,
      batchStatus: new Date(b.expiryDate) <= today ? 'expired' : 'active'
    }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { 
      batchNumber, 
      sampleName, 
      quantity, 
      manufacturer, 
      productionDate, 
      expiryDate,
      storageTempMin,
      storageTempMax,
      description 
    } = req.body;

    const batch = await prisma.sampleBatch.create({
      data: {
        batchNumber,
        sampleName,
        quantity: parseInt(quantity),
        manufacturer,
        productionDate: new Date(productionDate),
        expiryDate: new Date(expiryDate),
        storageTempMin: storageTempMin ? parseFloat(storageTempMin) : null,
        storageTempMax: storageTempMax ? parseFloat(storageTempMax) : null,
        description
      }
    });

    await createAuditRecord({
      batchId: batch.id,
      action: 'CREATE',
      operator: req.headers['x-operator'] || '系统管理员',
      description: `创建样本批次: ${batchNumber} (${sampleName})`
    });

    res.status(201).json(batch);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const oldBatch = await prisma.sampleBatch.findUnique({ where: { id } });

    const { 
      batchNumber, 
      sampleName, 
      quantity, 
      manufacturer, 
      productionDate, 
      expiryDate,
      storageTempMin,
      storageTempMax,
      description 
    } = req.body;

    const batch = await prisma.sampleBatch.update({
      where: { id },
      data: {
        batchNumber,
        sampleName,
        quantity: quantity ? parseInt(quantity) : undefined,
        manufacturer,
        productionDate: productionDate ? new Date(productionDate) : undefined,
        expiryDate: expiryDate ? new Date(expiryDate) : undefined,
        storageTempMin: storageTempMin !== undefined ? parseFloat(storageTempMin) : undefined,
        storageTempMax: storageTempMax !== undefined ? parseFloat(storageTempMax) : undefined,
        description
      }
    });

    await createAuditRecord({
      batchId: id,
      action: 'UPDATE',
      operator: req.headers['x-operator'] || '系统管理员',
      description: `更新样本批次: ${batch.batchNumber}`,
      beforeSnapshot: oldBatch,
      afterSnapshot: batch
    });

    res.json(batch);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const batch = await prisma.sampleBatch.findUnique({
      where: { id },
      include: {
        shipments: {
          include: {
            institution: true,
            recipient: true,
            tempRecords: true,
            destruction: true
          }
        }
      }
    });

    if (!batch) {
      return res.status(404).json({ error: '样本批次不存在' });
    }

    const today = new Date();
    res.json({
      ...batch,
      batchStatus: new Date(batch.expiryDate) <= today ? 'expired' : 'active'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
