const { DataTypes } = require('sequelize');
const sequelize = require('../index');

const AllocationRatio = sequelize.define('AllocationRatio', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
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
    validate: {
      min: 0,
      max: 1,
    },
  },
  effectiveMonth: {
    type: DataTypes.STRING(7),
    allowNull: false,
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
});

module.exports = AllocationRatio;
