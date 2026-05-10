const config = require('./config');

function getFlavorInfo(flavorId) {
  return config.FLAVORS.find(f => f.id === flavorId);
}

function getSizeInfo(sizeId) {
  return config.SIZES.find(s => s.id === sizeId);
}

function calculateCapacityUsage(sizeId) {
  const size = getSizeInfo(sizeId);
  return size ? size.multiplier : 1;
}

function calculateTotalPrice(flavorId, sizeId) {
  const flavor = getFlavorInfo(flavorId);
  const size = getSizeInfo(sizeId);
  if (!flavor || !size) return 0;
  return Math.round(flavor.price * size.multiplier * 100) / 100;
}

function calculateIngredients(flavorId, sizeId) {
  const flavor = getFlavorInfo(flavorId);
  const size = getSizeInfo(sizeId);
  if (!flavor || !size) return {};
  
  const result = {};
  for (const [key, amount] of Object.entries(flavor.ingredients)) {
    result[key] = Math.round(amount * size.multiplier * 100) / 100;
  }
  return result;
}

function isWeekend(dateStr) {
  const date = new Date(dateStr);
  const day = date.getDay();
  return day === 0 || day === 6;
}

function isCutoffPassed(dateStr) {
  const now = new Date();
  const target = new Date(dateStr);
  const cutoff = new Date(target);
  cutoff.setDate(cutoff.getDate() - config.CUTOFF_DAYS_BEFORE);
  cutoff.setHours(18, 0, 0, 0);
  return now >= cutoff;
}

function getDaysUntil(dateStr) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  const diff = Math.ceil((target - now) / (1000 * 60 * 60 * 24));
  return diff;
}

function generateOrderId() {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 9000) + 1000;
  return `ORD${year}${random}`;
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekday = weekdays[date.getDay()];
  return `${month}月${day}日 ${weekday}`;
}

function formatDateTime(isoStr) {
  const date = new Date(isoStr);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

module.exports = {
  getFlavorInfo,
  getSizeInfo,
  calculateCapacityUsage,
  calculateTotalPrice,
  calculateIngredients,
  isWeekend,
  isCutoffPassed,
  getDaysUntil,
  generateOrderId,
  formatDate,
  formatDateTime
};
