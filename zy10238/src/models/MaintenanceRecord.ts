import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';

export enum MaintenanceStatus {
  PENDING = 'pending',
  DISPATCHED = 'dispatched',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

interface MaintenanceRecordAttributes {
  id: string;
  ticketId: string;
  stationId: string;
  pileId: string;
  maintenanceCode?: string;
  technicianId?: string;
  technicianName?: string;
  status: MaintenanceStatus;
  problemDescription?: string;
  solution?: string;
  partsReplaced?: string;
  startTime?: Date;
  endTime?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

class MaintenanceRecord extends Model<MaintenanceRecordAttributes> implements MaintenanceRecordAttributes {
  public id!: string;
  public ticketId!: string;
  public stationId!: string;
  public pileId!: string;
  public maintenanceCode?: string;
  public technicianId?: string;
  public technicianName?: string;
  public status!: MaintenanceStatus;
  public problemDescription?: string;
  public solution?: string;
  public partsReplaced?: string;
  public startTime?: Date;
  public endTime?: Date;
  public notes?: string;
  public createdAt!: Date;
  public updatedAt!: Date;
}

MaintenanceRecord.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
    },
    ticketId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'fault_tickets',
        key: 'id',
      },
    },
    stationId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    pileId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    maintenanceCode: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    technicianId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    technicianName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM(...Object.values(MaintenanceStatus)),
      allowNull: false,
      defaultValue: MaintenanceStatus.PENDING,
    },
    problemDescription: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    solution: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    partsReplaced: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    startTime: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    endTime: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'maintenance_records',
    indexes: [
      { fields: ['ticketId'] },
      { fields: ['pileId'] },
      { fields: ['status'] },
    ],
  }
);

export default MaintenanceRecord;
