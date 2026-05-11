const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Pipe = sequelize.define('Pipe', {
  id: {
    type: DataTypes.STRING(20),
    primaryKey: true,
    allowNull: false
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  startNodeId: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  endNodeId: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  diameter: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '管道直径(mm)'
  },
  material: {
    type: DataTypes.STRING(50),
    comment: '管道材质'
  },
  length: {
    type: DataTypes.FLOAT,
    comment: '管道长度(m)'
  },
  status: {
    type: DataTypes.ENUM('active', 'maintenance', 'damaged', 'repaired'),
    allowNull: false,
    defaultValue: 'active'
  }
}, {
  timestamps: true,
  tableName: 'pipes'
});

module.exports = Pipe;