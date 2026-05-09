const { v4: uuidv4 } = require('uuid');

const generateNo = (prefix) => {
  const timestamp = Date.now().toString();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
};

const generateId = () => {
  return uuidv4();
};

module.exports = {
  generateNo,
  generateId
};