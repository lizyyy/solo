const Sequelize = require('sequelize');
const sequelize = require('../config/database');

const ImportBatch = sequelize.define('ImportBatch', {
  id: {
    type: Sequelize.UUID,
    primaryKey: true,
    defaultValue: Sequelize.UUIDV4,
  },
  batchName: {
    type: Sequelize.STRING(200),
    allowNull: false,
  },
  batchType: {
    type: Sequelize.ENUM('customer', 'product'),
    allowNull: false,
    comment: '导入类型：客户/商品',
  },
  status: {
    type: Sequelize.ENUM(
      'uploaded',
      'mapping_configured',
      'precheck_passed',
      'precheck_failed',
      'trial_imported',
      'confirmed',
      'rolled_back'
    ),
    allowNull: false,
    defaultValue: 'uploaded',
    comment: '批次状态',
  },
  totalRows: {
    type: Sequelize.INTEGER,
    defaultValue: 0,
    comment: '总数据行数',
  },
  validRows: {
    type: Sequelize.INTEGER,
    defaultValue: 0,
    comment: '有效数据行数',
  },
  errorRows: {
    type: Sequelize.INTEGER,
    defaultValue: 0,
    comment: '错误数据行数',
  },
  sourceFileName: {
    type: Sequelize.STRING(500),
    allowNull: true,
  },
  sourceFileHash: {
    type: Sequelize.STRING(64),
    comment: '源文件哈希，用于检测文件变化',
  },
  mappingConfig: {
    type: Sequelize.TEXT,
    comment: '字段映射配置 JSON',
  },
  rawData: {
    type: Sequelize.TEXT,
    comment: '原始数据 JSON',
  },
  precheckReport: {
    type: Sequelize.TEXT,
    comment: '预检报告 JSON',
  },
  trialImportReport: {
    type: Sequelize.TEXT,
    comment: '试导入报告 JSON',
  },
  finalReport: {
    type: Sequelize.TEXT,
    comment: '最终导入报告 JSON',
  },
  uploadedBy: {
    type: Sequelize.STRING(100),
    allowNull: true,
  },
  confirmedBy: {
    type: Sequelize.STRING(100),
    allowNull: true,
  },
  rolledBackBy: {
    type: Sequelize.STRING(100),
    allowNull: true,
  },
  rollbackReason: {
    type: Sequelize.STRING(500),
    allowNull: true,
  },
  uploadedAt: {
    type: Sequelize.DATE,
    defaultValue: Sequelize.NOW,
  },
  confirmedAt: {
    type: Sequelize.DATE,
    allowNull: true,
  },
  rolledBackAt: {
    type: Sequelize.DATE,
    allowNull: true,
  },
}, {
  tableName: 'import_batches',
  timestamps: true,
});

const ImportTimeline = sequelize.define('ImportTimeline', {
  id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  batchId: {
    type: Sequelize.UUID,
    allowNull: false,
    references: {
      model: ImportBatch,
      key: 'id',
    },
  },
  action: {
    type: Sequelize.ENUM(
      'upload',
      'configure_mapping',
      'precheck',
      'trial_import',
      'confirm',
      'rollback'
    ),
    allowNull: false,
  },
  status: {
    type: Sequelize.ENUM('success', 'failed', 'partial'),
    allowNull: false,
  },
  processedCount: {
    type: Sequelize.INTEGER,
    defaultValue: 0,
  },
  successCount: {
    type: Sequelize.INTEGER,
    defaultValue: 0,
  },
  errorCount: {
    type: Sequelize.INTEGER,
    defaultValue: 0,
  },
  operator: {
    type: Sequelize.STRING(100),
    allowNull: true,
  },
  remark: {
    type: Sequelize.STRING(500),
    allowNull: true,
  },
  createdAt: {
    type: Sequelize.DATE,
    defaultValue: Sequelize.NOW,
  },
}, {
  tableName: 'import_timelines',
  timestamps: false,
});

const ImportError = sequelize.define('ImportError', {
  id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  batchId: {
    type: Sequelize.UUID,
    allowNull: false,
    references: {
      model: ImportBatch,
      key: 'id',
    },
  },
  rowIndex: {
    type: Sequelize.INTEGER,
    allowNull: false,
    comment: '数据行号（从1开始）',
  },
  stage: {
    type: Sequelize.ENUM('precheck', 'trial_import', 'final_import'),
    allowNull: false,
    comment: '错误发生阶段',
  },
  errorType: {
    type: Sequelize.ENUM(
      'required_missing',
      'enum_invalid',
      'duplicate',
      'mapping_conflict',
      'format_invalid',
      'business_rule',
      'system_error'
    ),
    allowNull: false,
  },
  fieldName: {
    type: Sequelize.STRING(100),
    allowNull: true,
  },
  errorMessage: {
    type: Sequelize.STRING(1000),
    allowNull: false,
  },
  rawValue: {
    type: Sequelize.STRING(2000),
    allowNull: true,
  },
  isFixed: {
    type: Sequelize.BOOLEAN,
    defaultValue: false,
    comment: '是否已人工修正',
  },
  fixedValue: {
    type: Sequelize.STRING(2000),
    allowNull: true,
  },
  fixedBy: {
    type: Sequelize.STRING(100),
    allowNull: true,
  },
  fixedAt: {
    type: Sequelize.DATE,
    allowNull: true,
  },
  createdAt: {
    type: Sequelize.DATE,
    defaultValue: Sequelize.NOW,
  },
}, {
  tableName: 'import_errors',
  timestamps: false,
  indexes: [
    {
      name: 'idx_batch_stage',
      fields: ['batchId', 'stage'],
    },
  ],
});

const ImportedRecord = sequelize.define('ImportedRecord', {
  id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  batchId: {
    type: Sequelize.UUID,
    allowNull: false,
    references: {
      model: ImportBatch,
      key: 'id',
    },
  },
  recordType: {
    type: Sequelize.ENUM('customer', 'product'),
    allowNull: false,
  },
  rowIndex: {
    type: Sequelize.INTEGER,
    allowNull: false,
  },
  externalId: {
    type: Sequelize.STRING(200),
    comment: '外部系统ID',
  },
  internalId: {
    type: Sequelize.STRING(200),
    comment: '内部系统ID',
  },
  recordData: {
    type: Sequelize.TEXT,
    comment: '记录完整数据 JSON',
  },
  isRolledBack: {
    type: Sequelize.BOOLEAN,
    defaultValue: false,
  },
  rollbackCompensationId: {
    type: Sequelize.UUID,
    allowNull: true,
    comment: '关联的补偿记录ID',
  },
  importedAt: {
    type: Sequelize.DATE,
    defaultValue: Sequelize.NOW,
  },
}, {
  tableName: 'imported_records',
  timestamps: false,
});

const CompensationRecord = sequelize.define('CompensationRecord', {
  id: {
    type: Sequelize.UUID,
    primaryKey: true,
    defaultValue: Sequelize.UUIDV4,
  },
  batchId: {
    type: Sequelize.UUID,
    allowNull: false,
    references: {
      model: ImportBatch,
      key: 'id',
    },
  },
  importedRecordId: {
    type: Sequelize.INTEGER,
    allowNull: false,
    references: {
      model: ImportedRecord,
      key: 'id',
    },
  },
  recordType: {
    type: Sequelize.ENUM('customer', 'product'),
    allowNull: false,
  },
  compensationType: {
    type: Sequelize.ENUM('delete', 'archive', 'status_change'),
    allowNull: false,
    comment: '补偿类型',
  },
  originalInternalId: {
    type: Sequelize.STRING(200),
    comment: '原始内部ID',
  },
  originalData: {
    type: Sequelize.TEXT,
    comment: '原始数据 JSON',
  },
  operator: {
    type: Sequelize.STRING(100),
    allowNull: true,
  },
  reason: {
    type: Sequelize.STRING(500),
    allowNull: true,
  },
  createdAt: {
    type: Sequelize.DATE,
    defaultValue: Sequelize.NOW,
  },
}, {
  tableName: 'compensation_records',
  timestamps: false,
});

const Customer = sequelize.define('Customer', {
  id: {
    type: Sequelize.UUID,
    primaryKey: true,
    defaultValue: Sequelize.UUIDV4,
  },
  customerNo: {
    type: Sequelize.STRING(50),
    unique: true,
    allowNull: false,
  },
  customerName: {
    type: Sequelize.STRING(200),
    allowNull: false,
  },
  phone: {
    type: Sequelize.STRING(20),
    allowNull: true,
  },
  email: {
    type: Sequelize.STRING(100),
    allowNull: true,
  },
  level: {
    type: Sequelize.ENUM('normal', 'silver', 'gold', 'platinum'),
    defaultValue: 'normal',
    comment: '客户等级',
  },
  source: {
    type: Sequelize.ENUM('online', 'offline', 'referral', 'advertisement'),
    allowNull: true,
    comment: '客户来源',
  },
  province: {
    type: Sequelize.STRING(50),
    allowNull: true,
  },
  city: {
    type: Sequelize.STRING(50),
    allowNull: true,
  },
  address: {
    type: Sequelize.STRING(500),
    allowNull: true,
  },
  status: {
    type: Sequelize.ENUM('active', 'inactive', 'archived'),
    defaultValue: 'active',
  },
  importedBatchId: {
    type: Sequelize.UUID,
    allowNull: true,
    comment: '导入批次ID',
  },
  remark: {
    type: Sequelize.STRING(1000),
    allowNull: true,
  },
  createdAt: {
    type: Sequelize.DATE,
    defaultValue: Sequelize.NOW,
  },
  updatedAt: {
    type: Sequelize.DATE,
    defaultValue: Sequelize.NOW,
  },
}, {
  tableName: 'customers',
  timestamps: true,
});

const Product = sequelize.define('Product', {
  id: {
    type: Sequelize.UUID,
    primaryKey: true,
    defaultValue: Sequelize.UUIDV4,
  },
  productCode: {
    type: Sequelize.STRING(50),
    unique: true,
    allowNull: false,
  },
  productName: {
    type: Sequelize.STRING(200),
    allowNull: false,
  },
  category: {
    type: Sequelize.ENUM('electronics', 'clothing', 'food', 'home', 'beauty', 'other'),
    allowNull: true,
  },
  price: {
    type: Sequelize.DECIMAL(10, 2),
    defaultValue: 0,
  },
  stock: {
    type: Sequelize.INTEGER,
    defaultValue: 0,
  },
  unit: {
    type: Sequelize.STRING(20),
    defaultValue: '件',
  },
  brand: {
    type: Sequelize.STRING(100),
    allowNull: true,
  },
  status: {
    type: Sequelize.ENUM('active', 'inactive', 'discontinued'),
    defaultValue: 'active',
  },
  importedBatchId: {
    type: Sequelize.UUID,
    allowNull: true,
  },
  remark: {
    type: Sequelize.STRING(1000),
    allowNull: true,
  },
  createdAt: {
    type: Sequelize.DATE,
    defaultValue: Sequelize.NOW,
  },
  updatedAt: {
    type: Sequelize.DATE,
    defaultValue: Sequelize.NOW,
  },
}, {
  tableName: 'products',
  timestamps: true,
});

ImportBatch.hasMany(ImportTimeline, { foreignKey: 'batchId' });
ImportTimeline.belongsTo(ImportBatch, { foreignKey: 'batchId' });

ImportBatch.hasMany(ImportError, { foreignKey: 'batchId' });
ImportError.belongsTo(ImportBatch, { foreignKey: 'batchId' });

ImportBatch.hasMany(ImportedRecord, { foreignKey: 'batchId' });
ImportedRecord.belongsTo(ImportBatch, { foreignKey: 'batchId' });

ImportBatch.hasMany(CompensationRecord, { foreignKey: 'batchId' });
CompensationRecord.belongsTo(ImportBatch, { foreignKey: 'batchId' });

ImportedRecord.hasOne(CompensationRecord, { foreignKey: 'importedRecordId' });
CompensationRecord.belongsTo(ImportedRecord, { foreignKey: 'importedRecordId' });

module.exports = {
  sequelize,
  ImportBatch,
  ImportTimeline,
  ImportError,
  ImportedRecord,
  CompensationRecord,
  Customer,
  Product,
};
