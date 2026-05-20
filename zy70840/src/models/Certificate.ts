import { DataTypes, Model } from 'sequelize';
import sequelize from '../database';

export enum CertificateStatus {
  VALID = 'valid',
  EXPIRED = 'expired',
  EXPIRING_SOON = 'expiring_soon',
}

class Certificate extends Model {
  public id!: number;
  public applicationId!: number;
  public certificateNo!: string;
  public type!: string;
  public version!: string;
  public issueDate!: Date;
  public expiryDate!: Date;
  public status!: CertificateStatus;
  public attachmentUrl!: string;
  public checkedAt!: Date | null;
  public checkedBy!: string | null;
}

Certificate.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    applicationId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'applications',
        key: 'id',
      },
    },
    certificateNo: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    type: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    version: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    issueDate: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    expiryDate: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM(...Object.values(CertificateStatus)),
      allowNull: false,
      defaultValue: CertificateStatus.VALID,
    },
    attachmentUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    checkedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    checkedBy: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'Certificate',
    tableName: 'certificates',
    timestamps: true,
    indexes: [
      { fields: ['applicationId'] },
      { fields: ['status'] },
      { fields: ['expiryDate'] },
    ],
  }
);

export default Certificate;
