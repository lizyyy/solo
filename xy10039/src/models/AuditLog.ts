import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';
import { LogAction, LogEntity } from '../types';

export class AuditLog extends Model {
  public id!: string;
  public action!: LogAction;
  public entity!: LogEntity;
  public entityId!: string;
  public userId?: string;
  public oldValues?: object;
  public newValues?: object;
  public ipAddress?: string;
  public userAgent?: string;
  public readonly createdAt!: Date;
}

AuditLog.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    action: {
      type: DataTypes.ENUM(...Object.values(LogAction)),
      allowNull: false
    },
    entity: {
      type: DataTypes.ENUM(...Object.values(LogEntity)),
      allowNull: false
    },
    entityId: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    oldValues: {
      type: DataTypes.JSON,
      allowNull: true
    },
    newValues: {
      type: DataTypes.JSON,
      allowNull: true
    },
    ipAddress: {
      type: DataTypes.STRING(45),
      allowNull: true
    },
    userAgent: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  },
  {
    sequelize,
    modelName: 'AuditLog',
    tableName: 'audit_logs',
    timestamps: true,
    updatedAt: false,
    indexes: [
      { name: 'audit_logs_entity_id_idx', fields: ['entityId'] },
      { name: 'audit_logs_user_id_idx', fields: ['userId'] },
      { name: 'audit_logs_created_at_idx', fields: ['createdAt'] },
      { name: 'audit_logs_entity_entity_id_idx', fields: ['entity', 'entityId'] }
    ]
  }
);
