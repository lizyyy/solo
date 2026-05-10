const bcrypt = require('bcryptjs');
const { ROLE, ROLE_PERMISSIONS } = require('../core/constants');

module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define(
    'User',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      username: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
        comment: '用户名',
      },
      password: {
        type: DataTypes.STRING(255),
        allowNull: false,
        comment: '密码(加密)',
      },
      email: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: '邮箱',
      },
      displayName: {
        type: DataTypes.STRING(100),
        allowNull: false,
        comment: '显示名称',
      },
      role: {
        type: DataTypes.ENUM(...Object.values(ROLE)),
        allowNull: false,
        defaultValue: ROLE.OPERATOR,
        comment: '角色',
      },
      businessLineId: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: '所属业务线',
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: '是否启用',
      },
      lastLoginAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: '最后登录时间',
      },
      metadata: {
        type: DataTypes.JSONB,
        defaultValue: {},
        comment: '扩展字段',
      },
    },
    {
      tableName: 'users',
      paranoid: true,
      indexes: [
        {
          unique: true,
          fields: ['username'],
        },
        {
          fields: ['role'],
        },
        {
          fields: ['business_line_id'],
        },
      ],
    }
  );

  User.associate = (models) => {
    User.belongsTo(models.BusinessLine, {
      foreignKey: 'businessLineId',
      as: 'businessLine',
    });

    User.hasMany(models.AuditLog, {
      foreignKey: 'actorId',
      as: 'auditLogs',
    });

    User.hasMany(models.Exemption, {
      foreignKey: 'requesterId',
      as: 'requestedExemptions',
    });

    User.hasMany(models.Exemption, {
      foreignKey: 'approverId',
      as: 'approvedExemptions',
    });

    User.hasMany(models.ExportRecord, {
      foreignKey: 'requesterId',
      as: 'exportRecords',
    });
  };

  User.prototype.checkPassword = async function (password) {
    return bcrypt.compare(password, this.password);
  };

  User.prototype.hashPassword = async function () {
    if (this.changed('password')) {
      this.password = await bcrypt.hash(this.password, 10);
    }
  };

  User.prototype.getPermissions = function () {
    return ROLE_PERMISSIONS[this.role] || [];
  };

  User.prototype.hasPermission = function (permission) {
    return this.getPermissions().includes(permission);
  };

  User.prototype.toJSON = function () {
    const values = { ...this.get() };
    delete values.password;
    return values;
  };

  User.beforeCreate(async (user) => {
    if (user.password) {
      user.password = await bcrypt.hash(user.password, 10);
    }
  });

  User.beforeUpdate(async (user) => {
    if (user.changed('password')) {
      user.password = await bcrypt.hash(user.password, 10);
    }
  });

  return User;
};
