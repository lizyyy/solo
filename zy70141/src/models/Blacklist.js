const { DataTypes, Op } = require('sequelize');
const { sequelize } = require('../db');

const Blacklist = sequelize.define('Blacklist', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  type: {
    type: DataTypes.ENUM('ip', 'fingerprint', 'device', 'user_agent'),
    allowNull: false,
    index: true,
  },
  value: {
    type: DataTypes.STRING(256),
    allowNull: false,
    index: true,
  },
  reason: {
    type: DataTypes.STRING(512),
    allowNull: true,
  },
  severity: {
    type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
    defaultValue: 'medium',
  },
  source: {
    type: DataTypes.STRING(64),
    allowNull: true,
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    index: true,
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  blockCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: true,
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
  tableName: 'blacklists',
  timestamps: true,
  indexes: [
    { fields: ['type', 'value'], unique: true },
    { fields: ['isActive'] },
    { fields: ['severity'] },
  ],
});

Blacklist.findByTypeAndValue = async function(type, value) {
  return this.findOne({
    where: {
      type,
      value,
      isActive: true,
      [Op.or]: [
        { expiresAt: null },
        { expiresAt: { [Op.gt]: new Date() } },
      ],
    },
  });
};

module.exports = Blacklist;
