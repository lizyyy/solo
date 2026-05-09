import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';
import { RegistrationStatus } from '../types';

export class Registration extends Model {
  public id!: string;
  public activityId!: string;
  public name!: string;
  public email!: string;
  public phone?: string;
  public company?: string;
  public notes?: string;
  public status!: RegistrationStatus;
  public registrationTime!: Date;
  public createdBy!: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public readonly deletedAt?: Date;
}

Registration.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    activityId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'activities',
        key: 'id'
      }
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        isEmail: true
      }
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    company: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM(...Object.values(RegistrationStatus)),
      allowNull: false,
      defaultValue: RegistrationStatus.PENDING
    },
    registrationTime: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    }
  },
  {
    sequelize,
    modelName: 'Registration',
    tableName: 'registrations',
    paranoid: true,
    indexes: [
      { name: 'registrations_activity_id_idx', fields: ['activityId'] },
      { name: 'registrations_email_idx', fields: ['email'] },
      { name: 'registrations_status_idx', fields: ['status'] },
      { name: 'registrations_activity_email_idx', fields: ['activityId', 'email'], unique: false }
    ]
  }
);
