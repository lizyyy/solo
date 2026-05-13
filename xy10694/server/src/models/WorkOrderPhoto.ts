import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';

export enum PhotoType {
  REPORT = 'report',
  PROCESS = 'process',
  COMPLETION = 'completion'
}

interface WorkOrderPhotoAttributes {
  id: string;
  workOrderId: string;
  photoUrl: string;
  photoType: PhotoType;
  description: string | null;
  uploadedBy: string;
  uploadedByName: string;
  createdAt?: Date;
  updatedAt?: Date;
}

class WorkOrderPhoto extends Model<WorkOrderPhotoAttributes> implements WorkOrderPhotoAttributes {
  public id!: string;
  public workOrderId!: string;
  public photoUrl!: string;
  public photoType!: PhotoType;
  public description!: string | null;
  public uploadedBy!: string;
  public uploadedByName!: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

WorkOrderPhoto.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false
    },
    workOrderId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    photoUrl: {
      type: DataTypes.STRING(500),
      allowNull: false
    },
    photoType: {
      type: DataTypes.ENUM(...Object.values(PhotoType)),
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    uploadedBy: {
      type: DataTypes.UUID,
      allowNull: false
    },
    uploadedByName: {
      type: DataTypes.STRING(50),
      allowNull: false
    }
  },
  {
    sequelize,
    modelName: 'WorkOrderPhoto',
    tableName: 'work_order_photos'
  }
);

export default WorkOrderPhoto;
