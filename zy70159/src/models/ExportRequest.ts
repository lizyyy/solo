import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';

class ExportRequest extends Model {
  public id!: string;
  public requesterId!: string;
  public requesterName!: string;
  public dataCategory!: string;
  exportTimeRange!: {
    start: string;
    end: string;
  };
  public fieldsToExport!: string[];
  public purpose!: string;
  public status!: 'pending' | 'approved' | 'rejected' | 'processing' | 'completed' | 'expired';
  public fileUrl!: string | null;
  public fileName!: string | null;
  public fileExpiryTime!: Date | null;
  public downloadCount!: number;
  public createdAt!: Date;
  public updatedAt!: Date;
}

ExportRequest.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
    },
    requesterId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    requesterName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    dataCategory: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    exportTimeRange: {
      type: DataTypes.JSON,
      allowNull: false,
    },
    fieldsToExport: {
      type: DataTypes.JSON,
      allowNull: false,
    },
    purpose: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('pending', 'approved', 'rejected', 'processing', 'completed', 'expired'),
      defaultValue: 'pending',
    },
    fileUrl: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    fileName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    fileExpiryTime: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    downloadCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
  },
  {
    sequelize,
    modelName: 'ExportRequest',
    timestamps: true,
  }
);

export default ExportRequest;
