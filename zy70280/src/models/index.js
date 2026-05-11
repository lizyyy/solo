const sequelize = require('../config/database');

const Valve = require('./Valve');
const NetworkNode = require('./NetworkNode');
const Pipe = require('./Pipe');
const Community = require('./Community');
const Hospital = require('./Hospital');
const FireHydrant = require('./FireHydrant');
const PriorityUser = require('./PriorityUser');
const RepairOrder = require('./RepairOrder');
const ImpactAnalysis = require('./ImpactAnalysis');

// 定义关联关系
NetworkNode.hasMany(Valve, { foreignKey: 'networkNodeId' });
Valve.belongsTo(NetworkNode, { foreignKey: 'networkNodeId' });

NetworkNode.hasMany(Community, { foreignKey: 'networkNodeId' });
Community.belongsTo(NetworkNode, { foreignKey: 'networkNodeId' });

NetworkNode.hasMany(Hospital, { foreignKey: 'networkNodeId' });
Hospital.belongsTo(NetworkNode, { foreignKey: 'networkNodeId' });

NetworkNode.hasMany(FireHydrant, { foreignKey: 'networkNodeId' });
FireHydrant.belongsTo(NetworkNode, { foreignKey: 'networkNodeId' });

NetworkNode.hasMany(PriorityUser, { foreignKey: 'networkNodeId' });
PriorityUser.belongsTo(NetworkNode, { foreignKey: 'networkNodeId' });

Pipe.belongsTo(NetworkNode, { as: 'startNode', foreignKey: 'startNodeId' });
Pipe.belongsTo(NetworkNode, { as: 'endNode', foreignKey: 'endNodeId' });

RepairOrder.belongsTo(Pipe, { foreignKey: 'affectedPipeId' });
Pipe.hasMany(RepairOrder, { foreignKey: 'affectedPipeId' });

RepairOrder.hasMany(ImpactAnalysis, { foreignKey: 'repairOrderId' });
ImpactAnalysis.belongsTo(RepairOrder, { foreignKey: 'repairOrderId' });

module.exports = {
  sequelize,
  Valve,
  NetworkNode,
  Pipe,
  Community,
  Hospital,
  FireHydrant,
  PriorityUser,
  RepairOrder,
  ImpactAnalysis
};