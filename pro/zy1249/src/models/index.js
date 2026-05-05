const sequelize = require('../config/database')
const Review = require('./Review')
const Issue = require('./Issue')
const Rule = require('./Rule')
const OpenApiSpec = require('./OpenApiSpec')
const RulesConfig = require('./RulesConfig')

Review.hasMany(Issue, { foreignKey: 'reviewId', as: 'issues' })
Issue.belongsTo(Review, { foreignKey: 'reviewId', as: 'review' })

Review.belongsTo(OpenApiSpec, { foreignKey: 'openapiSpecId', as: 'openapiSpec' })
OpenApiSpec.hasMany(Review, { foreignKey: 'openapiSpecId', as: 'reviews' })

Review.belongsTo(RulesConfig, { foreignKey: 'rulesConfigId', as: 'rulesConfig' })
RulesConfig.hasMany(Review, { foreignKey: 'rulesConfigId', as: 'reviews' })

const initDatabase = async () => {
  try {
    await sequelize.authenticate()
    console.log('数据库连接成功')
    await sequelize.sync({ alter: true })
    console.log('数据库模型同步完成')
  } catch (error) {
    console.error('数据库初始化失败:', error)
    throw error
  }
}

module.exports = {
  sequelize,
  initDatabase,
  Review,
  Issue,
  Rule,
  OpenApiSpec,
  RulesConfig
}