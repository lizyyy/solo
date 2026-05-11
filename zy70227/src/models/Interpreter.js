const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const Interpreter = sequelize.define('Interpreter', {
  id: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true
  },
  languages: {
    type: DataTypes.TEXT,
    allowNull: false,
    get() {
      const raw = this.getDataValue('languages');
      return raw ? JSON.parse(raw) : [];
    },
    set(value) {
      this.setDataValue('languages', JSON.stringify(value));
    }
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive', 'leave'),
    allowNull: false,
    defaultValue: 'active'
  }
}, {
  tableName: 'interpreters',
  timestamps: true
});

module.exports = Interpreter;
