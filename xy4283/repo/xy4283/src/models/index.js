/**
 * 数据模型层索引文件
 * 统一导出所有数据模型
 */

const database = require('./database');
const equipmentModel = require('./equipmentModel');
const inspectionModel = require('./inspectionModel');
const recallModel = require('./recallModel');
const recallMatchModel = require('./recallMatchModel');
const workOrderModel = require('./workOrderModel');
const statusHistoryModel = require('./statusHistoryModel');
const overdueRiskModel = require('./overdueRiskModel');

module.exports = {
  database,
  equipment: equipmentModel,
  inspection: inspectionModel,
  recall: recallModel,
  recallMatch: recallMatchModel,
  workOrder: workOrderModel,
  statusHistory: statusHistoryModel,
  overdueRisk: overdueRiskModel
};
