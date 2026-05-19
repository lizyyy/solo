const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const HAZARD_LEVELS = {
  LEVEL_1: 'level_1',
  LEVEL_2: 'level_2',
  LEVEL_3: 'level_3',
  LEVEL_4: 'level_4'
};

const Reagent = sequelize.define('Reagent', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  reagent_code: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    comment: '试剂编码'
  },
  name: {
    type: DataTypes.STRING(200),
    allowNull: false,
    comment: '试剂名称'
  },
  english_name: {
    type: DataTypes.STRING(200),
    allowNull: true,
    comment: '英文名称'
  },
  cas_no: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'CAS号'
  },
  formula: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '分子式'
  },
  molecular_weight: {
    type: DataTypes.DECIMAL(10, 4),
    allowNull: true,
    comment: '分子量'
  },
  hazard_level: {
    type: DataTypes.ENUM(Object.values(HAZARD_LEVELS)),
    allowNull: false,
    defaultValue: HAZARD_LEVELS.LEVEL_4,
    comment: '危险等级'
  },
  hazard_description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '危险性描述'
  },
  safety_precautions: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '安全注意事项'
  },
  storage_condition: {
    type: DataTypes.STRING(200),
    allowNull: true,
    comment: '储存条件'
  },
  unit: {
    type: DataTypes.STRING(20),
    allowNull: false,
    comment: '单位（g, ml, 瓶等）'
  },
  specification: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '规格'
  },
  manufacturer: {
    type: DataTypes.STRING(200),
    allowNull: true,
    comment: '生产厂家'
  },
  category: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '分类'
  },
  is_hazardous: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否危化品'
  },
  approval_required: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否需要审批'
  },
  max_quantity_per_apply: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: '单次最大申领量'
  }
}, {
  tableName: 'reagents',
  comment: '试剂表'
});

Reagent.HAZARD_LEVELS = HAZARD_LEVELS;

module.exports = Reagent;
