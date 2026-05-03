/**
 * 解析器层索引文件
 * 统一导出所有解析器
 */

const csvParser = require('./csvParser');
const jsonParser = require('./jsonParser');

module.exports = {
  csv: csvParser,
  json: jsonParser
};
