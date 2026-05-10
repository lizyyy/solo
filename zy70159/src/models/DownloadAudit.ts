import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';

class DownloadAudit extends Model {
  public id!: string;
  public requestId!: string;
  public requesterId!: string;
  public requesterName!: string;
  public downloadTime!: Date;
  public success!: boolean;
  public failureReason!: string | null;
  public ipAddress!: string | null;
  public userAgent!: string | null;
}

DownloadAudit.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
    },
    requestId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    requesterId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    requesterName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    downloadTime: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    success: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
    },
    failureReason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    ipAddress: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    userAgent: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'DownloadAudit',
    timestamps: false,
  }
);

export default DownloadAudit;
