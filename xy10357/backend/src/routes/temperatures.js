const express = require('express');
const { PrismaClient } = require('@prisma/client');
const router = express.Router();
const prisma = new PrismaClient();
const { createAuditRecord } = require('../utils/audit');

router.get('/', async (req, res) => {
  try {
    const { shipmentId, status, needsReview } = req.query;
    const where = {};

    if (shipmentId) where.shipmentId = shipmentId;
    if (status) where.status = status;
    if (needsReview === 'true') {
      where.status = 'EXCEEDED';
      where.reviewedBy = null;
    }

    const tempRecords = await prisma.temperatureRecord.findMany({
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
      orderBy: { recordTime: 'desc' }
    });

    res.json(tempRecords);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { shipmentId, recordTime, temperature } = req.body;

    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: { batch: true }
    });

    if (!shipment) {
      return res.status(404).json({ error: '寄送申请不存在' });
    }

    let status = 'NORMAL';
    const { storageTempMin, storageTempMax } = shipment.batch;

    if (storageTempMin !== null && storageTempMin !== undefined && 
        temperature < storageTempMin) {
      status = 'EXCEEDED';
    } else if (storageTempMax !== null && storageTempMax !== undefined && 
               temperature > storageTempMax) {
      status = 'EXCEEDED';
    } else if ((storageTempMin !== null && temperature < storageTempMin + 2) ||
               (storageTempMax !== null && temperature > storageTempMax - 2)) {
      status = 'WARNING';
    }

    const tempRecord = await prisma.temperatureRecord.create({
      data: {
        shipmentId,
        recordTime: new Date(recordTime),
        temperature: parseFloat(temperature),
        status
      },
      include: { shipment: true }
    });

    await createAuditRecord({
      shipmentId,
      tempRecordId: tempRecord.id,
      action: 'CREATE',
      operator: '系统',
      description: `新增温控记录: ${temperature}°C (状态: ${status === 'EXCEEDED' ? '超限' : status === 'WARNING' ? '警告' : '正常'})`
    });

    res.status(201).json(tempRecord);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/review', async (req, res) => {
  try {
    const { id } = req.params;
    const { operator, remark } = req.body;

    const oldRecord = await prisma.temperatureRecord.findUnique({
      where: { id },
      include: { shipment: true }
    });

    if (!oldRecord) {
      return res.status(404).json({ error: '温控记录不存在' });
    }

    if (oldRecord.status !== 'EXCEEDED') {
      return res.status(400).json({ error: '只有超限状态的记录需要复核' });
    }

    if (oldRecord.reviewedBy) {
      return res.status(400).json({ error: '该记录已复核' });
    }

    const tempRecord = await prisma.temperatureRecord.update({
      where: { id },
      data: {
        status: 'REVIEWED',
        reviewedBy: operator || '系统管理员',
        reviewedAt: new Date(),
        reviewRemark: remark
      },
      include: { shipment: true }
    });

    await createAuditRecord({
      shipmentId: oldRecord.shipmentId,
      tempRecordId: id,
      action: 'REVIEW',
      operator: operator || '系统管理员',
      description: `复核温控异常记录: ${oldRecord.temperature}°C`,
      beforeSnapshot: oldRecord,
      afterSnapshot: tempRecord
    });

    res.json(tempRecord);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/summary', async (req, res) => {
  try {
    const totalRecords = await prisma.temperatureRecord.count();
    const exceededRecords = await prisma.temperatureRecord.count({
      where: { status: 'EXCEEDED' }
    });
    const unreviewedRecords = await prisma.temperatureRecord.count({
      where: { status: 'EXCEEDED', reviewedBy: null }
    });
    const warningRecords = await prisma.temperatureRecord.count({
      where: { status: 'WARNING' }
    });

    res.json({
      totalRecords,
      exceededRecords,
      unreviewedRecords,
      warningRecords,
      complianceRate: totalRecords > 0 
        ? ((totalRecords - exceededRecords - warningRecords) / totalRecords * 100).toFixed(1)
        : '100.0'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const tempRecord = await prisma.temperatureRecord.findUnique({
      where: { id },
      include: {
        shipment: {
          include: {
            batch: true,
            recipient: true,
            institution: true
          }
        }
      }
    });

    if (!tempRecord) {
      return res.status(404).json({ error: '温控记录不存在' });
    }

    res.json(tempRecord);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
