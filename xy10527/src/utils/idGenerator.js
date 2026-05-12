const { v4: uuidv4 } = require('uuid');

const generateId = () => uuidv4();

const generateOrderNo = () => 'ORD' + Date.now();

const generateComplaintNo = () => 'CMP' + Date.now();

module.exports = {
  generateId,
  generateOrderNo,
  generateComplaintNo
};
