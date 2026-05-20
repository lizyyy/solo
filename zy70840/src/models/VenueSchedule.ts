import { DataTypes, Model } from 'sequelize';
import sequelize from '../database';

export enum ScheduleStatus {
  AVAILABLE = 'available',
  OCCUPIED = 'occupied',
  BLOCKED = 'blocked',
}

class VenueSchedule extends Model {
  public id!: number;
  public applicationId!: number | null;
  public venueName!: string;
  public location!: string;
  public startDate!: Date;
  public endDate!: Date;
  public status!: ScheduleStatus;
  public blockedBy!: string | null;
  public blockedReason!: string | null;
}

VenueSchedule.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    applicationId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'applications',
        key: 'id',
      },
    },
    venueName: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    location: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    startDate: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    endDate: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM(...Object.values(ScheduleStatus)),
      allowNull: false,
      defaultValue: ScheduleStatus.AVAILABLE,
    },
    blockedBy: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    blockedReason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'VenueSchedule',
    tableName: 'venue_schedules',
    timestamps: true,
    indexes: [
      { fields: ['venueName', 'location'] },
      { fields: ['startDate', 'endDate'] },
      { fields: ['status'] },
    ],
  }
);

export default VenueSchedule;
