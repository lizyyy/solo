const express = require('express');
const { PrismaClient } = require('@prisma/client');
const router = express.Router();
const prisma = new PrismaClient();
const { createAuditRecord } = require('../utils/audit');

router.get('/', async (req, res) => {
  try {
    const { status, institutionId } = req.query;
    const where = {};
    
    if (institutionId) where.institutionId = institutionId;
    if (status === 'expired') {
      where.expiryDate = { lte: new Date() };
    } else if (status === 'active') {
      where.expiryDate = { gt: new Date() };
      where.isActive = true;
    } else if (status === 'inactive') {
      where.isActive = false;
    }

    const today = new Date();
    const recipients = await prisma.recipient.findMany({
      where,
      include: {
        institution: true,
        shipments: {
          select: { id: true, shipmentNumber: true, status: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const result = recipients.map(r => ({
      ...r,
      qualificationStatus: (() => {
        if (!r.isActive) return 'inactive';
        if (new Date(r.expiryDate) <= today) return 'expired';
        const daysUntilExpiry = Math.ceil((new Date(r.expiryDate) - today) / (1000 * 60 * 60 * 24));
        if (daysUntilExpiry <= 30) return 'expiring_soon';
        return 'active';
      })()
    }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { 
      institutionId, 
      name, 
      idNumber, 
      qualificationType, 
      qualificationNum, 
      issueDate, 
      expiryDate 
    } = req.body;

    const recipient = await prisma.recipient.create({
      data: {
        institutionId,
        name,
        idNumber,
        qualificationType,
        qualificationNum,
        issueDate: new Date(issueDate),
        expiryDate: new Date(expiryDate)
      },
      include: { institution: true }
    });

    await createAuditRecord({
      recipientId: recipient.id,
      action: 'CREATE',
      operator: req.headers['x-operator'] || '系统管理员',
      description: `创建接收人资质: ${name} (${qualificationType})`
    });

    res.status(201).json(recipient);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, idNumber, qualificationType, qualificationNum, issueDate, expiryDate, isActive } = req.body;

    const oldRecipient = await prisma.recipient.findUnique({ where: { id } });

    const recipient = await prisma.recipient.update({
      where: { id },
      data: {
        name,
        idNumber,
        qualificationType,
        qualificationNum,
        issueDate: issueDate ? new Date(issueDate) : undefined,
        expiryDate: expiryDate ? new Date(expiryDate) : undefined,
        isActive
      },
      include: { institution: true }
    });

    await createAuditRecord({
      recipientId: id,
      action: 'UPDATE',
      operator: req.headers['x-operator'] || '系统管理员',
      description: `更新接收人资质: ${recipient.name}`,
      beforeSnapshot: oldRecipient,
      afterSnapshot: recipient
    });

    res.json(recipient);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const recipient = await prisma.recipient.findUnique({
      where: { id },
      include: {
        institution: true,
        shipments: {
          include: { batch: true, institution: true }
        }
      }
    });
    if (!recipient) {
      return res.status(404).json({ error: '接收人不存在' });
    }

    const today = new Date();
    res.json({
      ...recipient,
      qualificationStatus: (() => {
        if (!recipient.isActive) return 'inactive';
        if (new Date(recipient.expiryDate) <= today) return 'expired';
        const daysUntilExpiry = Math.ceil((new Date(recipient.expiryDate) - today) / (1000 * 60 * 60 * 24));
        if (daysUntilExpiry <= 30) return 'expiring_soon';
        return 'active';
      })()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
