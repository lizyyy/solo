function formatReceiptNumber(prefix, number, length = 8) {
  const numberStr = number.toString().padStart(length, '0');
  return prefix ? `${prefix}${numberStr}` : numberStr;
}

function parseNumericNumber(receiptNumber, prefix = '') {
  if (prefix && receiptNumber.startsWith(prefix)) {
    receiptNumber = receiptNumber.substring(prefix.length);
  }
  return parseInt(receiptNumber, 10);
}

function generateReceiptNumber(segmentPool, nextNumber) {
  return formatReceiptNumber(
    segmentPool.prefix,
    nextNumber
  );
}

module.exports = {
  formatReceiptNumber,
  parseNumericNumber,
  generateReceiptNumber
};
