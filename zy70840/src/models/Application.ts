import { DataTypes, Model } from 'sequelize';
import sequelize from '../database';

export enum ApplicationStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  RETURNED = 'returned',
  PROCESSING = 'processing',
}

class Application extends Model {
  public id!: number;
  public batchId!: number;
  public applicationNo!: string;
  public merchantName!: string;
  public contactPerson!: string;
  public contactPhone!: string;
  public stallType!: string;
  public stallLocation!: string;
  public startDate!: Date;
  public endDate!: Date;
  public depositAmount!: number;
  public status!: ApplicationStatus;
  public certificateVersion!: string;
  public importedAt!: Date;
  public processedAt!: Date | null;
  public processedBy!: string | null;
}

Application.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    batchId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'batches',
        key: 'id',
      },
    },
    applicationNo: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    merchantName: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    contactPerson: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    contactPhone: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    stallType: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    stallLocation: {
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
    depositAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    status: {
      type: DataTypes.ENUM(...Object.values(ApplicationStatus)),
      allowNull: false,
      defaultValue: ApplicationStatus.PENDING,
    },
    certificateVersion: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    importedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    processedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    processedBy: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'Application',
    tableName: 'applications',
    timestamps: true,
    indexes: [
      { fields: ['batchId'] },
      { fields: ['status'] },
      { fields: ['stallLocation'] },
      { fields: ['startDate', 'endDate'] },
    ],
  }
);

export default Application;
