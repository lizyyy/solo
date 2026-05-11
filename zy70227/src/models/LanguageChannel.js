const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const LanguageChannel = sequelize.define('LanguageChannel', {
  id: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false
  },
  conferenceId: {
    type: DataTypes.STRING,
    allowNull: false
  },
  language: {
    type: DataTypes.STRING,
    allowNull: false
  },
  channelNumber: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  }
}, {
  tableName: 'language_channels',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['conferenceId', 'language']
    },
    {
      unique: true,
      fields: ['conferenceId', 'channelNumber']
    }
  ]
});

module.exports = LanguageChannel;
