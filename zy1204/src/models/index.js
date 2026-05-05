const sequelize = require('../config/database');

const Experiment = require('./experiment');
const Policy = require('./policy');
const TrafficTrace = require('./trafficTrace');
const DependencyHealth = require('./dependencyHealth');
const DecisionLog = require('./decisionLog');

// 定义模型关系
Experiment.hasMany(DependencyHealth, { foreignKey: 'experimentId' });
Experiment.hasMany(DecisionLog, { foreignKey: 'experimentId' });

DependencyHealth.belongsTo(Experiment, { foreignKey: 'experimentId' });
DecisionLog.belongsTo(Experiment, { foreignKey: 'experimentId' });

const syncDatabase = async (force = false) => {
  try {
    await sequelize.sync({ force });
    console.log('数据库同步成功');
  } catch (error) {
    console.error('数据库同步失败:', error);
    throw error;
  }
};

module.exports = {
  sequelize,
  Experiment,
  Policy,
  TrafficTrace,
  DependencyHealth,
  DecisionLog,
  syncDatabase
};
