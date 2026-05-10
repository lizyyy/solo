const Sequelize = require('sequelize');
const config = require('../config/database');
const logger = require('../utils/logger');

const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];

const sequelize = new Sequelize(
  dbConfig.database,
  dbConfig.username,
  dbConfig.password,
  {
    host: dbConfig.host,
    port: dbConfig.port,
    dialect: dbConfig.dialect,
    pool: dbConfig.pool,
    logging: dbConfig.logging === true ? (msg) => logger.debug(msg) : false,
    define: {
      underscored: true,
      freezeTableName: false,
      timestamps: true,
    },
  }
);

const db = {
  sequelize,
  Sequelize,
};

db.BusinessLine = require('./business-line')(sequelize, Sequelize);
db.User = require('./user')(sequelize, Sequelize);
db.Blacklist = require('./blacklist')(sequelize, Sequelize);
db.BlacklistHistory = require('./blacklist-history')(sequelize, Sequelize);
db.Exemption = require('./exemption')(sequelize, Sequelize);
db.ShareVersion = require('./share-version')(sequelize, Sequelize);
db.ShareVersionItem = require('./share-version-item')(sequelize, Sequelize);
db.AuditLog = require('./audit-log')(sequelize, Sequelize);
db.HitRecord = require('./hit-record')(sequelize, Sequelize);
db.ExportRecord = require('./export-record')(sequelize, Sequelize);

Object.keys(db).forEach((modelName) => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.authenticate = async () => {
  try {
    await sequelize.authenticate();
    logger.info('Database connection established successfully');
    return true;
  } catch (error) {
    logger.error('Unable to connect to the database:', { error: error.message });
    throw error;
  }
};

db.sync = async (force = false) => {
  try {
    await sequelize.sync({ force, alter: !force });
    logger.info('Database synchronized successfully');
    return true;
  } catch (error) {
    logger.error('Failed to synchronize database:', { error: error.message });
    throw error;
  }
};

module.exports = db;
