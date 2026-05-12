const { v4: uuidv4 } = require('uuid');

const generateEventId = () => {
  return `EVT-${uuidv4().replace(/-/g, '').toUpperCase().slice(0, 20)}`;
};

const generateOrderId = () => {
  const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  const random = Math.random().toString(36).toUpperCase().slice(2, 10);
  return `ORD-${timestamp}-${random}`;
};

const generatePaymentId = () => {
  return `PAY-${uuidv4().replace(/-/g, '').toUpperCase().slice(0, 16)}`;
};

const generateRefundId = () => {
  return `REF-${uuidv4().replace(/-/g, '').toUpperCase().slice(0, 16)}`;
};

const generateShippingId = () => {
  return `SHP-${uuidv4().replace(/-/g, '').toUpperCase().slice(0, 16)}`;
};

module.exports = {
  generateEventId,
  generateOrderId,
  generatePaymentId,
  generateRefundId,
  generateShippingId
};
