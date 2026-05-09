const sequelize = require('../config/database');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const models = {};
const basename = path.basename(__filename);

fs
  .readdirSync(__dirname)
  .filter(file => {
    return (
      file.indexOf('.') !== 0 &&
      file !== basename &&
      file.slice(-3) === '.js'
    );
  })
  .forEach(file => {
    const model = require(path.join(__dirname, file));
    models[model.name] = model;
  });

Object.keys(models).forEach(modelName => {
  if (models[modelName].associate) {
    models[modelName].associate(models);
  }
});

models.sequelize = sequelize;
models.Sequelize = require('sequelize');

const initDatabase = async () => {
  try {
    await sequelize.authenticate();
    logger.info('数据库连接已建立');
    
    await sequelize.sync({ 
      alter: true 
    });
    logger.info('数据库模型已同步');
    
    return true;
  } catch (error) {
    logger.error('数据库初始化失败:', error);
    throw error;
  }
};

module.exports = {
  ...models,
  initDatabase
};
