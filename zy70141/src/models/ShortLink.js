const { DataTypes } = require('sequelize');
const { sequelize } = require('../db');

const ShortLink = sequelize.define('ShortLink', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  shortCode: {
    type: DataTypes.STRING(16),
    unique: true,
    allowNull: false,
    index: true,
  },
  originalUrl: {
    type: DataTypes.STRING(2048),
    allowNull: false,
  },
  channel: {
    type: DataTypes.STRING(64),
    allowNull: false,
    index: true,
  },
  campaign: {
    type: DataTypes.STRING(64),
    allowNull: true,
  },
  source: {
    type: DataTypes.STRING(64),
    allowNull: true,
  },
  medium: {
    type: DataTypes.STRING(64),
    allowNull: true,
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  maxClicks: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  totalClicks: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  validClicks: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  fraudClicks: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'short_links',
  timestamps: true,
  indexes: [
    { fields: ['channel'] },
    { fields: ['isActive'] },
  ],
});

module.exports = ShortLink;
