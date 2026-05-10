const { ROLE } = require('../core/constants');

module.exports = (sequelize, DataTypes) => {
  const BusinessLine = sequelize.define(
    'BusinessLine',
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
        comment: '业务线编码',
      },
      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        comment: '业务线名称',
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '业务线描述',
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: '是否启用',
      },
      metadata: {
        type: DataTypes.JSONB,
        defaultValue: {},
        comment: '扩展字段',
      },
    },
    {
      tableName: 'business_lines',
      paranoid: true,
      indexes: [
        {
          unique: true,
          fields: ['code'],
        },
        {
          fields: ['is_active'],
        },
      ],
    }
  );

  BusinessLine.associate = (models) => {
    BusinessLine.hasMany(models.User, {
      foreignKey: 'businessLineId',
      as: 'users',
    });

    BusinessLine.hasMany(models.Blacklist, {
      foreignKey: 'businessLineId',
      as: 'blacklists',
    });

    BusinessLine.hasMany(models.Exemption, {
      foreignKey: 'businessLineId',
      as: 'exemptions',
    });

    BusinessLine.hasMany(models.ShareVersion, {
      foreignKey: 'businessLineId',
      as: 'shareVersions',
    });
  };

  return BusinessLine;
};
