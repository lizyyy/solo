const storage = require('../storage/file');
const { v4: uuidv4 } = require('uuid');

function getDeliverySlots() {
  return storage.readJSON(storage.getDeliverySlotsPath(), []);
}

function saveDeliverySlots(slots) {
  storage.writeJSON(storage.getDeliverySlotsPath(), slots);
}

function getConfirmations() {
  return storage.readJSON(storage.getConfirmationsPath(), []);
}

function saveConfirmations(confirmations) {
  storage.writeJSON(storage.getConfirmationsPath(), confirmations);
}

function isSlotInPromisedTime(slotId) {
  const slots = getDeliverySlots();
  const slot = slots.find(s => s.slotId === slotId);
  return slot ? slot.isPromised : false;
}

function validateDeliverySlot(slotId) {
  const slots = getDeliverySlots();
  const slot = slots.find(s => s.slotId === slotId);
  
  if (!slot) {
    return {
      valid: false,
      issue: 'unknown_slot',
      message: `配送时段 ${slotId} 不存在`
    };
  }
  
  if (!slot.isPromised) {
    return {
      valid: false,
      issue: 'slot_not_promised',
      message: `配送时段 ${slotId} 不在承诺配送范围内`
    };
  }
  
  return {
    valid: true,
    slot
  };
}

function addConfirmation(orderId, confirmationData) {
  const confirmations = getConfirmations();
  
  const existingConfirmation = confirmations.find(
    c => c.orderId === orderId && 
         c.confirmationType === confirmationData.confirmationType
  );
  
  if (existingConfirmation) {
    return {
      success: false,
      duplicate: true,
      message: `订单 ${orderId} 的 ${confirmationData.confirmationType} 确认已存在`
    };
  }
  
  const newConfirmation = {
    id: uuidv4(),
    orderId,
    ...confirmationData,
    confirmedAt: new Date().toISOString()
  };
  
  confirmations.push(newConfirmation);
  saveConfirmations(confirmations);
  
  return {
    success: true,
    duplicate: false,
    confirmation: newConfirmation
  };
}

function getOrderConfirmations(orderId) {
  const confirmations = getConfirmations();
  return confirmations.filter(c => c.orderId === orderId);
}

module.exports = {
  getDeliverySlots,
  saveDeliverySlots,
  getConfirmations,
  saveConfirmations,
  isSlotInPromisedTime,
  validateDeliverySlot,
  addConfirmation,
  getOrderConfirmations
};
