const { DataTypes } = require('sequelize');
const sequelize = require('../index');

const ManualAssignment = sequelize.define('ManualAssignment', {
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
  projectId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Projects',
      key: 'id',
    },
  },
  assignedBy: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id',
    },
  },
  reason: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  previousProjectId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Projects',
      key: 'id',
    },
  },
  previousMethod: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
});

module.exports = ManualAssignment;
