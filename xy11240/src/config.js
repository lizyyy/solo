const path = require('path');

module.exports = {
  dbPath: path.join(__dirname, '../data/library.db'),
  dataDir: path.join(__dirname, '../data'),
  examplesDir: path.join(__dirname, '../examples'),
  validGrades: ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级', '初一', '初二', '初三', '高一', '高二', '高三', '大学', '通用'],
  validConditions: ['全新', '九成新', '七成新', '五成新', '破损'],
  defaultRole: '志愿者',
  defaultOperator: '系统默认'
};
