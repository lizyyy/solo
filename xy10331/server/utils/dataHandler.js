const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');

const readData = (fileName) => {
  const filePath = path.join(DATA_DIR, fileName);
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`读取文件 ${fileName} 失败:`, error);
    return [];
  }
};

const writeData = (fileName, data) => {
  const filePath = path.join(DATA_DIR, fileName);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error(`写入文件 ${fileName} 失败:`, error);
    return false;
  }
};

const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

const generateOrderNumber = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return `R${year}${month}${day}${random}`;
};

const calculateDays = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

const isOverdue = (dueDate) => {
  const now = new Date();
  const due = new Date(dueDate);
  return now > due;
};

module.exports = {
  readData,
  writeData,
  generateId,
  generateOrderNumber,
  calculateDays,
  isOverdue
};
