import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';

class ExceptionRecord extends Model {
  public id!: string;
  public type!: 'file_expiry' | 'download_failure' | 'task_failure' | 'repeated_operation' | 'sensitive_field_violation' | 'other';
  public requestId!: string | null;
  public description!: string;
  public details!: object | null;
  public status!: 'pending' | 'processed' | 'ignored';
  public processedBy!: string | null;
  public processedAt!: Date | null;
  public createdAt!: Date;
}

ExceptionRecord.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
    },
    type: {
      type: DataTypes.ENUM('file_expiry', 'download_failure', 'task_failure', 'repeated_operation', 'sensitive_field_violation', 'other'),
      allowNull: false,
    },
    requestId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    details: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('pending', 'processed', 'ignored'),
      defaultValue: 'pending',
    },
    processedBy: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    processedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'ExceptionRecord',
    timestamps: true,
  }
);

export default ExceptionRecord;
