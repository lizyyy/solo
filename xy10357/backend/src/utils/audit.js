const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const createAuditRecord = async (params) => {
  const {
    shipmentId,
    batchId,
    recipientId,
    tempRecordId,
    destructionId,
    action,
    operator,
    description,
    beforeSnapshot,
    afterSnapshot
  } = params;

  await prisma.auditHistory.create({
    data: {
      shipmentId,
      batchId,
      recipientId,
      tempRecordId,
      destructionId,
      action,
      operator: operator || '系统管理员',
      description,
      beforeSnapshot: beforeSnapshot ? JSON.stringify(beforeSnapshot) : null,
      afterSnapshot: afterSnapshot ? JSON.stringify(afterSnapshot) : null
    }
  });
};

module.exports = {
  createAuditRecord
};
