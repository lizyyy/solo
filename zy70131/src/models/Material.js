const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const MaterialStatus = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  ARCHIVED: 'archived'
};

const Material = sequelize.define('Material', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    allowNull: false
  },
  materialCode: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    field: 'material_code'
  },
  materialName: {
    type: DataTypes.STRING(200),
    allowNull: false,
    field: 'material_name'
  },
  materialType: {
    type: DataTypes.STRING(50),
    allowNull: false,
    field: 'material_type'
  },
  copyrightOwner: {
    type: DataTypes.STRING(200),
    allowNull: false,
    field: 'copyright_owner'
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: MaterialStatus.DRAFT
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'created_at'
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'updated_at'
  }
}, {
  tableName: 'materials',
  timestamps: true,
  underscored: true
});

module.exports = { Material, MaterialStatus };
