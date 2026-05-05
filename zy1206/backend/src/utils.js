const { v4: uuidv4 } = require('uuid');

function generateId() {
  return uuidv4();
}

function generateSeed() {
  return Math.random().toString(36).substring(2, 10);
}

function currentTimestamp() {
  return new Date().toISOString();
}

function parseJSON(str) {
  try {
    return JSON.parse(str);
  } catch (e) {
    return {};
  }
}

function stringifyJSON(obj) {
  return JSON.stringify(obj, null, 2);
}

function getMajorityCount(total) {
  return Math.floor(total / 2) + 1;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  generateId,
  generateSeed,
  currentTimestamp,
  parseJSON,
  stringifyJSON,
  getMajorityCount,
  delay
};
