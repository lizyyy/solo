let counter = 0;

function generateId(prefix) {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  counter = (counter + 1) % 10000;
  return `${prefix}_${timestamp}_${random}_${counter}`;
}

function getCurrentTime() {
  return Date.now();
}

function formatTime(timestamp) {
  return new Date(timestamp).toISOString();
}

module.exports = {
  generateId,
  getCurrentTime,
  formatTime
};
