const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const IMPORT_TYPES = {
  REQUISITION_CSV: 'requisition_csv',
  INVENTORY_JSON: 'inventory_json',
  HAZARD_RULES: 'hazard_rules',
  REAGENTS: 'reagents',
  USERS: 'users'
};

const IMPORT_STATUSES = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  PARTIAL_SUCCESS: 'partial_success',
  FAILED: 'failed'
};

const ImportRecord = sequelize.define('ImportRecord', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  import_no: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    comment: '导入单号'
  },
  import_type: {
    type: DataTypes.ENUM(Object.values(IMPORT_TYPES)),
    allowNull: false,
    comment: '导入类型'
  },
  file_name: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: '文件名'
  },
  file_path: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: '文件路径'
  },
  total_records: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '总记录数'
  },
  success_records: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '成功记录数'
  },
  failed_records: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '失败记录数'
  },
  status: {
    type: DataTypes.ENUM(Object.values(IMPORT_STATUSES)),
    allowNull: false,
    defaultValue: IMPORT_STATUSES.PENDING,
    comment: '导入状态'
  },
  operator_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '操作人ID'
  },
  operator_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '操作人姓名'
  },
  started_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '开始时间'
  },
  completed_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '完成时间'
  },
  error_message: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '错误信息'
  },
  remark: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '备注'
  }
}, {
  tableName: 'import_records',
  comment: '导入记录表'
});

ImportRecord.IMPORT_TYPES = IMPORT_TYPES;
ImportRecord.IMPORT_STATUSES = IMPORT_STATUSES;

module.exports = ImportRecord;
