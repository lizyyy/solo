const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const DamagePhoto = sequelize.define('DamagePhoto', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  store_collection_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  photo_url: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  photo_description: {
    type: DataTypes.TEXT
  },
  damage_level: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  reviewed_by: {
    type: DataTypes.INTEGER
  },
  review_status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'pending'
  },
  review_comment: {
    type: DataTypes.TEXT
  },
  reviewed_at: {
    type: DataTypes.DATE
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: false
  }
}, {
  tableName: 'damage_photos',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = DamagePhoto;
