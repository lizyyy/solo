const { InspectionRecord, DeliveryNote, MaterialOrder } = require('../models');

const checkPhotoChanges = (oldPhotos, newPhotos) => {
  const oldArray = oldPhotos ? JSON.parse(oldPhotos) : [];
  const newArray = newPhotos ? JSON.parse(newPhotos) : [];
  
  if (oldArray.length !== newArray.length) {
    return { hasChanged: true, message: `照片数量从${oldArray.length}变为${newArray.length}` };
  }
  
  const oldSet = new Set(oldArray.map(p => JSON.stringify(p)));
  const newSet = new Set(newArray.map(p => JSON.stringify(p)));
  
  if (oldSet.size !== newSet.size) {
    return { hasChanged: true, message: '照片内容发生变化' };
  }
  
  return { hasChanged: false, message: '照片未变化' };
};

const checkReturnInterception = async (deliveryId) => {
  const inspections = await InspectionRecord.findAll({
    where: { deliveryId, inspectionResult: ['rejected', 'partial'] }
  });
  
  const pendingReturns = inspections.filter(i => !i.isReturnProcessed && (i.rejectedQuantity > 0));
  
  if (pendingReturns.length > 0) {
    const totalRejected = pendingReturns.reduce((sum, i) => sum + parseFloat(i.rejectedQuantity), 0);
    return {
      intercepted: true,
      message: `存在${pendingReturns.length}笔退换货待处理，共${totalRejected}件拒收材料`,
      pendingReturns
    };
  }
  
  return { intercepted: false, message: '无待处理退换货' };
};

const checkPaymentNodeReview = async (orderId) => {
  const order = await MaterialOrder.findByPk(orderId);
  if (!order) {
    return { verified: false, message: '订单不存在' };
  }
  
  const deliveries = await DeliveryNote.findAll({ where: { orderId } });
  const inspections = await InspectionRecord.findAll({ where: { orderId } });
  
  const totalDelivered = deliveries.reduce((sum, d) => sum + parseFloat(d.deliveredQuantity), 0);
  const totalAccepted = inspections.reduce((sum, i) => sum + parseFloat(i.acceptedQuantity), 0);
  
  if (Math.abs(totalDelivered - totalAccepted) > 0.01) {
    return {
      verified: false,
      message: `送货数量(${totalDelivered})与验收合格数量(${totalAccepted})不一致，无法通过付款复核`,
      totalDelivered,
      totalAccepted
    };
  }
  
  const unprocessedReturns = inspections.filter(i => !i.isReturnProcessed && i.rejectedQuantity > 0);
  if (unprocessedReturns.length > 0) {
    return {
      verified: false,
      message: `存在${unprocessedReturns.length}笔退换货未处理，无法通过付款复核`,
      unprocessedReturns
    };
  }
  
  return {
    verified: true,
    message: '付款节点复核通过',
    totalDelivered,
    totalAccepted
  };
};

const checkDuplicateSubmission = async (deliveryId, inspectionDate, inspector) => {
  const existing = await InspectionRecord.findOne({
    where: {
      deliveryId,
      inspector,
      status: ['submitted', 'reviewed', 'completed']
    }
  });
  
  if (existing) {
    return {
      duplicate: true,
      message: `该送货单已由${inspector}提交过验收记录`,
      existingRecord: existing
    };
  }
  
  return { duplicate: false, message: '无重复提交' };
};

module.exports = {
  checkPhotoChanges,
  checkReturnInterception,
  checkPaymentNodeReview,
  checkDuplicateSubmission
};
