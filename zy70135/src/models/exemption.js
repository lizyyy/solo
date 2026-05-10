const { EXEMPTION_STATUS, EXEMPTION_TYPE } = require('../core/constants');

module.exports = (sequelize, DataTypes) => {
  const Exemption = sequelize.define(
    'Exemption',
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
        comment: '豁免单号',
      },
      blacklistId: {
        type: DataTypes.UUID,
        allowNull: false,
        comment: '关联黑名单ID',
      },
      memberIdentifier: {
        type: DataTypes.STRING(200),
        allowNull: false,
        comment: '会员标识',
      },
      identifierType: {
        type: DataTypes.STRING(50),
        allowNull: true,
        defaultValue: 'phone',
        comment: '标识类型',
      },
      type: {
        type: DataTypes.ENUM(...Object.values(EXEMPTION_TYPE)),
        allowNull: false,
        defaultValue: EXEMPTION_TYPE.TEMPORARY,
        comment: '豁免类型',
      },
      status: {
        type: DataTypes.ENUM(...Object.values(EXEMPTION_STATUS)),
        allowNull: false,
        defaultValue: EXEMPTION_STATUS.PENDING,
        comment: '状态',
      },
      reason: {
        type: DataTypes.TEXT,
        allowNull: false,
        comment: '豁免原因',
      },
      durationDays: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: '豁免天数(临时豁免)',
      },
      startDate: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: '生效开始时间',
      },
      expiryDate: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: '过期时间',
      },
      businessLineId: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: '所属业务线',
      },
      requesterId: {
        type: DataTypes.UUID,
        allowNull: false,
        comment: '申请人ID',
      },
      requesterComment: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '申请人备注',
      },
      approverId: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: '审批人ID',
      },
      approverComment: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '审批人备注',
      },
      approvedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: '审批时间',
      },
      rejectedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: '拒绝时间',
      },
      expiredAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: '过期处理时间',
      },
      revokedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: '撤销时间',
      },
      revokedBy: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: '撤销人',
      },
      revocationReason: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '撤销原因',
      },
      hitCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: '豁免期间命中次数',
      },
      metadata: {
        type: DataTypes.JSONB,
        defaultValue: {},
        comment: '扩展字段',
      },
    },
    {
      tableName: 'exemptions',
      paranoid: true,
      indexes: [
        {
          unique: true,
          fields: ['code'],
        },
        {
          fields: ['blacklist_id'],
        },
        {
          fields: ['member_identifier'],
        },
        {
          fields: ['status'],
        },
        {
          fields: ['type'],
        },
        {
          fields: ['business_line_id'],
        },
        {
          fields: ['requester_id'],
        },
        {
          fields: ['approver_id'],
        },
        {
          fields: ['expiry_date'],
        },
      ],
    }
  );

  Exemption.associate = (models) => {
    Exemption.belongsTo(models.Blacklist, {
      foreignKey: 'blacklistId',
      as: 'blacklist',
    });

    Exemption.belongsTo(models.BusinessLine, {
      foreignKey: 'businessLineId',
      as: 'businessLine',
    });

    Exemption.belongsTo(models.User, {
      foreignKey: 'requesterId',
      as: 'requester',
    });

    Exemption.belongsTo(models.User, {
      foreignKey: 'approverId',
      as: 'approver',
    });

    Exemption.belongsTo(models.User, {
      foreignKey: 'revokedBy',
      as: 'revoker',
    });
  };

  Exemption.generateCode = function () {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `EXM-${year}${month}${day}-${random}`;
  };

  Exemption.beforeValidate((exemption) => {
    if (!exemption.code) {
      exemption.code = Exemption.generateCode();
    }
  });

  return Exemption;
};
