module.exports = (sequelize, DataTypes) => {
  const ExportRecord = sequelize.define(
    'ExportRecord',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      code: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
        comment: '导出单号',
      },
      type: {
        type: DataTypes.ENUM('blacklist', 'hit_records', 'audit_logs', 'risk_report'),
        allowNull: false,
        comment: '导出类型',
      },
      format: {
        type: DataTypes.ENUM('csv', 'json', 'xlsx'),
        allowNull: false,
        defaultValue: 'csv',
        comment: '导出格式',
      },
      status: {
        type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed', 'expired'),
        allowNull: false,
        defaultValue: 'pending',
        comment: '状态',
      },
      requesterId: {
        type: DataTypes.UUID,
        allowNull: false,
        comment: '请求人ID',
      },
      requesterName: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: '请求人名称',
      },
      businessLineId: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: '所属业务线',
      },
      filters: {
        type: DataTypes.JSONB,
        defaultValue: {},
        comment: '筛选条件',
      },
      recordCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: '导出记录数',
      },
      fileSize: {
        type: DataTypes.BIGINT,
        defaultValue: 0,
        comment: '文件大小(字节)',
      },
      fileUrl: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '文件URL',
      },
      filePath: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '本地文件路径',
      },
      fileName: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: '文件名',
      },
      errorMessage: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '错误信息',
      },
      downloadedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: '下载时间',
      },
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: '过期时间',
      },
      completedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: '完成时间',
      },
      processingStartedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: '开始处理时间',
      },
      metadata: {
        type: DataTypes.JSONB,
        defaultValue: {},
        comment: '扩展字段',
      },
    },
    {
      tableName: 'export_records',
      paranoid: true,
      indexes: [
        {
          unique: true,
          fields: ['code'],
        },
        {
          fields: ['type'],
        },
        {
          fields: ['status'],
        },
        {
          fields: ['requester_id'],
        },
        {
          fields: ['business_line_id'],
        },
        {
          fields: ['created_at'],
        },
      ],
    }
  );

  ExportRecord.associate = (models) => {
    ExportRecord.belongsTo(models.User, {
      foreignKey: 'requesterId',
      as: 'requester',
    });

    ExportRecord.belongsTo(models.BusinessLine, {
      foreignKey: 'businessLineId',
      as: 'businessLine',
    });
  };

  ExportRecord.generateCode = function () {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `EXP-${year}${month}${day}-${random}`;
  };

  ExportRecord.beforeValidate((record) => {
    if (!record.code) {
      record.code = ExportRecord.generateCode();
    }
  });

  return ExportRecord;
};
