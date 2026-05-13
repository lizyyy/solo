const { FlowRecord } = require('../models');

const createFlowRecord = async (flowType, referenceId, orderId, fromStatus, toStatus, operator, remarks = '') => {
  return await FlowRecord.create({
    flowType,
    referenceId,
    orderId,
    fromStatus,
    toStatus,
    operator,
    remarks
  });
};

const getFlowRecords = async (orderId) => {
  return await FlowRecord.findAll({
    where: { orderId },
    order: [['operationTime', 'DESC']]
  });
};

module.exports = {
  createFlowRecord,
  getFlowRecords
};
