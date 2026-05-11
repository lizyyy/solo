const { DataTypes } = require('sequelize');
const sequelize = require('../index');

const BillImport = sequelize.define('BillImport', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  fileName: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  fileHash: {
    type: DataTypes.STRING(64),
    allowNull: false,
  },
  billMonth: {
    type: DataTypes.STRING(7),
    allowNull: false,
  },
  cloudProvider: {
    type: DataTypes.ENUM('aliyun', 'aws', 'tencent', 'huawei', 'other'),
    allowNull: true,
  },
  totalRecords: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  totalAmount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0,
  },
  status: {
    type: DataTypes.ENUM('processing', 'completed', 'failed', 'duplicate'),
    allowNull: false,
    defaultValue: 'processing',
  },
  errorMessage: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  importedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id',
    },
  },
});

module.exports = BillImport;
