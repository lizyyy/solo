const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const BrailleProofreading = sequelize.define('BrailleProofreading', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  paragraphId: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'paragraph_id',
  },
  pageNumber: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'page_number',
  },
  brailleContent: {
    type: DataTypes.TEXT,
    allowNull: false,
    field: 'braille_content',
  },
  points: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  proofreader: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  proofreadingTime: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'proofreading_time',
  },
  status: {
    type: DataTypes.ENUM('pending', 'verified', 'has_issues'),
    defaultValue: 'pending',
  },
  comments: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'created_at',
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'updated_at',
  },
}, {
  tableName: 'braille_proofreadings',
  timestamps: true,
});

module.exports = BrailleProofreading;
