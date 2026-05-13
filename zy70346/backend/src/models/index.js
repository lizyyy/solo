const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Template = sequelize.define('Template', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  category: {
    type: DataTypes.ENUM('verification', 'billing', 'promotion'),
    allowNull: false,
    comment: 'verification: 验证码, billing: 账单提醒, promotion: 活动通知'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  currentVersionId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive'),
    defaultValue: 'active'
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
});

const TemplateVersion = sequelize.define('TemplateVersion', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  templateId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'Templates', key: 'id' }
  },
  version: {
    type: DataTypes.STRING(20),
    allowNull: false,
    comment: '格式: v1, v2, v1.1.0'
  },
  versionNumber: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '用于版本排序，从1开始递增'
  },
  smsContent: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '短信模板内容，使用{{variable}}格式'
  },
  emailSubject: {
    type: DataTypes.STRING(200),
    allowNull: true,
    comment: '邮件主题'
  },
  emailContent: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '邮件模板内容，支持HTML'
  },
  inAppTitle: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '站内信标题'
  },
  inAppContent: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '站内信模板内容'
  },
  variableDictionary: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: 'JSON格式的变量字典快照'
  },
  channelLimits: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: 'JSON格式的渠道限制配置'
  },
  status: {
    type: DataTypes.ENUM('draft', 'testing', 'gradual', 'full', 'rolled_back'),
    defaultValue: 'draft',
    comment: 'draft: 草稿, testing: 测试中, gradual: 灰度发布中, full: 全量发布, rolled_back: 已回滚'
  },
  previousVersionId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: '上一个版本的ID'
  },
  createdBy: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
});

const VariableDictionary = sequelize.define('VariableDictionary', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  templateId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'Templates', key: 'id' }
  },
  variableName: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '变量名，如 {{code}}'
  },
  displayName: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  isRequired: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  dataType: {
    type: DataTypes.ENUM('string', 'number', 'date', 'boolean'),
    defaultValue: 'string'
  },
  defaultValue: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: '默认值/样例值'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
});

const ReleaseRecord = sequelize.define('ReleaseRecord', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  templateId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'Templates', key: 'id' }
  },
  versionId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'TemplateVersions', key: 'id' }
  },
  releaseType: {
    type: DataTypes.ENUM('gradual', 'full', 'rollback'),
    allowNull: false,
    comment: 'gradual: 灰度发布, full: 全量发布, rollback: 回滚'
  },
  status: {
    type: DataTypes.ENUM('pending', 'running', 'success', 'failed'),
    defaultValue: 'pending'
  },
  gradualStrategy: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '灰度策略，JSON格式：{type: "percentage|user_list|condition", value: ...}'
  },
  targetUsers: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '灰度目标用户，JSON数组格式'
  },
  hitUsers: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '实际命中的灰度用户，JSON数组格式'
  },
  validationResult: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '变量校验结果，JSON格式'
  },
  simulationResult: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '发送模拟记录，JSON格式'
  },
  failureReason: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  operator: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  startedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  completedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
});

const AuditLog = sequelize.define('AuditLog', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  templateId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  versionId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  releaseRecordId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  action: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '操作类型：create, update, delete, release_gradual, release_full, rollback, validate, simulate'
  },
  details: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '操作详情，JSON格式'
  },
  operator: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
});

Template.hasMany(TemplateVersion, { foreignKey: 'templateId', as: 'versions' });
TemplateVersion.belongsTo(Template, { foreignKey: 'templateId', as: 'template' });

Template.hasMany(VariableDictionary, { foreignKey: 'templateId', as: 'variables' });
VariableDictionary.belongsTo(Template, { foreignKey: 'templateId', as: 'template' });

Template.hasMany(ReleaseRecord, { foreignKey: 'templateId', as: 'releases' });
ReleaseRecord.belongsTo(Template, { foreignKey: 'templateId', as: 'template' });
ReleaseRecord.belongsTo(TemplateVersion, { foreignKey: 'versionId', as: 'version' });

module.exports = {
  sequelize,
  Template,
  TemplateVersion,
  VariableDictionary,
  ReleaseRecord,
  AuditLog
};