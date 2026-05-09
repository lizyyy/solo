import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';
import { RegistrationStatus } from '../types';

export class StatusHistory extends Model {
  public id!: string;
  public registrationId!: string;
  public oldStatus?: RegistrationStatus;
  public newStatus!: RegistrationStatus;
  public changedBy!: string;
  public reason?: string;
  public readonly createdAt!: Date;
}

StatusHistory.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    registrationId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'registrations',
        key: 'id'
      }
    },
    oldStatus: {
      type: DataTypes.ENUM(...Object.values(RegistrationStatus)),
      allowNull: true
    },
    newStatus: {
      type: DataTypes.ENUM(...Object.values(RegistrationStatus)),
      allowNull: false
    },
    changedBy: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  },
  {
    sequelize,
    modelName: 'StatusHistory',
    tableName: 'status_history',
    timestamps: true,
    updatedAt: false,
    indexes: [
      { name: 'status_history_registration_id_idx', fields: ['registrationId'] },
      { name: 'status_history_changed_by_idx', fields: ['changedBy'] },
      { name: 'status_history_created_at_idx', fields: ['createdAt'] }
    ]
  }
);
