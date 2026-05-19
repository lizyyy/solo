const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ImportError = sequelize.define('ImportError', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  import_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '导入记录ID'
  },
  row_number: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '原始行号'
  },
  column_position: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '列位置/字段名'
  },
  original_data: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '原始数据（JSON格式）'
  },
  error_type: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '错误类型'
  },
  error_message: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: '失败原因'
  },
  suggestion: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '修改建议'
  },
  field_name: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '问题字段名'
  },
  field_value: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: '问题字段值'
  },
  resolved: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否已解决'
  },
  resolved_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '解决人ID'
  },
  resolved_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '解决时间'
  },
  resolution_note: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '解决说明'
  }
}, {
  tableName: 'import_errors',
  comment: '导入错误记录表'
});

module.exports = ImportError;
