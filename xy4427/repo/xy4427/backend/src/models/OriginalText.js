const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const OriginalText = sequelize.define('OriginalText', {
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
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  charCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'char_count',
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
  tableName: 'original_texts',
  timestamps: true,
});

module.exports = OriginalText;
