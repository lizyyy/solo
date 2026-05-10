const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CommitmentVersion = sequelize.define('CommitmentVersion', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  shortageId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  versionNo: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  promiseDate: {
    type: DataTypes.DATE,
    allowNull: false
  },
  promiseQuantity: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false
  },
  reason: {
    type: DataTypes.TEXT
  },
  source: {
    type: DataTypes.STRING
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
});

module.exports = CommitmentVersion;
