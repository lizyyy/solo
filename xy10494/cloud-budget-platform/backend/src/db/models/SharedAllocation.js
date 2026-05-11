const { DataTypes } = require('sequelize');
const sequelize = require('../index');

const SharedAllocation = sequelize.define('SharedAllocation', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  billRecordId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'BillRecords',
      key: 'id',
    },
  },
  sharedServiceId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'SharedServices',
      key: 'id',
    },
  },
  projectId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Projects',
      key: 'id',
    },
  },
  ratio: {
    type: DataTypes.DECIMAL(5, 4),
    allowNull: false,
  },
  allocatedAmount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
  },
  billMonth: {
    type: DataTypes.STRING(7),
    allowNull: false,
  },
});

module.exports = SharedAllocation;
