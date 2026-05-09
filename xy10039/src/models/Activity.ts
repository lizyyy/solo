import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';
import { ActivityStatus } from '../types';

export class Activity extends Model {
  public id!: string;
  public name!: string;
  public description?: string;
  public location!: string;
  public startTime!: Date;
  public endTime!: Date;
  public maxParticipants!: number;
  public status!: ActivityStatus;
  public createdBy!: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public readonly deletedAt?: Date;
}

Activity.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    location: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    startTime: {
      type: DataTypes.DATE,
      allowNull: false
    },
    endTime: {
      type: DataTypes.DATE,
      allowNull: false
    },
    maxParticipants: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 100
    },
    status: {
      type: DataTypes.ENUM(...Object.values(ActivityStatus)),
      allowNull: false,
      defaultValue: ActivityStatus.DRAFT
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
    modelName: 'Activity',
    tableName: 'activities',
    paranoid: true,
    indexes: [
      { name: 'activities_status_idx', fields: ['status'] },
      { name: 'activities_start_time_idx', fields: ['startTime'] },
      { name: 'activities_created_by_idx', fields: ['createdBy'] }
    ]
  }
);
