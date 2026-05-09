function generateOrderId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `ORD-${timestamp.toUpperCase()}-${random.toUpperCase()}`;
}

function generateExtensionId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `EXT-${timestamp.toUpperCase()}-${random.toUpperCase()}`;
}

function generateStockRecordId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `STK-${timestamp.toUpperCase()}-${random.toUpperCase()}`;
}

function generateExceptionId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `EXP-${timestamp.toUpperCase()}-${random.toUpperCase()}`;
}

module.exports = {
  generateOrderId,
  generateExtensionId,
  generateStockRecordId,
  generateExceptionId
};
